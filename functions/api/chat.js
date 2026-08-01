import { assertConversation, fail, history, id, json, nextSequence, now, readJson, requireSameOrigin, requireUser, run, validMessage } from "../_lib/app.js";
import { callCalendarTool, calendarTools, hasCalendar } from "../_lib/calendar.js";
import { activeModel, activeProviderSupportsTools, qwen, systemPrompt } from "../_lib/qwen.js";

const event = payload => `data: ${JSON.stringify(payload)}\n\n`;
const titleFor = message => message.replace(/\s+/g, " ").slice(0, 30) || "新对话";

async function saveMessage(db, conversationId, role, content) { await run(db, "INSERT INTO messages (id, conversation_id, role, content, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?)", [id(), conversationId, role, content, now(), await nextSequence(db, conversationId)]); }
async function logUsage(db, conversationId, model, usage) { if (!usage) return; await run(db, "INSERT INTO usage_records (id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id(), conversationId, model, usage.prompt_tokens ?? null, usage.completion_tokens ?? null, usage.total_tokens ?? null, now()]); }

async function buildMessages(env, baseMessages, calendarEnabled) {
  const messages = [{ role: "system", content: systemPrompt }, ...baseMessages];
  if (!calendarEnabled) return { messages, tools: undefined };
  const first = await qwen(env, { messages, tools: calendarTools(), tool_choice: "auto", temperature: 0.4, max_tokens: 800 });
  const initial = await first.json(); const choice = initial.choices?.[0]?.message;
  if (!choice) throw new Error("模型没有返回有效回复");
  await logUsage(env.DB, baseMessages.conversationId, await activeModel(env), initial.usage);
  if (!choice.tool_calls?.length) return { messages, direct: choice.content || "" };
  messages.push(choice);
  for (const toolCall of choice.tool_calls.slice(0, 3)) {
    let content;
    try { const args = JSON.parse(toolCall.function.arguments || "{}"); content = JSON.stringify(await callCalendarTool(env, toolCall.function.name, args)); } catch (error) { content = JSON.stringify({ error: error.message }); }
    messages.push({ role: "tool", tool_call_id: toolCall.id, content });
  }
  return { messages, tools: undefined };
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const body = await readJson(request); if (!body || typeof body.conversation_id !== "string" || !validMessage(body.message)) return fail("validation_error", "消息不能为空且最多 12000 字符");
  const conversation = await assertConversation(env.DB, body.conversation_id); if (!conversation) return fail("not_found", "会话不存在", 404);
  await saveMessage(env.DB, conversation.id, "user", body.message.trim());
  if (conversation.title === "新对话") await run(env.DB, "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", [titleFor(body.message), now(), conversation.id]); else await run(env.DB, "UPDATE conversations SET updated_at = ? WHERE id = ?", [now(), conversation.id]);
  const stream = new ReadableStream({
    async start(controller) {
      const send = data => controller.enqueue(new TextEncoder().encode(event(data)));
      try {
        const prior = await history(env.DB, conversation.id); prior.conversationId = conversation.id;
        const prepared = await buildMessages(env, prior, (await hasCalendar(env)) && (await activeProviderSupportsTools(env)));
        if (prepared.direct !== undefined) { await saveMessage(env.DB, conversation.id, "assistant", prepared.direct); send({ type: "delta", text: prepared.direct }); send({ type: "done" }); controller.close(); return; }
        const response = await qwen(env, { messages: prepared.messages, temperature: 0.6, max_tokens: 1200 }, true);
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "", answer = "", usage = null;
        while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data:")) continue; const text = line.slice(5).trim(); if (text === "[DONE]") continue; try { const chunk = JSON.parse(text); const delta = chunk.choices?.[0]?.delta?.content || ""; if (delta) { answer += delta; send({ type: "delta", text: delta }); } if (chunk.usage) usage = chunk.usage; } catch { /* Ignore provider keep-alive chunks. */ } } }
        if (!answer) answer = "抱歉，这次没有生成回复。"; await saveMessage(env.DB, conversation.id, "assistant", answer); await logUsage(env.DB, conversation.id, await activeModel(env), usage); send({ type: "done" });
      } catch (error) { send({ type: "error", message: error.message || "AI 服务暂时不可用，请稍后重试。" }); }
      finally { controller.close(); }
    }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
