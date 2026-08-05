# File transfer list

Generated: 2026-08-05 (Asia/Shanghai). The archive is a supplement to a fresh GitHub clone, not a replacement for Git history.

| File/directory | GitHub status | In archive | Notes |
| --- | --- | --- | --- |
| `src/`, `functions/`, `migrations/`, `tests/` | Tracked; current work committed in handoff commit | Yes | Source, Functions, database migrations, and tests; included for resilience even though the clone provides them. |
| `public/`, `index.html`, `vite.config.js`, `wrangler.jsonc` | Tracked | Yes | Runtime/static configuration and assets. |
| `package.json`, `package-lock.json` | Tracked | Yes | Dependency manifest and lockfile; install dependencies on new computer. |
| `README.md`, `PROGRESS.md`, `PROVIDERS.md`, `FRONTEND_SPEC.md`, `AGENTS.md`, `updates.md` | Tracked | Yes | Project documentation, rules, and development history. |
| `HANDOFF.md`, `FILE_TRANSFER_LIST.md` | Tracked in handoff commit | Yes | New migration documentation. |
| `.dev.vars.example`, `.gitignore` | Tracked | Yes | Safe configuration template and ignore rules. |
| `.dev.vars` | Ignored/local only | Yes | Private local environment variables. Never commit; archive is for the owner only. |
| `.wrangler/state/v3/d1/` | Ignored/local only | Yes | Local D1 database and related SQLite files; preserves local application state. |
| `.wrangler/state/v3/cache/` | Ignored/regenerable cache | No | Local Miniflare cache, not application source/state required for normal recovery. |
| `.wrangler/tmp/` | Ignored/regenerable build cache | No | Generated local Pages/Functions bundles. |
| `.claude/` | Ignored/local only | Yes | Local Claude workspace launch/settings configuration; optional but preserved because it may aid workflow restoration. |
| `.git/` | Local Git metadata | No | New computer receives Git history by clone. |
| `node_modules/` | Ignored/regenerable dependency tree | No | Recreate with `npm ci`. |
| `dist/` | Ignored/regenerable build output | No | Recreate with `npm run build`. |
| `.codex-local-logs/` | Ignored historical logs | No | Diagnostic history, not needed to run the project. |
| `.playwright-cli/` | Ignored automation traces/logs | No | Historical browser automation artifacts, not required for recovery. |
| Cloudflare Pages/D1 production configuration, production D1 data, account permissions, remote secrets | Outside local folder/GitHub | No | Back up or verify separately in Cloudflare; neither clone nor archive restores cloud account state. |

## Archive scope

`ChatAI-local-supplement-20260805.zip` contains the project files except `.git`, `node_modules`, `dist`, `.codex-local-logs`, `.playwright-cli`, `.wrangler/tmp`, and `.wrangler/state/v3/cache`. It includes `.dev.vars`, `.wrangler/state/v3/d1`, and `.claude`.
