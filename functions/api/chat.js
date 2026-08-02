import {
  assertConversation,
  fail,
  history,
  id,
  json,
  nextSequence,
  now,
  readJson,
  requireSameOrigin,
  requireUser,
  run,
  validMessage,
} from "../_lib/app.js";
import {
  callCalendarTool,
  calendarTools,
  hasCalendar,
} from "../_lib/calendar.js";
import {
  activeModel,
  activeProviderSupportsTools,
  qwen,
  systemPrompt,
} from "../_lib/qwen.js";
import { generateConversationTitle } from "../_lib/title.js";

const event = (payload) => `data: ${JSON.stringify(payload)}\n\n`;
const titleFor = (message) =>
  message.replace(/\s+/g, " ").slice(0, 30) || "新对话";
const CALENDAR_UNAVAILABLE_MESSAGE =
  "抱歉，日历查询没有完成。请稍后重试；如果持续失败，请重新连接 Calendar。";

// Some OpenAI-compatible providers emit their internal tool-call markup as
// plain text after a tool failure. It must never be shown as an assistant reply.
export function containsInternalToolMarkup(text) {
  return /DSML|<\|?tool_calls?\b/i.test(text || "");
}

// Avoid an extra model round trip for ordinary conversation when Calendar is
// connected. Date-only follow-ups remain included to preserve conversation flow.
export function shouldCheckCalendar(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return /日历|日程|待办|截止|deadline|提醒|会议|课程|上课|空闲|有空|活动|事件|安排/i.test(text)
    || /今天|明天|后天|本周|这周|下周|下星期|周[一二三四五六日天]|几号/.test(text);
}

async function saveMessage(db, conversationId, role, content) {
  await run(
    db,
    "INSERT INTO messages (id, conversation_id, role, content, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?)",
    [
      id(),
      conversationId,
      role,
      content,
      now(),
      await nextSequence(db, conversationId),
    ],
  );
}
async function logUsage(db, conversationId, model, usage) {
  if (!usage) return;
  await run(
    db,
    "INSERT INTO usage_records (id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      id(),
      conversationId,
      model,
      usage.prompt_tokens ?? null,
      usage.completion_tokens ?? null,
      usage.total_tokens ?? null,
      now(),
    ],
  );
}

