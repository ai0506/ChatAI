import assert from "node:assert/strict";
import { createSession, currentUser, decrypt, encrypt, safeEqual } from "../functions/_lib/app.js";
import { qwen, systemPrompt } from "../functions/_lib/qwen.js";
import { isReasoningParameterError, reasoningRequest } from "../functions/_lib/reasoning.js";
import { generateConversationTitle, ZHIPU_TITLE_MODEL } from "../functions/_lib/title.js";
import { containsInternalToolMarkup, shouldCheckCalendar } from "../functions/api/chat.js";

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
assert.equal(shouldCheckCalendar("帮我看一下本周日程"), true);
assert.equal(shouldCheckCalendar("那明天呢？"), true);
assert.equal(shouldCheckCalendar("解释一下闭包"), false);
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
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ChatAI unit tests passed");
