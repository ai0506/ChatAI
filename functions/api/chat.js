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
import { diagnostic, requestId } from "../_lib/observability.js";

const event = (payload) => `data: ${JSON.stringify(payload)}\n\n`;
const CALENDAR_TOOL_REQUIRED_PROMPT =
  "This is a Calendar request. You MUST call the appropriate Calendar tool before answering. Do not return a plain-text acknowledgement or make up Calendar information.";
const titleFor = (message) =>
  message.replace(/\s+/g, " ").slice(0, 30) || "新对话";
const CALENDAR_UNAVAILABLE_MESSAGE =
  "抱歉，日历查询没有完成。请稍后重试；如果持续失败，请重新连接 Calendar。";
const CALENDAR_NOT_CONNECTED_MESSAGE =
  "已选择「强制开启 Calendar」，但尚未连接 Calendar。请先在侧栏连接，或切换为自动/强制关闭。";
const CALENDAR_UNSUPPORTED_PROVIDER_MESSAGE =
  "已选择「强制开启 Calendar」，但当前模型不支持调用工具。请更换支持工具调用的模型，或切换为自动/强制关闭。";

// 目前只有 calendar 一个工具；未来新增工具（例如联网搜索）在这里加一行即可，
// 未识别的 key 会被安全忽略，前后端各自独立升级不会互相破坏。
const TOOL_MODE_VALUES = new Set(["auto", "on", "off"]);
function toolMode(body, key) {
  const value = body?.tool_modes?.[key];
  return TOOL_MODE_VALUES.has(value) ? value : "auto";
}

// Some OpenAI-compatible providers emit their internal tool-call markup as
// plain text after a tool failure. It must never be shown as an assistant reply.
export function containsInternalToolMarkup(text) {
  return /DSML|<\|?tool_calls?\b/i.test(text || "");
}

