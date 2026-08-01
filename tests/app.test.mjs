import assert from "node:assert/strict";
import { createSession, currentUser, decrypt, encrypt, safeEqual } from "../functions/_lib/app.js";
import { qwen } from "../functions/_lib/qwen.js";

assert.equal(safeEqual("same", "same"), true);
assert.equal(safeEqual("same", "other"), false);
const secret = "a test-only secret";
const token = await createSession(secret);
assert.equal(await currentUser(new Request("https://chat.example/api", { headers: { Cookie: `chatai_session=${token}` } }), { CHAT_SESSION_SECRET: secret }), "owner");
const encrypted = await encrypt("refresh-token", secret);
assert.equal(await decrypt(encrypted, secret), "refresh-token");
const mockResponse = await qwen({ MOCK_AI: "true" }, { messages: [] }, true);
assert.match(await mockResponse.text(), /本地测试模式/);
console.log("ChatAI unit tests passed");
