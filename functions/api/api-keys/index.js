import { encrypt, fail, id, json, now, queryAll, readJson, requireSameOrigin, requireUser, run } from "../../_lib/app.js";
import { isSafeBaseUrl, PROVIDERS } from "../../_lib/providers.js";

const validName = value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 50;
const validModel = value => typeof value === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(value);

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const profiles = await queryAll(env.DB, "SELECT id, name, provider, base_url, model, is_active, created_at, updated_at FROM api_key_profiles WHERE owner_id = ? ORDER BY is_active DESC, updated_at DESC", [auth.user]);
  return json({ profiles, providers: Object.entries(PROVIDERS).map(([id, provider]) => ({ id, ...provider })), environment_fallback_available: Boolean(env.DASHSCOPE_API_KEY) });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const body = await readJson(request); const name = body?.name?.trim(); const apiKey = body?.api_key?.trim(); const provider = body?.provider; const preset = PROVIDERS[provider]; const model = body?.model?.trim(); const baseUrl = body?.base_url?.trim().replace(/\/$/, "");
  if (!validName(name) || typeof apiKey !== "string" || apiKey.length < 8 || !preset || !validModel(model) || !isSafeBaseUrl(baseUrl)) return fail("validation_error", "请填写名称、有效 API Key、供应商、HTTPS 接口地址和模型名称");
  if (!env.CALENDAR_TOKEN_ENCRYPTION_KEY) return fail("not_configured", "服务器缺少加密密钥", 500);
  const timestamp = now(); const profile = { id: id(), name, provider, base_url: baseUrl, model, is_active: 1, created_at: timestamp, updated_at: timestamp };
  await env.DB.batch([
    env.DB.prepare("UPDATE api_key_profiles SET is_active = 0 WHERE owner_id = ?").bind(auth.user),
    env.DB.prepare("INSERT INTO api_key_profiles (id, owner_id, name, encrypted_api_key, provider, base_url, model, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(profile.id, auth.user, name, await encrypt(apiKey, env.CALENDAR_TOKEN_ENCRYPTION_KEY), provider, baseUrl, model, timestamp, timestamp),
  ]);
  return json(profile, 201);
}