async function buildMessages(env, baseMessages, calendarEnabled, message, thinking, reportActivity) {
  const messages = [{ role: "system", content: systemPrompt }];
  messages.push(...baseMessages);
  if (!calendarEnabled || !shouldCheckCalendar(message))
    return { messages, tools: undefined };
  reportActivity?.({ id: "analysis", kind: "thinking", label: thinking ? "正在思考问题" : "正在分析请求", status: "running" });
  const firstResult = await qwen(env, {
    messages,
    tools: calendarTools(),
    tool_choice: "auto",
    temperature: 0.4,
    max_tokens: thinking ? 1200 : 320,
  }, false, { reasoning: thinking });
  const initial = await firstResult.response.json();
  const choice = initial.choices?.[0]?.message;
  if (!choice) throw new Error("模型没有返回有效回复");
  await logUsage(
    env.DB,
    baseMessages.conversationId,
    await activeModel(env),
    initial.usage,
  );
  reportActivity?.({ id: "analysis", kind: "thinking", label: thinking ? "已完成思考" : "已完成分析", status: "done" });
  // 预检只用于判断是否调用工具；无需工具时，最终文本仍必须走下方 SSE 流式路径。
  if (!choice.tool_calls?.length)
    return { messages, tools: undefined, reasoning: firstResult.reasoning };
  messages.push(choice);
  let failedToolCalls = 0;
  for (const toolCall of choice.tool_calls.slice(0, 3)) {
    const activityId = toolCall.id || id();
    reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${toolCall.function.name}`, status: "running" });
    let content;
    try {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      content = JSON.stringify(
        await callCalendarTool(env, toolCall.function.name, args),
      );
      reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${toolCall.function.name}`, status: "done" });
    } catch (error) {
      failedToolCalls += 1;
      content = JSON.stringify({ error: error.message });
      reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${toolCall.function.name}`, status: "error", detail: "调用未完成" });
    }
    messages.push({ role: "tool", tool_call_id: toolCall.id, content });
  }
  const attemptedToolCalls = Math.min(choice.tool_calls.length, 3);
  if (failedToolCalls === attemptedToolCalls) {
    return {
      messages,
      tools: undefined,
      reasoning: firstResult.reasoning,
      calendarUnavailable: true,
    };
  }
  if (failedToolCalls) {
    messages.push({
      role: "system",
      content:
        "Calendar 工具调用已结束，其中部分调用失败。只能依据成功的工具结果回答；不要尝试再次调用工具，也不要输出任何工具调用格式或内部标记。",
    });
  }
  return {
    messages,
    tools: undefined,
    reasoning: firstResult.reasoning,
    hasCalendarToolCalls: true,
  };
}

function reportReasoning(reportActivity, requested, reasoning) {
  if (!requested) return;
  reportActivity({
    id: "reasoning",
    kind: "thinking",
    label: reasoning?.enabled ? "深度推理已启用" : "深度推理不可用，已普通回答",
    status: reasoning?.enabled ? "done" : "error",
    detail: reasoning?.reason,
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const body = await readJson(request);
  if (
    !body ||
    typeof body.conversation_id !== "string" ||
    !validMessage(body.message) ||
    (body.thinking !== undefined && typeof body.thinking !== "boolean")
  )
    return fail("validation_error", "消息不能为空且最多 12000 字符");
  const conversation = await assertConversation(env.DB, body.conversation_id);
  if (!conversation) return fail("not_found", "会话不存在", 404);
  await saveMessage(env.DB, conversation.id, "user", body.message.trim());
  const fallbackTitle = titleFor(body.message);
  const shouldGenerateTitle = conversation.title === "新对话";
  if (shouldGenerateTitle)
    await run(
      env.DB,
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
      [fallbackTitle, now(), conversation.id],
    );
  else
    await run(env.DB, "UPDATE conversations SET updated_at = ? WHERE id = ?", [
      now(),
      conversation.id,
    ]);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) =>
        controller.enqueue(new TextEncoder().encode(event(data)));
      // This uses the system-owned GLM credential, never a user model profile.
      const titleTask = shouldGenerateTitle
        ? generateConversationTitle(env, body.message.trim())
        : Promise.resolve(null);
      try {
        const prior = await history(env.DB, conversation.id);
        prior.conversationId = conversation.id;
        const reportActivity = (activity) => send({ type: "activity", activity });
        reportActivity({ id: "response", kind: "thinking", label: body.thinking === true ? "正在思考" : "正在准备回答", status: "running" });
        const prepared = await buildMessages(
          env,
          prior,
          (await hasCalendar(env)) && (await activeProviderSupportsTools(env)),
          body.message,
          body.thinking === true,
          reportActivity,
        );
        let answer = "";
        let usage = null;
        if (prepared.calendarUnavailable) {
          answer = CALENDAR_UNAVAILABLE_MESSAGE;
          send({ type: "delta", text: answer });
          reportReasoning(reportActivity, body.thinking === true, prepared.reasoning);
        } else {
          const completion = await qwen(
            env,
            {
              messages: prepared.messages,
              temperature: 0.6,
              max_tokens: body.thinking === true ? 4800 : 1200,
            },
            true,
            { reasoning: body.thinking === true },
          );
          reportReasoning(reportActivity, body.thinking === true, completion.reasoning);
          const reader = completion.response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const text = line.slice(5).trim();
              if (text === "[DONE]") continue;
              try {
                const chunk = JSON.parse(text);
                const delta = chunk.choices?.[0]?.delta?.content || "";
                if (delta) {
                  answer += delta;
                  if (!prepared.hasCalendarToolCalls) send({ type: "delta", text: delta });
                }
                if (chunk.usage) usage = chunk.usage;
              } catch {
                /* Ignore provider keep-alive chunks. */
              }
            }
          }
        }
        if (containsInternalToolMarkup(answer)) answer = CALENDAR_UNAVAILABLE_MESSAGE;
        if (!answer) answer = "抱歉，这次没有生成回复。";
        if (prepared.hasCalendarToolCalls) send({ type: "delta", text: answer });
        reportActivity({ id: "response", kind: "thinking", label: "正在生成回答", status: "done" });
        await saveMessage(env.DB, conversation.id, "assistant", answer);
        await logUsage(env.DB, conversation.id, await activeModel(env), usage);
        const generatedTitle = await titleTask;
        if (generatedTitle) {
          await run(
            env.DB,
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            [generatedTitle, now(), conversation.id],
          );
          send({ type: "title", title: generatedTitle });
        }
        send({ type: "done" });
      } catch (error) {
        send({
          type: "error",
          message: error.message || "AI 服务暂时不可用，请稍后重试。",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
