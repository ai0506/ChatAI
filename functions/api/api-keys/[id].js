import { fail, json, now, requireSameOrigin, requireUser, run } from "../../_lib/app.js";

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const existing = await env.DB.prepare("SELECT id FROM api_key_profiles WHERE id = ? AND owner_id = ?").bind(params.id, auth.user).first(); if (!existing) return fail("not_found", "API Key 配置不存在", 404);
  await env.DB.batch([env.DB.prepare("UPDATE api_key_profiles SET is_active = 0 WHERE owner_id = ?").bind(auth.user), env.DB.prepare("UPDATE api_key_profiles SET is_active = 1, updated_at = ? WHERE id = ? AND owner_id = ?").bind(now(), params.id, auth.user)]);
  return json({ id: params.id, is_active: true });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const result = await run(env.DB, "DELETE FROM api_key_profiles WHERE id = ? AND owner_id = ?", [params.id, auth.user]); if (!result.meta?.changes) return fail("not_found", "API Key 配置不存在", 404);
  return json({ id: params.id, deleted: true });
}
