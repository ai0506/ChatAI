import assert from "node:assert/strict";
import { PROVIDERS, isSafeBaseUrl } from "../functions/_lib/providers.js";
import { extractModelIds, modelListUrl } from "../functions/_lib/model-catalog.js";

assert.equal(PROVIDERS.qwen.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
assert.equal(PROVIDERS.deepseek.baseUrl, "https://api.deepseek.com");
assert.equal(PROVIDERS.openai.supportsTools, true);
assert.equal(PROVIDERS.custom.supportsTools, false);
for (const provider of Object.values(PROVIDERS)) {
  if (provider === PROVIDERS.custom) continue;
  assert.match(provider.platformUrl, /^https:\/\//);
  assert.match(provider.docsUrl, /^https:\/\//);
}

for (const url of ["https://api.deepseek.com", "https://example.com/v1/"]) assert.equal(isSafeBaseUrl(url), true);
for (const url of ["http://example.com/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://192.168.1.2/v1", "https://user:pass@example.com/v1"]) assert.equal(isSafeBaseUrl(url), false);

assert.equal(modelListUrl("https://api.example.com/v1/"), "https://api.example.com/v1/models");
assert.deepEqual(extractModelIds({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }, { id: "not valid/model" }] }), ["a-model", "z-model"]);
assert.deepEqual(extractModelIds({ models: ["deepseek-chat", "deepseek-reasoner"] }), ["deepseek-chat", "deepseek-reasoner"]);

console.log("provider profile checks passed");
