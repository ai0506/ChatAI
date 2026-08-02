# AGENTS.md

## 动前端代码前必读

**任何涉及界面的改动，先完整阅读 [`FRONTEND_SPEC.md`](./FRONTEND_SPEC.md)。**

那份文件里写明了两条最高原则（稳定压倒一切、视觉做减法）、配色 token、聊天界面形态，以及一份**真实发生过并被要求返工的错误案例清单**（每条都配了正确写法）。里面的红线不是建议，是验收标准。

改完界面必须逐条跑 `FRONTEND_SPEC.md` 第 5 节的自查清单，并说明实测结果，不要只说「已完成」。

## 项目结构

- `src/` — React 前端（`main.jsx` 应用主体、`markdown.jsx` 安全的 Markdown 渲染、`styles.css` 设计系统、`provider.css` 设置面板）
- `functions/` — Cloudflare Pages Functions 后端（D1 数据库）
- `tests/` — Node 原生测试

## 常用命令

```bash
npm run dev         # 仅前端（Vite），不加载 functions/，/api/* 全部 404
npm run dev:local   # 完整本地栈（wrangler pages dev），会加载 .dev.vars，端口 8788
npm run check       # 构建 + 后端语法检查 + 测试，提交前必须通过
```

调试登录相关问题时注意：`npm run dev` 起不了后端，登录一定失败，这不是密码错。要用 `npm run dev:local`。

## 约定

- 不要读取或打印 `.dev.vars`，里面是本地密钥。
- 每次改完文件，在 `updates.md` 追加一行 `[Codex][YYMMDDHHMMSS] <具体改了什么>`。
- Markdown 渲染禁止使用 `dangerouslySetInnerHTML`。
