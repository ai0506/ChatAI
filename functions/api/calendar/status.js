import { json, requireUser } from "../../_lib/app.js";
import { hasCalendar } from "../../_lib/calendar.js";
export async function onRequestGet({ request, env }) { const auth = await requireUser(request, env); if (auth.response) return auth.response; return json({ connected: await hasCalendar(env) }); }
