import { encrypt, fail, json, now, readJson, requireSameOrigin, requireUser, run } from "../../_lib/app.js";
import { isSafeBaseUrl } from "../../_lib/providers.js";

const validName = value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 50;
const validModel = value => typeof value === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(value);

// 空 body 表示「切换到这个配置」；带字段则表示「编辑这个配置」，编辑不改变启用状态。
export async function onRequestPatch({ request, env, params }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const existing = await env.DB.prepare("SELECT id FROM api_key_profiles WHERE id = ? AND owner_id = ?").bind(params.id, auth.user).first(); if (!existing) return fail("not_found", "API Key 配置不存在", 404);
  const body = await readJson(request) || {};
  const editing = ["name", "model", "base_url", "api_key"].some(field => body[field] !== undefined);

  if (!editing) {
    await env.DB.batch([env.DB.prepare("UPDATE api_key_profiles SET is_active = 0 WHERE owner_id = ?").bind(auth.user), env.DB.prepare("UPDATE api_key_profiles SET is_active = 1, updated_at = ? WHERE id = ? AND owner_id = ?").bind(now(), params.id, auth.user)]);
    return json({ id: params.id, is_active: true });
  }

  const name = body.name?.trim(); const model = body.model?.trim(); const baseUrl = body.base_url?.trim().replace(/\/$/, ""); const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!validName(name) || !validModel(model) || !isSafeBaseUrl(baseUrl)) return fail("validation_error", "请填写名称、HTTPS 接口地址和模型名称");
  if (apiKey && apiKey.length < 8) return fail("validation_error", "API Key 长度不足");
  if (apiKey && !env.CALENDAR_TOKEN_ENCRYPTION_KEY) return fail("not_configured", "服务器缺少加密密钥", 500);

  const timestamp = now();
  // 留空表示不更换 Key，只改其他字段
  if (apiKey) await run(env.DB, "UPDATE api_key_profiles SET name = ?, model = ?, base_url = ?, encrypted_api_key = ?, updated_at = ? WHERE id = ? AND owner_id = ?", [name, model, baseUrl, await encrypt(apiKey, env.CALENDAR_TOKEN_ENCRYPTION_KEY), timestamp, params.id, auth.user]);
  else await run(env.DB, "UPDATE api_key_profiles SET name = ?, model = ?, base_url = ?, updated_at = ? WHERE id = ? AND owner_id = ?", [name, model, baseUrl, timestamp, params.id, auth.user]);
  return json({ id: params.id, name, model, base_url: baseUrl, updated_at: timestamp });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const result = await run(env.DB, "DELETE FROM api_key_profiles WHERE id = ? AND owner_id = ?", [params.id, auth.user]); if (!result.meta?.changes) return fail("not_found", "API Key 配置不存在", 404);
  return json({ id: params.id, deleted: true });
}
