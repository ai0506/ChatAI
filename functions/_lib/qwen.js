import { decrypt, OWNER_ID, queryOne } from "./app.js";
import { userContext } from "./persona.js";
import { PROVIDERS } from "./providers.js";
import { isReasoningParameterError, reasoningRequest } from "./reasoning.js";

const defaultBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
async function activeCredentials(env) {
  const profile = await queryOne(env.DB, "SELECT * FROM api_key_profiles WHERE owner_id = ? AND is_active = 1 LIMIT 1", [OWNER_ID]);
  if (profile) return { apiKey: await decrypt(profile.encrypted_api_key, env.CALENDAR_TOKEN_ENCRYPTION_KEY), model: profile.model, baseUrl: profile.base_url, provider: profile.provider, supportsTools: PROVIDERS[profile.provider]?.supportsTools === true, profileName: profile.name };
  return { apiKey: env.DASHSCOPE_API_KEY, model: env.QWEN_MODEL || "qwen-plus", baseUrl: env.QWEN_BASE_URL || defaultBaseUrl, provider: "qwen", supportsTools: true, profileName: "环境变量" };
}
export async function qwen(env, body, stream = false, options = {}) {
  const reasoning = reasoningRequest({ provider: "qwen", model: env.QWEN_MODEL || "qwen-plus" }, options.reasoning === true);
  if (env.MOCK_AI === "true") return { response: new Response(stream ? 'data: {"choices":[{"delta":{"content":"这是本地测试模式的模拟回复。"}}]}\n\ndata: [DONE]\n\n' : JSON.stringify({ choices: [{ message: { content: "这是本地测试模式的模拟回复。" } }], usage: { total_tokens: 0 } }), { headers: { "Content-Type": stream ? "text/event-stream" : "application/json" } }), reasoning };
  const credentials = await activeCredentials(env); if (!credentials.apiKey) throw new Error("请先在设置中添加 API Key");
  const requestedReasoning = reasoningRequest(credentials, options.reasoning === true);
  const request = (parameters = {}) => fetch(`${credentials.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credentials.apiKey}` }, body: JSON.stringify({ model: credentials.model, stream, ...(stream ? { stream_options: { include_usage: true } } : {}), ...body, ...parameters }) });
  let response = await request(requestedReasoning.parameters);
  if (!response.ok && requestedReasoning.enabled) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message || error?.message || "";
    if (isReasoningParameterError(response.status, message)) {
      response = await request();
      if (response.ok) return { response, reasoning: unavailableReasoning(message) };
    } else throw new Error(message || "AI 模型服务暂时不可用");
  }
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error?.error?.message || error?.message || "AI 模型服务暂时不可用"); }
  return { response, reasoning: requestedReasoning };
}
function unavailableReasoning(message) { return { enabled: false, parameters: {}, reason: `模型拒绝推理参数：${message.slice(0, 120)}` }; }
export async function activeModel(env) { return (await activeCredentials(env)).model; }
export async function activeProviderSupportsTools(env) { return (await activeCredentials(env)).supportsTools; }
export const systemPrompt = `你是 AI0506 Chat，一个谨慎、友善的个人助手。${userContext}`;
