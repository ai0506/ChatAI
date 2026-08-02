const OWNER_ID = "owner";
const SESSION_COOKIE = "chatai_session_v2";
const MAX_MESSAGE_LENGTH = 12000;
const MAX_CONTEXT_MESSAGES = 20;
const encoder = new TextEncoder();

export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify({ ok: status < 400, ...(status < 400 ? { data } : { error: data }) }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
export const fail = (code, message, status = 400) => json({ code, message }, status);
export const queryOne = (db, sql, values = []) => db.prepare(sql).bind(...values).first();
export const queryAll = async (db, sql, values = []) => (await db.prepare(sql).bind(...values).all()).results;
export const run = (db, sql, values = []) => db.prepare(sql).bind(...values).run();

function b64url(bytes) { let text = ""; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromB64url(value) { const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)); return Uint8Array.from(raw, x => x.charCodeAt(0)); }
async function hmac(value, secret) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))); }
export function safeEqual(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }

export async function createSession(secret) { const payload = b64url(encoder.encode(JSON.stringify({ sub: OWNER_ID, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }))); return `${payload}.${await hmac(payload, secret)}`; }
export async function currentUser(request, env) { const token = request.headers.get("Cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1); if (!token || !env.CHAT_SESSION_SECRET) return null; const dot = token.lastIndexOf("."); if (dot < 0 || !safeEqual(token.slice(dot + 1), await hmac(token.slice(0, dot), env.CHAT_SESSION_SECRET))) return null; try { const payload = JSON.parse(new TextDecoder().decode(fromB64url(token.slice(0, dot)))); return payload.sub === OWNER_ID && payload.exp > Math.floor(Date.now() / 1000) ? OWNER_ID : null; } catch { return null; } }
export const sessionHeader = (token, secure = true) => `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax; Max-Age=2592000`;
export const clearSessionHeader = (secure = true) => `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax; Max-Age=0`;
export async function requireUser(request, env) { const user = await currentUser(request, env); return user ? { user } : { response: fail("unauthorized", "请先登录", 401) }; }
export function requireSameOrigin(request) { const origin = request.headers.get("Origin"); return !origin || origin === new URL(request.url).origin; }
export async function readJson(request) { try { return await request.json(); } catch { return null; } }
export function validMessage(value) { return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_MESSAGE_LENGTH; }

async function aesKey(secret) { const material = await crypto.subtle.digest("SHA-256", encoder.encode(secret)); return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]); }
export async function encrypt(value, secret) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), encoder.encode(value)); return `${b64url(iv)}.${b64url(new Uint8Array(encrypted))}`; }
export async function decrypt(value, secret) { const [iv, encrypted] = String(value).split("."); if (!iv || !encrypted) throw new Error("保存的 Calendar 授权无效"); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await aesKey(secret), fromB64url(encrypted))); }
export function randomUrlToken(bytes = 32) { const buffer = crypto.getRandomValues(new Uint8Array(bytes)); return b64url(buffer); }
export async function pkceChallenge(verifier) { return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)))); }
export async function nextSequence(db, conversationId) { const row = await queryOne(db, "SELECT COALESCE(MAX(sequence), 0) AS value FROM messages WHERE conversation_id = ?", [conversationId]); return Number(row?.value || 0) + 1; }
export async function assertConversation(db, conversationId) { return queryOne(db, "SELECT * FROM conversations WHERE id = ? AND owner_id = ?", [conversationId, OWNER_ID]); }
export async function history(db, conversationId) { const rows = await queryAll(db, "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY sequence DESC LIMIT ?", [conversationId, MAX_CONTEXT_MESSAGES]); return rows.reverse(); }
export { OWNER_ID };
