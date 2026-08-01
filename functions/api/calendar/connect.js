import { fail, id, now, pkceChallenge, randomUrlToken, requireSameOrigin, requireUser, run } from "../../_lib/app.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (!requireSameOrigin(request)) return fail("forbidden", "来源不正确", 403);
  const origin = new URL(request.url).origin; const issuer = env.CALENDAR_OAUTH_ISSUER || "https://calendar.ai0506.com"; const redirectUri = `${origin}/calendar/callback`;
  const registration = await fetch(`${issuer}/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "AI0506 Chat", redirect_uris: [redirectUri], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: "calendar.read" }) });
  const client = await registration.json().catch(() => ({})); if (!registration.ok || !client.client_id) return fail("calendar_unavailable", "无法启动 Calendar 授权，请稍后重试", 502);
  const state = randomUrlToken(); const verifier = randomUrlToken(48); const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await run(env.DB, "INSERT INTO calendar_oauth_attempts (state, code_verifier, client_id, redirect_uri, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)", [state, verifier, client.client_id, redirectUri, expiresAt, now()]);
  const url = new URL(`${issuer}/oauth/authorize`); url.search = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: redirectUri, scope: "calendar.read", resource: `${issuer}/mcp`, code_challenge: await pkceChallenge(verifier), code_challenge_method: "S256", state }).toString();
  return Response.redirect(url.toString(), 302);
}
