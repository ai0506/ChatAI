import { decrypt, encrypt, now, OWNER_ID, queryOne, run } from "./app.js";

const READ_TOOL_NAMES = new Set(["calendar_list_events", "calendar_list_categories", "calendar_list_tags", "calendar_list_deadlines", "calendar_get_deadline", "calendar_get_event_series"]);
const CHINA_TIMEZONE = "+08:00";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

function normalizeEventTime(value, endOfDay = false) {
  if (typeof value !== "string") return value;
  const input = value.trim();
  if (DATE_ONLY.test(input))
    return `${input}T${endOfDay ? "23:59:59.999" : "00:00:00"}${CHINA_TIMEZONE}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input) && !HAS_TIMEZONE.test(input))
    return `${input}${CHINA_TIMEZONE}`;
  return input;
}

// Models naturally emit dates such as 2026-08-02. Calendar events require a
// complete ISO 8601 instant, so normalize predictable date-only/local forms
// before the MCP call instead of making a whole Calendar request fail.
export function normalizeCalendarToolArgs(name, args = {}) {
  if (name !== "calendar_list_events" || !args || typeof args !== "object") return args || {};
  return {
    ...args,
    ...(args.from === undefined ? {} : { from: normalizeEventTime(args.from) }),
    ...(args.to === undefined ? {} : { to: normalizeEventTime(args.to, true) }),
  };
}
const toolDefinitions = [
  { type: "function", function: { name: "calendar_list_events", description: "查询日历事件。未给日期时查询未来 30 天。", parameters: { type: "object", properties: { from: { type: "string", description: "ISO 8601 起始时间" }, to: { type: "string", description: "ISO 8601 结束时间" }, category: { type: "string" } } } } },
  { type: "function", function: { name: "calendar_list_deadlines", description: "查询 Deadline。未给日期时查询未来 30 天。", parameters: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" }, category: { type: "string" }, completed: { type: "boolean" } } } } },
  { type: "function", function: { name: "calendar_get_deadline", description: "查询某个 Deadline 的详情；仅在已经知道其 id 时使用。", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function", function: { name: "calendar_get_event_series", description: "查询某个重复事件系列；仅在已经知道其 series_id 时使用。", parameters: { type: "object", properties: { series_id: { type: "string" } }, required: ["series_id"] } } }
];

export const calendarTools = () => toolDefinitions;
export async function hasCalendar(env) { return Boolean(await queryOne(env.DB, "SELECT owner_id FROM calendar_connections WHERE owner_id = ?", [OWNER_ID])); }
async function refreshAccessToken(env, connection) {
  const issuer = env.CALENDAR_OAUTH_ISSUER || "https://calendar.ai0506.com";
  const refreshToken = await decrypt(connection.encrypted_refresh_token, env.CALENDAR_TOKEN_ENCRYPTION_KEY);
  const response = await fetch(`${issuer}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: connection.client_id }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token || !data.refresh_token) throw new Error("Calendar 授权已失效，请重新连接。");
  await run(env.DB, "UPDATE calendar_connections SET encrypted_refresh_token = ?, updated_at = ? WHERE owner_id = ?", [await encrypt(data.refresh_token, env.CALENDAR_TOKEN_ENCRYPTION_KEY), now(), OWNER_ID]);
  return data.access_token;
}
export async function callCalendarTool(env, name, args) {
  if (!READ_TOOL_NAMES.has(name)) throw new Error("此 Calendar 工具没有只读权限");
  const connection = await queryOne(env.DB, "SELECT * FROM calendar_connections WHERE owner_id = ?", [OWNER_ID]);
  if (!connection) throw new Error("尚未连接 Calendar");
  const accessToken = await refreshAccessToken(env, connection);
  const normalizedArgs = normalizeCalendarToolArgs(name, args);
  const response = await fetch(env.CALENDAR_MCP_URL || "https://calendar.ai0506.com/mcp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name, arguments: normalizedArgs } }) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error || data?.result?.isError) throw new Error(data?.error?.message || data?.result?.content?.[0]?.text || "Calendar 查询失败");
  return data.result?.structuredContent ?? data.result?.content?.[0]?.text ?? {};
}
