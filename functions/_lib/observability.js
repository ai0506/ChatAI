import { id, now, run } from "./app.js";

const MAX_ERROR_LENGTH = 300;
const SECRET_PATTERN = /(Bearer\s+)[^\s,;]+|((?:api[_ -]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi;

export function requestId(request) {
  return request.headers.get("CF-Ray") || id();
}

export function safeError(error) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  return message.replace(SECRET_PATTERN, (_, bearer, field) => `${bearer || field}[redacted]`).replace(/\s+/g, " ").slice(0, MAX_ERROR_LENGTH);
}

// Logging must never turn an otherwise successful chat into a failed one.
export async function diagnostic(env, event) {
  const record = {
    id: id(), request_id: event.requestId, conversation_id: event.conversationId || null,
    level: event.level || "info", event: event.event, provider: event.provider || null,
    model: event.model || null, duration_ms: Number.isFinite(event.durationMs) ? Math.round(event.durationMs) : null,
    error_message: event.error ? safeError(event.error) : null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null, created_at: now(),
  };
  if (!env.DB) return;
  console.log(JSON.stringify({ service: "chatai", ...record }));
  try {
    await run(env.DB, "INSERT INTO diagnostic_events (id, request_id, conversation_id, level, event, provider, model, duration_ms, error_message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [record.id, record.request_id, record.conversation_id, record.level, record.event, record.provider, record.model, record.duration_ms, record.error_message, record.metadata, record.created_at]);
  } catch (error) {
    console.error(JSON.stringify({ service: "chatai", event: "diagnostic_write_failed", error: safeError(error), request_id: record.request_id }));
  }
}
