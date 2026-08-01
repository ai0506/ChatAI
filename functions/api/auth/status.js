import { currentUser, json } from "../../_lib/app.js";
export async function onRequestGet({ request, env }) { return json({ authenticated: Boolean(await currentUser(request, env)) }); }
