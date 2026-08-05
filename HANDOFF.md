# ChatAI project handoff

Generated: 2026-08-05 (Asia/Shanghai)

## Project overview

ChatAI is a private, single-user AI chat application. It provides a React chat interface, server-side OpenAI-compatible provider profiles, encrypted API-key storage, streaming responses, optional provider reasoning controls, automatic conversation titles, and read-only Calendar access through OAuth/MCP.

The working tree was reviewed on 2026-08-05. The source changes present at that time are committed to GitHub as part of this handoff. A local supplement archive preserves configuration and local D1 state that Git intentionally excludes.

## Technology stack

- Language: JavaScript (ES modules), SQL
- Frontend: React with Vite
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1; Wrangler/Miniflare local D1 state for local development
- Runtime observed on this computer: Node.js 24.16.0, npm 11.13.0, Wrangler 4.114.0
- Package manager: npm, using `package-lock.json`
- Third-party services: OpenAI-compatible AI providers, Zhipu GLM title generation, Cloudflare Pages/D1, and AI0506 Calendar OAuth/MCP

## Completed functionality

- Chat workspace with light/dark themes, responsive sidebar, conversation management, safe Markdown rendering, and copy actions.
- Server-side provider profiles for Qwen, DeepSeek, Zhipu, Doubao, Hunyuan, Qianfan, OpenAI, and a custom HTTPS OpenAI-compatible endpoint. Browser clients do not receive stored API keys.
- Provider model-directory lookup (`/models`) and manual model-ID entry.
- Streaming chat responses and restrained execution-status events; internal model reasoning is not displayed or stored.
- Provider-specific reasoning parameters with safe retry when a compatible upstream rejects those parameters.
- Automatic GLM-based conversation titles, including metadata-only diagnostics for missing configuration, upstream failures, timeouts, empty responses, and success.
- Read-only Calendar OAuth/MCP integration, Calendar intent routing, forced/automatic/off Calendar modes, argument normalization for date-only event queries, and fallback behavior for providers that omit tool calls.
- Safe diagnostics endpoint and D1 migration `0004_diagnostic_events.sql`; diagnostics redact obvious key/token/password values before recording an error.
- Test coverage in `tests/app.test.mjs` and `tests/providers.test.mjs`; `npm run check` is the project-wide build/syntax/test command.

## Outstanding items and known limitations

- No code TODO/FIXME/HACK markers were found in `src/`, `functions/`, `tests/`, or `migrations/`. (The broad text search also matches normal CSS `minmax`, so those hits are not TODOs.)
- The latest local source changes need full verification with `npm run check` after the migration; this handoff does not claim a new production deployment.
- Real-provider model lookup, streaming, and reasoning behavior still require browser-level validation for every account/model combination.
- Calendar OAuth/MCP needs an end-to-end authenticated browser check after migration; the connection record alone does not prove a model actually invoked Calendar.
- Cloudflare Pages version URL, stable Pages URL, custom domain, production D1 data, deployed environment variables, and Cloudflare account permissions are external state. They are not fully represented by either GitHub or this local archive.
- `npm run dev` is frontend-only and makes `/api/*` return 404. Use `npm run dev:local` for the complete local Pages Functions stack on port 8788.

## Environment variables

Copy `.dev.vars.example` to `.dev.vars` when starting from scratch. The supplement archive also contains this computer's `.dev.vars`; keep it private. Do not commit it.

| Variable | Purpose |
| --- | --- |
| `CHAT_PASSWORD` | Local/private application login password. |
| `CHAT_SESSION_SECRET` | Signs session data. |
| `DASHSCOPE_API_KEY` | Fallback Qwen/DashScope provider key. |
| `QWEN_BASE_URL` | Optional Qwen-compatible API base URL override. |
| `QWEN_MODEL` | Optional default Qwen model ID. |
| `ZHIPU_API_KEY` | Server-side key used for automatic GLM conversation titles. |
| `ZHIPU_MODEL` | Backward-compatible automatic-title model setting. |
| `ZHIPU_TITLE_MODEL` | Preferred automatic-title model setting, if used. |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Encrypts Calendar OAuth refresh tokens stored in D1. |
| `CALENDAR_MCP_URL` | Optional Calendar MCP endpoint override. |
| `CALENDAR_OAUTH_ISSUER` | Calendar OAuth issuer/authorization server setting. |
| `MOCK_AI` | Optional local test switch. Set only deliberately; it returns simulated AI responses. |
| `DB` | Cloudflare D1 binding supplied by Pages/Worker configuration, not normally placed in `.dev.vars`. |

## New-computer migration

1. Clone the repository: `git clone https://github.com/ai0506/ChatAI.git`, then enter the new `ChatAI` directory.
2. Verify the clone includes the handoff commit: `git log -1 --oneline` and `git status`.
3. Extract `ChatAI-local-supplement-20260805.zip` directly into the cloned project directory, allowing its files to merge. It intentionally has no `.git`, `node_modules`, or `dist` directory.
4. Confirm `.dev.vars` exists and remains private. If the archive is unavailable, create it from `.dev.vars.example` and supply valid values.
5. The archive contains `.wrangler/state/v3/d1` for this computer's local D1 database. Preserve it if you want local conversations, provider profiles, encrypted tokens, and diagnostics to resemble this machine. Do not run `npm run db:local` against a state you need to preserve unless you understand the migration state.
6. Install dependencies with `npm ci` (or `npm install` when intentionally updating dependencies).
7. Run `npm run check` to build, syntax-check Functions, and run tests.
8. Start the full local stack with `npm run dev:local`, then open `http://127.0.0.1:8788`.
9. Log in, verify an ordinary chat, a configured provider, streaming, and—if required—Calendar connection/tool behavior. Treat a successful local build as separate from production deployment verification.

## Important migration notes

- The local D1 database may contain encrypted values. Its contents are useful only together with the corresponding `CALENDAR_TOKEN_ENCRYPTION_KEY` in `.dev.vars`.
- The archive cannot replace Cloudflare account access, remote D1 contents, production secrets, OAuth application registration, or deployed Pages configuration. Check these in the Cloudflare dashboard before relying on production.
- Do not copy `node_modules`, `dist`, `.wrangler/tmp`, `.codex-local-logs`, or `.playwright-cli`; they are regenerable dependencies, build/cache output, or historical diagnostics.
