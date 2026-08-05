import assert from "node:assert/strict";
import { createSession, currentUser, decrypt, encrypt, safeEqual } from "../functions/_lib/app.js";
import { qwen, systemPrompt } from "../functions/_lib/qwen.js";
import { isReasoningParameterError, reasoningRequest } from "../functions/_lib/reasoning.js";
import { generateConversationTitle, ZHIPU_TITLE_MODEL } from "../functions/_lib/title.js";
import { containsInternalToolMarkup, providerChunkText, providerResponseText, shouldCheckCalendar } from "../functions/api/chat.js";
import { safeError } from "../functions/_lib/observability.js";
import { normalizeCalendarToolArgs } from "../functions/_lib/calendar.js";
import { onRequestPost as postChat } from "../functions/api/chat.js";

assert.equal(safeEqual("same", "same"), true);
assert.equal(safeEqual("same", "other"), false);
const secret = "a test-only secret";
const token = await createSession(secret);
assert.equal(await currentUser(new Request("https://chat.example/api", { headers: { Cookie: `chatai_session_v2=${token}` } }), { CHAT_SESSION_SECRET: secret }), "owner");
const encrypted = await encrypt("refresh-token", secret);
assert.equal(await decrypt(encrypted, secret), "refresh-token");
const mockResponse = await qwen({ MOCK_AI: "true" }, { messages: [] }, true, { reasoning: true });
assert.match(await mockResponse.response.text(), /本地测试模式/);
assert.equal(mockResponse.reasoning.enabled, true);
assert.deepEqual(reasoningRequest({ provider: "qwen", model: "qwen-plus" }, true).parameters, { enable_thinking: true });
assert.deepEqual(reasoningRequest({ provider: "deepseek", model: "deepseek-v4-flash" }, true).parameters, { thinking: { type: "enabled" }, reasoning_effort: "high" });
assert.equal(reasoningRequest({ provider: "openai", model: "gpt-4.1-mini" }, true).enabled, false);
assert.equal(isReasoningParameterError(400, "Unknown parameter: enable_thinking"), true);
assert.equal(containsInternalToolMarkup("<｜DSML｜tool_calls>"), true);
assert.equal(containsInternalToolMarkup("今天没有安排。"), false);
assert.equal(providerChunkText({ choices: [{ delta: { content: "stream text" } }] }), "stream text");
assert.equal(providerChunkText({ choices: [{ message: { content: "final text" } }] }), "final text");
assert.equal(providerResponseText({ choices: [{ message: { content: "non-stream text" } }] }), "non-stream text");
assert.deepEqual(normalizeCalendarToolArgs("calendar_list_events", { from: "2026-08-02", to: "2026-08-03" }), { from: "2026-08-02T00:00:00+08:00", to: "2026-08-03T23:59:59.999+08:00" });
assert.deepEqual(normalizeCalendarToolArgs("calendar_list_events", { from: "2026-08-02T09:30" }), { from: "2026-08-02T09:30+08:00" });
assert.deepEqual(normalizeCalendarToolArgs("calendar_list_deadlines", { from: "2026-08-02" }), { from: "2026-08-02" });
assert.equal(shouldCheckCalendar("帮我看一下本周日程"), true);
assert.equal(shouldCheckCalendar("那明天呢？"), true);
assert.equal(shouldCheckCalendar("解释一下闭包"), false);
assert.equal(safeError("Bearer sk-secret-value failed"), "Bearer [redacted] failed");
assert.equal(shouldCheckCalendar("\u770b\u770b\u6700\u8fd1", [{ role: "user", content: "\u6211\u4eca\u5929\u4ec0\u4e48\u5b89\u6392" }, { role: "assistant", content: "\u4f60\u7684\u65e5\u5386\u4eca\u5929\u6ca1\u6709\u5b89\u6392\u3002" }]), true);
assert.equal(shouldCheckCalendar("\u770b\u770b\u6700\u8fd1", [{ role: "user", content: "\u89e3\u91ca\u4e00\u4e2a\u95ee\u9898" }, { role: "assistant", content: "\u8fd9\u662f\u4e00\u4e2a\u6280\u672f\u89e3\u91ca\u3002" }]), false);
assert.equal(safeError("api_key=private-value"), "api_key=[redacted]");
assert.match(systemPrompt, /prefers to be called Asw/);
assert.match(systemPrompt, /Calendar access in this app is read-only/);
const originalFetch = globalThis.fetch;
let titleRequest;
globalThis.fetch = async (url, options) => {
  titleRequest = { url, body: JSON.parse(options.body) };
  return new Response(JSON.stringify({ choices: [{ message: { content: "  \"Summer study plan\"  " } }] }));
};
try {
  assert.equal(await generateConversationTitle({ ZHIPU_API_KEY: "test-key" }, "Help me plan summer study."), "Summer study plan");
  assert.equal(titleRequest.url, "https://open.bigmodel.cn/api/paas/v4/chat/completions");
  assert.equal(titleRequest.body.model, ZHIPU_TITLE_MODEL);
  assert.match(titleRequest.body.messages[0].content, /at most 8 Chinese characters/);
  assert.equal(titleRequest.body.messages[1].content, "<user_message>\nHelp me plan summer study.\n</user_message>");
  assert.equal(await generateConversationTitle({}, "No key"), null);
  assert.equal(await generateConversationTitle({ ZHIPU_API_KEY: "test-key", ZHIPU_MODEL: "glm-configured" }, "Help me plan summer study."), "Summer study plan");
  assert.equal(titleRequest.body.model, "glm-configured");
} finally {
  globalThis.fetch = originalFetch;
}
const fakeDb = {
  prepare() {
    return {
      bind() {
        return {
          first: async () => null,
          run: async () => ({}),
        };
      },
    };
  },
};
const qwenRequests = [];
globalThis.fetch = async (_url, options) => {
  qwenRequests.push(JSON.parse(options.body));
  if (qwenRequests.length === 1)
    return new Response(JSON.stringify({ error: { message: "Unknown parameter: enable_thinking" } }), { status: 400 });
  return new Response(JSON.stringify({ choices: [{ message: { content: "retry succeeded" } }] }));
};
try {
  const retried = await qwen(
    { DB: fakeDb, DASHSCOPE_API_KEY: "test-key", QWEN_BASE_URL: "https://example.test/v1", QWEN_MODEL: "qwen-plus" },
    { messages: [], tools: [], tool_choice: "auto" },
    false,
    { reasoning: true, requestId: "test-request", conversationId: "test-conversation" },
  );
  assert.equal(qwenRequests[0].tool_choice, "auto");
  assert.equal(qwenRequests.length, 2);
  assert.equal(retried.reasoning.enabled, false);
  assert.deepEqual(retried.telemetry, { provider: "qwen", model: "qwen-plus" });
} finally {
  globalThis.fetch = originalFetch;
}
const calendarSecret = "calendar-test-secret";
const calendarMessages = [
  { role: "user", content: "\u6211\u4eca\u5929\u4ec0\u4e48\u5b89\u6392", sequence: 1 },
  { role: "assistant", content: "\u4f60\u7684\u65e5\u5386\u4eca\u5929\u6ca1\u6709\u5b89\u6392\u3002", sequence: 2 },
];
const calendarConnection = {
  owner_id: "owner",
  encrypted_refresh_token: await encrypt("calendar-refresh", calendarSecret),
  client_id: "calendar-client",
};
const chatDiagnosticEvents = [];
const chatDb = {
  prepare(sql) {
    return {
      bind(...values) {
        return {
          first: async () => {
            if (sql.includes("FROM conversations")) return { id: "calendar-conversation", owner_id: "owner", title: "\u4e0a\u6b21\u65e5\u7a0b", updated_at: "" };
            if (sql.includes("FROM calendar_connections")) return calendarConnection;
            if (sql.includes("FROM api_key_profiles")) return null;
            if (sql.includes("MAX(sequence)")) return { value: calendarMessages.length };
            return null;
          },
          all: async () => ({ results: sql.includes("SELECT role, content FROM messages") ? [...calendarMessages].sort((a, b) => a.sequence - b.sequence).map(({ role, content }) => ({ role, content })) : [] }),
          run: async () => {
            if (sql.includes("INSERT INTO messages")) calendarMessages.push({ role: values[2], content: values[3], sequence: values[5] });
            if (sql.includes("UPDATE calendar_connections")) calendarConnection.encrypted_refresh_token = values[0];
            if (sql.includes("INSERT INTO diagnostic_events")) chatDiagnosticEvents.push(values[4]);
            return {};
          },
        };
      },
    };
  },
};
const chatCalls = [];
let returnEmptyStream = false;
let returnNoToolCall = false;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  if (requestUrl === "https://example.test/v1/chat/completions") {
    const body = JSON.parse(options.body);
    chatCalls.push(body);
    if (body.stream) return new Response(returnEmptyStream ? "data: [DONE]\n\n" : 'data: {"choices":[{"delta":{"content":"Upcoming calendar items."}}]}\n\ndata: [DONE]\n\n');
    if (body.tools) return new Response(JSON.stringify({ choices: [{ message: returnNoToolCall ? { content: "I will check the calendar." } : { tool_calls: [{ id: "calendar-call", function: { name: "calendar_list_events", arguments: "{}" } }] } }] }));
    return new Response(JSON.stringify({ choices: [{ message: { content: "Recovered non-stream reply." } }] }));
  }
  if (requestUrl === "https://calendar.test/oauth/token") return new Response(JSON.stringify({ access_token: "access", refresh_token: "calendar-refresh" }));
  if (requestUrl === "https://calendar.test/mcp") return new Response(JSON.stringify({ result: { structuredContent: { events: [] } } }));
  throw new Error(`Unexpected fetch ${requestUrl}`);
};
try {
  const session = await createSession("chat-test-secret");
  const response = await postChat({
    request: new Request("https://chat.example/api/chat", {
      method: "POST",
      headers: { Origin: "https://chat.example", Cookie: `chatai_session_v2=${session}`, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: "calendar-conversation", message: "\u770b\u770b\u6700\u8fd1" }),
    }),
    env: { DB: chatDb, CHAT_SESSION_SECRET: "chat-test-secret", CALENDAR_TOKEN_ENCRYPTION_KEY: calendarSecret, CALENDAR_OAUTH_ISSUER: "https://calendar.test", CALENDAR_MCP_URL: "https://calendar.test/mcp", DASHSCOPE_API_KEY: "test-key", QWEN_BASE_URL: "https://example.test/v1", QWEN_MODEL: "qwen-plus" },
  });
  const events = await response.text();
  assert.match(events, /Upcoming calendar items/);
  assert.equal(chatCalls[0].tool_choice, "auto");
  assert.match(chatCalls[0].messages.at(-1).content, /MUST call the appropriate Calendar tool/);
  assert.equal(chatCalls[1].stream, true);
  returnNoToolCall = true;
  const directFallback = await postChat({
    request: new Request("https://chat.example/api/chat", {
      method: "POST",
      headers: { Origin: "https://chat.example", Cookie: `chatai_session_v2=${session}`, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: "calendar-conversation", message: "\u770b\u770b\u6700\u8fd1" }),
    }),
    env: { DB: chatDb, CHAT_SESSION_SECRET: "chat-test-secret", CALENDAR_TOKEN_ENCRYPTION_KEY: calendarSecret, CALENDAR_OAUTH_ISSUER: "https://calendar.test", CALENDAR_MCP_URL: "https://calendar.test/mcp", DASHSCOPE_API_KEY: "test-key", QWEN_BASE_URL: "https://example.test/v1", QWEN_MODEL: "qwen-plus" },
  });
  assert.match(await directFallback.text(), /Upcoming calendar items/);
  assert.ok(chatDiagnosticEvents.includes("calendar_tool_fallback"));
  returnNoToolCall = false;
  returnEmptyStream = true;
  const recovered = await postChat({
    request: new Request("https://chat.example/api/chat", {
      method: "POST",
      headers: { Origin: "https://chat.example", Cookie: `chatai_session_v2=${session}`, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: "calendar-conversation", message: "\u89e3\u91ca\u4e00\u4e2a\u6982\u5ff5" }),
    }),
    env: { DB: chatDb, CHAT_SESSION_SECRET: "chat-test-secret", CALENDAR_TOKEN_ENCRYPTION_KEY: calendarSecret, CALENDAR_OAUTH_ISSUER: "https://calendar.test", CALENDAR_MCP_URL: "https://calendar.test/mcp", DASHSCOPE_API_KEY: "test-key", QWEN_BASE_URL: "https://example.test/v1", QWEN_MODEL: "qwen-plus" },
  });
  assert.match(await recovered.text(), /Recovered non-stream reply/);
  assert.equal(chatCalls.at(-1).stream, false);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ChatAI unit tests passed");
