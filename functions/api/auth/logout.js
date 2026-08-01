import { clearSessionHeader, json } from "../../_lib/app.js";
export function onRequestPost() { return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionHeader() }); }
