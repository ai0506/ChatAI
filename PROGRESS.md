# 项目进度

最后核查：2026-08-01 23:06（Asia/Shanghai）

## 已完成（工作区，待提交）

- 多供应商 OpenAI 兼容 API Key 档案、加密存储、切换、编辑和删除。
- 常用供应商预设、官方创建 Key/文档入口，以及自定义 HTTPS 端点的私网拦截。
- 供应商模型目录拉取：使用临时 Key 或已保存档案的 Key 请求 `/models`，并在设置表单中提供候选模型 ID。
- 思考模式：对已确认支持的 Qwen、DeepSeek、部分千帆/豆包模型和部分 OpenAI 推理模型提交官方推理参数；参数被上游拒绝时安全重试普通请求。
- 聊天界面重做：浅色/深色主题、响应式侧栏、会话管理、Apple 风格确认弹窗、安全 Markdown、复制操作、流式执行轨迹及 Calendar 只读工具状态。
- 本地 HTTP 环境下会话 Cookie 可正常回传；生产 HTTPS 仍使用 `Secure` Cookie。

## 已验证

2026-08-01 已运行 `npm run check`，结果通过：

- Vite 生产构建成功。
- `functions/_lib/app.js`、`providers.js`、`qwen.js`、`api/chat.js` 语法检查通过。
- `tests/app.test.mjs` 与 `tests/providers.test.mjs` 通过。
- `git diff --check` 未报告空白错误。

## 待完成 / 待确认

- 当前所有上述功能均是未提交的工作区改动；尚未创建提交、推送或部署。
- 使用真实供应商 Key 的模型目录拉取、流式聊天、各模型的思考模式参数，需要按实际账号与模型逐一浏览器验证。
- Cloudflare Pages 的版本 URL、稳定 Pages URL 和自定义域名尚未在本次核查中验证。
- Calendar OAuth/MCP 的端到端读取流程尚未在本次核查中重新验证。

## 近期建议

1. 用至少一个真实供应商档案完成“保存 Key → 拉取模型 → 发起流式对话”的浏览器验收。
2. 对计划使用的每个推理模型确认其上游参数兼容性；不兼容时应用会回退，但应确认回复质量符合预期。
3. 提交前执行 `npm run check`，部署后分别检查 Cloudflare 的版本链接、稳定 Pages 地址和 `chat.ai0506.com`。
