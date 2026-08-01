import { encrypt, fail, now, queryOne, run } from "../_lib/app.js";
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url); const state = url.searchParams.get("state"); const code = url.searchParams.get("code"); const error = url.searchParams.get("error"); const origin = url.origin;
  if (error) return Response.redirect(`${origin}/?calendar_error=${encodeURIComponent(error)}`, 302);
  if (!state || !code) return fail("invalid_callback", "Calendar 授权回调缺少参数", 400);
  const attempt = await queryOne(env.DB, "SELECT * FROM calendar_oauth_attempts WHERE state = ?", [state]); await run(env.DB, "DELETE FROM calendar_oauth_attempts WHERE state = ?", [state]);
  if (!attempt || attempt.expires_at < Math.floor(Date.now() / 1000)) return Response.redirect(`${origin}/?calendar_error=expired`, 302);
  const issuer = env.CALENDAR_OAUTH_ISSUER || "https://calendar.ai0506.com";
  const response = await fetch(`${issuer}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: attempt.client_id, redirect_uri: attempt.redirect_uri, code_verifier: attempt.code_verifier }) });
  const token = await response.json().catch(() => ({})); if (!response.ok || !token.refresh_token || token.scope !== "calendar.read") return Response.redirect(`${origin}/?calendar_error=token`, 302);
  const encrypted = await encrypt(token.refresh_token, env.CALENDAR_TOKEN_ENCRYPTION_KEY); const timestamp = now();
  await run(env.DB, `INSERT INTO calendar_connections (owner_id, encrypted_refresh_token, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET encrypted_refresh_token = excluded.encrypted_refresh_token, client_id = excluded.client_id, updated_at = excluded.updated_at`, ["owner", encrypted, attempt.client_id, timestamp, timestamp]);
  return Response.redirect(`${origin}/?calendar_connected=1`, 302);
}
