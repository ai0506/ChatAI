# AI0506 Chat

个人专用的 AI 聊天站：React + Cloudflare Pages Functions + D1，后端调用阿里云百炼通义千问，并可通过 OAuth 以只读权限查询 AI0506 Calendar。

## 当前功能进度

- 聊天工作台已具备浅色/深色主题、移动端侧栏、会话分组、就地重命名、消息/代码复制，以及安全的 Markdown 渲染（不使用 `dangerouslySetInnerHTML`）。
- API Key 设置已支持多个 OpenAI 兼容供应商档案：通义、DeepSeek、智谱、火山方舟、腾讯混元、百度千帆、OpenAI 和自定义 HTTPS 接口；保存的 Key 会加密存储，浏览器不会拿到原始 Key。
- 可在设置中使用当前 Key 拉取供应商的 `/models` 目录，并保留手动填写模型 ID 的方式。目录结果只按格式过滤，使用时仍应选择文本聊天模型。
- 每轮聊天可开启“思考模式”。已验证有官方参数支持的供应商/模型会获得相应的深度推理参数；不支持时会回退为普通回复，模型原始思维内容不会显示或存储。
- 流式回复会展示通用执行轨迹（例如 Calendar MCP 工具调用），但不展示内部思维链。Calendar 连接保持只读。

详见 [PROGRESS.md](./PROGRESS.md)，其中区分了已验证、待人工验证和待部署事项。

## 本地启动

1. 复制 `.dev.vars.example` 为 `.dev.vars`，填写自己的密钥；不要提交该文件。现在已提供仅本机可用的模拟配置：`MOCK_AI="true"` 时不请求模型供应商，也能测试登录、会话和流式回复。
2. 创建 D1：`npx wrangler d1 create chatai-db`，把返回的 ID 填入 `wrangler.jsonc`。
3. 执行 `npm install`、`npm run build`、`npm run db:local`。
4. 用 `npm run dev:local` 启动，访问 `http://127.0.0.1:8788`；本地密码是 `.dev.vars` 内的 `CHAT_PASSWORD`。

登录后在左下角打开“模型 API Key 设置”，可保存多个通义千问 Key 配置、为配置命名、选择模型并随时切换。Key 只在提交时出现一次，服务器使用 `CALENDAR_TOKEN_ENCRYPTION_KEY` 加密保存；无已保存 Key 时仍会回退到部署时的 `DASHSCOPE_API_KEY`。

## 生产部署

1. 在 Cloudflare Pages 创建项目 `chatai`，构建命令为 `npm run build`，输出目录为 `dist`，绑定 D1 数据库 `chatai-db` 到 `DB`。
2. 在 Pages 的环境变量中设置：`CHAT_PASSWORD`、`CHAT_SESSION_SECRET`、`DASHSCOPE_API_KEY`、`CALENDAR_TOKEN_ENCRYPTION_KEY`，以及可选的 `QWEN_BASE_URL`、`QWEN_MODEL`。
   自动聊天标题使用系统独立的智谱 GLM：另加 `ZHIPU_API_KEY`，并保留 `ZHIPU_MODEL="glm-4-flash-250414"`。它不属于模型 API Key 设置，不会显示给浏览器或作为可选聊天模型。`.dev.vars` 中的值可使用双引号；Pages 控制台中直接粘贴原始 Key，不加引号。
3. 对远程数据库执行 `npm run db:remote`，部署 `npm run deploy`，再将 `chat.ai0506.com` 绑定到该 Pages 项目。
4. 在 Calendar 项目部署含 `calendar.read` 的 MCP 权限更新后，从 ChatAI 侧边栏点击“连接 Calendar”。

浏览器永远不会收到百炼 API Key、Calendar access token 或 refresh token。
