import assert from "node:assert/strict";
import { PROVIDERS, isSafeBaseUrl } from "../functions/_lib/providers.js";

assert.equal(PROVIDERS.qwen.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
assert.equal(PROVIDERS.deepseek.baseUrl, "https://api.deepseek.com");
assert.equal(PROVIDERS.openai.supportsTools, true);
assert.equal(PROVIDERS.custom.supportsTools, false);

for (const url of ["https://api.deepseek.com", "https://example.com/v1/"]) assert.equal(isSafeBaseUrl(url), true);
for (const url of ["http://example.com/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://192.168.1.2/v1", "https://user:pass@example.com/v1"]) assert.equal(isSafeBaseUrl(url), false);

console.log("provider profile checks passed");
