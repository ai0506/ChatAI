import { fail, json, queryAll, requireUser } from "../../_lib/app.js";

const MAX_LIMIT = 100;

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isInteger(requested) ? Math.max(1, Math.min(requested, MAX_LIMIT)) : 50;
  const requestId = url.searchParams.get("request_id");
  if (requestId && requestId.length > 128) return fail("validation_error", "request_id is too long");
  const events = requestId
    ? await queryAll(env.DB, "SELECT id, request_id, conversation_id, level, event, provider, model, duration_ms, error_message, metadata, created_at FROM diagnostic_events WHERE request_id = ? ORDER BY created_at DESC LIMIT ?", [requestId, limit])
    : await queryAll(env.DB, "SELECT id, request_id, conversation_id, level, event, provider, model, duration_ms, error_message, metadata, created_at FROM diagnostic_events ORDER BY created_at DESC LIMIT ?", [limit]);
  return json({ events, limit });
}
