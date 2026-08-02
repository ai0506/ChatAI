import { decrypt, fail, json, queryOne, readJson, requireSameOrigin, requireUser } from "../../_lib/app.js";
import { extractModelIds, modelListUrl } from "../../_lib/model-catalog.js";
import { isSafeBaseUrl, PROVIDERS } from "../../_lib/providers.js";

const validKey = (value) => typeof value === "string" && value.trim().length >= 8;

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const body = await readJson(request) || {};
  let apiKey = body.api_key?.trim();
  let baseUrl = body.base_url?.trim().replace(/\/$/, "");

  if (typeof body.profile_id === "string") {
    const profile = await queryOne(env.DB, "SELECT encrypted_api_key, base_url FROM api_key_profiles WHERE id = ? AND owner_id = ?", [body.profile_id, auth.user]);
    if (!profile) return fail("not_found", "API Key 配置不存在", 404);
    if (!env.CALENDAR_TOKEN_ENCRYPTION_KEY) return fail("not_configured", "服务器缺少加密密钥", 500);
    apiKey = await decrypt(profile.encrypted_api_key, env.CALENDAR_TOKEN_ENCRYPTION_KEY);
    baseUrl = profile.base_url;
  } else if (!PROVIDERS[body.provider]) return fail("validation_error", "请选择供应商");

  if (!validKey(apiKey) || !isSafeBaseUrl(baseUrl)) return fail("validation_error", "请先填写有效 API Key 和 HTTPS 接口地址");
  let response;
  try {
    response = await fetch(modelListUrl(baseUrl), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  } catch {
    return fail("upstream_unavailable", "无法连接到该平台的模型列表接口", 502);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) return fail("upstream_error", payload?.error?.message || payload?.message || `模型列表接口返回 ${response.status}`, 502);
  const models = extractModelIds(payload);
  if (!models.length) return fail("unsupported", "该平台没有返回可用于本应用的模型标识，请手动填写", 422);
  return json({ models, source: "platform" });
}