// Most OpenAI-compatible SSE streams use delta.content. A few providers send
// the final text in message.content instead, so accept both without exposing
// reasoning fields.
export function providerChunkText(chunk) {
  const content = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export function providerResponseText(payload) {
  const content = payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text;
  return typeof content === "string" ? content : "";
}

// Avoid an extra model round trip for ordinary conversation when Calendar is
// connected. Date-only follow-ups remain included to preserve conversation flow.
export function shouldCheckCalendar(message, priorMessages = []) {
  const text = String(message || "").trim();
  if (!text) return false;
  const followUp = /^(?:\u5e2e\u6211|\u9ebb\u70e6|\u8bf7)?(?:\u518d|\u4e5f)?(?:\u770b\u770b|\u770b\u4e0b|\u770b\u4e00\u4e0b|\u67e5\u67e5|\u67e5\u4e00\u4e0b|\u67e5\u9605|\u544a\u8bc9\u6211)?(?:\u6700\u8fd1|\u6700\u65b0|\u63a5\u4e0b\u6765|\u4e4b\u540e|\u7136\u540e|\u90a3|\u5462|\u8fd8\u6709|\u5176\u4f59|\u5269\u4e0b|\u8be6\u7ec6)?[\uff1f?!\u3002,.\uff0c\u3001\s]*$/u.test(text);
  if (followUp) {
    const previous = priorMessages.at(-1);
    const calendarContext = /\u65e5\u5386|\u65e5\u7a0b|\u5f85\u529e|\u622a\u6b62|deadline|\u63d0\u9192|\u4f1a\u8bae|\u8bfe\u7a0b|\u4e0a\u8bfe|\u7a7a\u95f2|\u6709\u7a7a|\u6d3b\u52a8|\u4e8b\u4ef6|\u5b89\u6392/i;
    if (previous && calendarContext.test(previous.content || "")) return true;
  }
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

async function buildMessages(env, baseMessages, calendarState, message, thinking, reportActivity, traceId, conversationId) {
  const messages = [{ role: "system", content: systemPrompt }];
  messages.push(...baseMessages);
  const { mode, connected, providerSupportsTools } = calendarState;
  if (mode === "off") return { messages, tools: undefined };
  if (!providerSupportsTools) {
    if (mode === "on")
      return { messages, tools: undefined, calendarUnavailable: true, calendarUnavailableMessage: CALENDAR_UNSUPPORTED_PROVIDER_MESSAGE };
    return { messages, tools: undefined };
  }
  if (!connected) {
    if (mode === "on")
      return { messages, tools: undefined, calendarUnavailable: true, calendarUnavailableMessage: CALENDAR_NOT_CONNECTED_MESSAGE };
    return { messages, tools: undefined };
  }
  const forced = mode === "on";
  if (!forced && !shouldCheckCalendar(message, baseMessages.slice(0, -1)))
    return { messages, tools: undefined };
  reportActivity?.({ id: "analysis", kind: "thinking", label: thinking ? "正在思考问题" : "正在分析请求", status: "running" });
  const firstResult = await qwen(env, {
    messages: [...messages, { role: "system", content: CALENDAR_TOOL_REQUIRED_PROMPT }],
    tools: calendarTools(),
    tool_choice: "auto",
    temperature: 0.4,
    max_tokens: thinking ? 1200 : 320,
  }, false, { reasoning: thinking, requestId: traceId, conversationId });
  const initial = await firstResult.response.json();
  const choice = initial.choices?.[0]?.message;
  if (!choice) throw new Error("模型没有返回有效回复");
  await logUsage(
    env.DB,
    conversationId,
    await activeModel(env),
    initial.usage,
  );
  reportActivity?.({ id: "analysis", kind: "thinking", label: thinking ? "已完成思考" : "已完成分析", status: "done" });
  // 预检只用于判断是否调用工具；无需工具时，最终文本仍必须走下方 SSE 流式路径。
  if (!choice.tool_calls?.length) {
    // Some providers accept tools but occasionally return plain text despite a
    // Calendar-only instruction. Query the safe read-only defaults directly
    // instead of presenting that provider lapse as a user-facing failure.
    const fallbackResults = {};
    let fallbackFailures = 0;
    for (const name of ["calendar_list_events", "calendar_list_deadlines"]) {
      const activityId = `calendar-fallback-${name}`;
      reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${name}`, status: "running" });
      try {
        fallbackResults[name] = await callCalendarTool(env, name, {});
        await diagnostic(env, { requestId: traceId, conversationId, event: "calendar_tool_completed", metadata: { tool: name, fallback: true } });
        reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${name}`, status: "done" });
      } catch (error) {
        fallbackFailures += 1;
        fallbackResults[name] = { error: error.message };
        await diagnostic(env, { requestId: traceId, conversationId, level: "error", event: "calendar_tool_failed", error, metadata: { tool: name, fallback: true } });
        reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${name}`, status: "error", detail: "调用未完成" });
      }
    }
    if (fallbackFailures === 2)
      return { messages, tools: undefined, reasoning: firstResult.reasoning, calendarUnavailable: true };
    messages.push({
      role: "system",
      content: `Verified Calendar results for the user's request: ${JSON.stringify(fallbackResults)}. Answer only from these results. Do not claim another Calendar query is needed.`,
    });
    await diagnostic(env, { requestId: traceId, conversationId, event: "calendar_tool_fallback", metadata: { tools: Object.keys(fallbackResults), failures: fallbackFailures } });
    return { messages, tools: undefined, reasoning: firstResult.reasoning, hasCalendarToolCalls: true };
  }
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
      await diagnostic(env, { requestId: traceId, conversationId, event: "calendar_tool_completed", metadata: { tool: toolCall.function.name } });
      reportActivity?.({ id: activityId, kind: "mcp", label: `Calendar · ${toolCall.function.name}`, status: "done" });
    } catch (error) {
      failedToolCalls += 1;
      await diagnostic(env, { requestId: traceId, conversationId, level: "error", event: "calendar_tool_failed", error, metadata: { tool: toolCall.function.name } });
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
  const traceId = requestId(request);
  const startedAt = Date.now();
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const body = await readJson(request);
  if (
    !body ||
    typeof body.conversation_id !== "string" ||
    !validMessage(body.message) ||
    (body.thinking !== undefined && typeof body.thinking !== "boolean") ||
    (body.tool_modes !== undefined && (typeof body.tool_modes !== "object" || body.tool_modes === null))
  )
    return fail("validation_error", "消息不能为空且最多 12000 字符");
  const calendarModeRequested = toolMode(body, "calendar");
  const conversation = await assertConversation(env.DB, body.conversation_id);
  if (!conversation) return fail("not_found", "会话不存在", 404);
  await saveMessage(env.DB, conversation.id, "user", body.message.trim());
  await diagnostic(env, { requestId: traceId, conversationId: conversation.id, event: "chat_started", metadata: { thinking: body.thinking === true, message_length: body.message.trim().length, calendar_mode: calendarModeRequested } });
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
        ? generateConversationTitle(env, body.message.trim(), { requestId: traceId, conversationId: conversation.id })
        : Promise.resolve(null);
      try {
        const prior = await history(env.DB, conversation.id);
        const reportActivity = (activity) => send({ type: "activity", activity });
        reportActivity({ id: "response", kind: "thinking", label: body.thinking === true ? "正在思考" : "正在准备回答", status: "running" });
        const prepared = await buildMessages(
          env,
          prior,
          {
            mode: calendarModeRequested,
            connected: await hasCalendar(env),
            providerSupportsTools: await activeProviderSupportsTools(env),
          },
          body.message,
          body.thinking === true,
          reportActivity,
          traceId,
          conversation.id,
        );
        let answer = "";
        let usage = null;
        let completion = null;
        let buffer = "";
        let hasStreamedDelta = false;
        let finishReason = null;
        if (prepared.calendarUnavailable) {
          answer = prepared.calendarUnavailableMessage || CALENDAR_UNAVAILABLE_MESSAGE;
          send({ type: "delta", text: answer });
          reportReasoning(reportActivity, body.thinking === true, prepared.reasoning);
        } else {
          completion = await qwen(
            env,
            {
              messages: prepared.messages,
              temperature: 0.6,
              max_tokens: body.thinking === true ? 4800 : 2400,
            },
            true,
            { reasoning: body.thinking === true, requestId: traceId, conversationId: conversation.id },
          );
          reportReasoning(reportActivity, body.thinking === true, completion.reasoning);
          const reader = completion.response.body.getReader();
          const decoder = new TextDecoder();
          buffer = "";
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
                const delta = providerChunkText(chunk);
                if (delta) {
                  answer += delta;
                  if (!prepared.hasCalendarToolCalls) {
                    send({ type: "delta", text: delta });
                    hasStreamedDelta = true;
                  }
                }
                if (chunk.usage) usage = chunk.usage;
                if (typeof chunk.choices?.[0]?.finish_reason === "string") finishReason = chunk.choices[0].finish_reason;
              } catch {
                /* Ignore provider keep-alive chunks. */
              }
            }
          }
        }
        // A few compatible providers end the final SSE data line without a
        // newline. Parse that buffered final chunk before judging it empty.
        if (buffer?.startsWith("data:")) {
          const text = buffer.slice(5).trim();
          if (text && text !== "[DONE]") {
            try {
              const chunk = JSON.parse(text);
              const delta = providerChunkText(chunk);
              if (delta) {
                answer += delta;
                if (!prepared.hasCalendarToolCalls) {
                  send({ type: "delta", text: delta });
                  hasStreamedDelta = true;
                }
              }
              if (chunk.usage) usage = chunk.usage;
              if (typeof chunk.choices?.[0]?.finish_reason === "string") finishReason = chunk.choices[0].finish_reason;
            } catch {
              /* Ignore a malformed final provider chunk. */
            }
          }
        }
        if (!answer && completion) {
          await diagnostic(env, { requestId: traceId, conversationId: conversation.id, level: "warn", event: "provider_stream_empty", provider: completion.telemetry?.provider, model: completion.telemetry?.model, durationMs: Date.now() - startedAt });
          // A successful HTTP stream can still close without a text delta. Retry
          // once without streaming so we never persist a false empty reply.
          await diagnostic(env, { requestId: traceId, conversationId: conversation.id, event: "provider_stream_retry_started", provider: completion.telemetry?.provider, model: completion.telemetry?.model });
          const retry = await qwen(
            env,
            { messages: prepared.messages, temperature: 0.6, max_tokens: body.thinking === true ? 4800 : 2400 },
            false,
            { reasoning: body.thinking === true, requestId: traceId, conversationId: conversation.id },
          );
          const retryPayload = await retry.response.json();
          answer = providerResponseText(retryPayload);
          usage = retryPayload.usage || usage;
          finishReason = retryPayload.choices?.[0]?.finish_reason || finishReason;
          completion = retry;
          await diagnostic(env, {
            requestId: traceId,
            conversationId: conversation.id,
            level: answer ? "info" : "warn",
            event: answer ? "provider_stream_retry_completed" : "provider_stream_retry_empty",
            provider: retry.telemetry?.provider,
            model: retry.telemetry?.model,
            durationMs: Date.now() - startedAt,
          });
        }
        if (containsInternalToolMarkup(answer)) answer = CALENDAR_UNAVAILABLE_MESSAGE;
        if (!answer) answer = "抱歉，这次没有生成回复。";
        if (prepared.hasCalendarToolCalls || !hasStreamedDelta) send({ type: "delta", text: answer });
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
        await diagnostic(env, { requestId: traceId, conversationId: conversation.id, event: "chat_completed", provider: completion?.telemetry?.provider, model: completion?.telemetry?.model, durationMs: Date.now() - startedAt, metadata: { response_length: answer.length, calendar_tools: Boolean(prepared.hasCalendarToolCalls), finish_reason: finishReason } });
      } catch (error) {
        await diagnostic(env, { requestId: traceId, conversationId: conversation.id, level: "error", event: "chat_failed", durationMs: Date.now() - startedAt, error });
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
