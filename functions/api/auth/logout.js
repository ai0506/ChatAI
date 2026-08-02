import { clearSessionHeader, json } from "../../_lib/app.js";
export function onRequestPost({ request }) { return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionHeader(new URL(request.url).protocol === "https:") }); }
