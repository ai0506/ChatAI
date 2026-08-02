[CodeX][260728194229] 建立 ChatAI：新增 React 聊天界面、Cloudflare Pages Functions、D1 会话/消息/用量/Calendar 授权表、独立密码会话、通义千问 SSE 回复，以及通过 OAuth 和 MCP 以只读权限查询 Calendar；补充本地配置示例、部署说明和单元测试。
[CodeX][260728194401] 会话删除改为 D1 批量显式删除消息、用量记录与会话本身，确保历史数据不会残留。
[CodeX][260728195345] 新增本地 MOCK_AI 测试模式与 API Key 设置：可加密保存多个通义千问 Key 配置、自动激活新配置、切换和删除；本地浏览器已验证登录、流式模拟对话及 Key 全流程。
[CodeX][260728195429] 将本地 Playwright 测试快照目录加入忽略规则，避免浏览器测试产物进入项目状态。
[CodeX][260801162748] 将 API Key 配置升级为多供应商 OpenAI 兼容档案：支持百炼通义、DeepSeek、智谱 GLM、火山方舟豆包、腾讯混元、百度千帆、OpenAI 和自定义 HTTPS 接口；每个档案可独立设置接口地址及模型，并限制 Calendar 只读工具仅用于已验证支持工具调用的预设。
[CodeX][260801162916] 将上游失败提示改为通用 AI 模型服务错误，避免多供应商场景下仍显示通义千问名称。
[CodeX][260801211348] 为各模型供应商加入官方 API 平台与文档入口：Key 设置页会随所选供应商显示创建 Key 和查看接口文档的快捷链接，并在 PROVIDERS.md 汇总维护链接。
[CodeX][260801212307] 重做聊天工作台前端：采用简洁深色视觉系统；模型设置改为供应商标识卡片、已连接配置列表和一键切换，并保留各配置独立的 Key、接口地址和模型设置。
[CodeX][260801213323] 修复本地 HTTP 预览下 Secure 会话 Cookie 不会回传、导致聊天接口未登录的问题；生产 HTTPS 仍保持 Secure。新增并本地化各供应商官方站点 favicon，模型卡片优先显示图标并在加载失败时回退字标；已验证本地 SSE 聊天完整链路。
[CodeX][260801213757] 图标资源改为可靠的 PNG favicon，修复平台官网返回 HTML 却被当作图标的显示失败；会话 Cookie 升级为新名称以隔离旧 Secure Cookie，并同步更新会话测试。
[CodeX][260801214201] 将供应商站点 favicon 升级为 128px PNG 以改善清晰度，并在浏览器 SSE 读取端显式指定 UTF-8 解码，避免旧前端缓存或默认解码造成聊天中文显示异常。
[CodeX][260801214319] 按用户要求关闭本地 MOCK_AI 模拟模式；本地聊天将改为调用已保存的真实供应商 API Key，未配置真实 Key 时会明确提示配置。
[CodeX][260801214504] 清理由本地 PowerShell 中文编码测试生成的 3 个问号标题测试会话；保留已有正常对话，避免测试数据干扰真实聊天验证。
[CodeX][260801214930] 新增每轮可切换的思考模式：输入框下方提供开关，开启后后端追加跨供应商兼容的严谨推理与事实核对指令，并避免展示内部思维链。
[ClaudeCode][260801214435] file updated
[ClaudeCode][260801220747] 前端整体重做：新增设计 token 与浅色/深色双主题（跟随系统可切换）、AI 回复支持 Markdown（代码块/表格/列表/引用，React 元素渲染无 XSS 风险）、原生 confirm/prompt 换成 Apple 风格确认弹窗与就地重命名、会话按时间分组、移动端抽屉侧栏、消息复制与代码复制；并修复多处抖动与错位：hover 操作按钮改用固定槽位淡入（原 display:none 会挤动标题）、滚动只发生在内层且 scrollbar-gutter 保持稳定、消息列与输入框严格对齐、流式输出仅在贴底时跟随且不使用平滑动画。
[CodeX][260801222200] 新增通用 AI 执行轨迹：SSE 会实时传递思考、MCP/Skill 的开始、完成和失败状态，前端以可折叠步骤卡片展示；当前 Calendar MCP 已接入。流式输出的终端式竖条光标改为低调的三点生成动画，未开始输出时由“正在处理”卡片承担加载提示；不展示模型内部思维链。
[ClaudeCode][260801223039] 前端做减法：配色改为无彩「纸与墨」暖灰阶（删掉靛紫强调色，主操作用墨色实心）；AI 回复去掉头像与容器改通栏，用户气泡改中性灰；正文 14.5px→16px；全站去边框改用背景明度差；删除登录卡片光晕/app-mark/eyebrow/起始建议/顶栏状态 chip/输入框快捷键提示；空状态标题与输入框整组居中；消息操作条改纯图标（AI 常驻、用户 hover）；模型名做成输入框内可点切换；选中态不再改字重以免文字宽度跳变

[CodeX][260801230000] Added Asw private profile and response preferences to AI0506 Chat, including study, projects, technical background, interests, and a warm but evidence-based communication style. Calendar remains read-only in this app.
[CodeX][260801231000] Refined the private AIbot profile after Asw's review: removed Function-Guessing Game, UX preferences, Japan/UK and regional Claude details, historical creative work, volatile OnlineSoup status, Git snapshots, StudySpace process details, and internal asset notes; split casual warmth from neutral analysis.
[CodeX][260801232000] Refined AIbot profile: removed UX research and Study Space Finder, and corrected Bubble to text, images, and message limits only.
[ClaudeCode][260801225329] 修复侧栏被挤出视口（.shell 加 grid-template-rows:minmax(0,1fr)、侧栏与聊天区加 min-height:0），会话多时主题切换不再看不见；Calendar 断开改为二次确认弹窗并说明影响；思考模式开启态改为墨色反色填充，明显区分；模型与 API 面板拆成「配置列表」与「添加/编辑表单」两页，新增编辑按钮（后端 PATCH 扩展为支持改名称/模型/接口地址，API Key 留空则沿用原值），弹窗高度固定且返回键占常驻槽位，两页切换时尺寸与标题位置不变
[ClaudeCode][260801225851] 新增 FRONTEND_SPEC.md（前端规格与红线：两条最高原则、配色 token 表、聊天界面形态、21 条真实错误案例与正确写法、提交前自查清单）与 AGENTS.md（Codex 入口，指向规格文件并说明 dev 与 dev:local 的区别）
[CodeX][260801233000] Upgraded Thinking Mode from a prompt-only hint to provider-level deep reasoning: Qwen, DeepSeek, selected Qianfan, thinking-capable Doubao, and supported OpenAI reasoning models receive official reasoning parameters; unsupported models are labelled as ordinary responses, rejected parameters retry safely without them, reasoning token budgets increase, and raw reasoning content remains hidden and unstored.
[CodeX][260801234000] Added provider model catalog fetching: the API Key settings form can request the selected platform's authenticated /models endpoint with a temporary new Key or an encrypted saved profile Key, then offers returned model IDs through the model input; invalid/non-chat identifiers are filtered and manual entry remains available.
[CodeX][260801234100] Clarified model catalog scope: it filters only invalid model identifiers; a platform may still return non-chat models, so users should select a text chat model or enter one manually.
[CodeX][260801230610] 核查当前工作区进度并新增 PROGRESS.md：记录多供应商、模型目录、思考模式与聊天界面改动的完成范围、npm run check 验证结果，以及待提交、真实 Key 浏览器验收和 Cloudflare 部署确认事项；同步更新 README 功能概览。
[CodeX][260801231000] 修复平台模型列表只显示单项的问题：改为表单中显式、可点击的全部模型候选；思考过程缩为仅在进行中或失败时出现的一行状态；Calendar 已连接但无需工具时，最终回复改走 SSE 流式输出。
[CodeX][260801235900] Added system-owned GLM automatic conversation titles using ZHIPU_API_KEY and glm-4-flash-250414; titles run independently of user provider profiles, update the sidebar via SSE, and safely retain the first-message fallback if unavailable.
[CodeX][260801235901] Added the system title helper to the required syntax checks and covered its fixed GLM endpoint, default model, title cleanup, and no-key fallback in unit tests.
[CodeX][260801235902] Restricted automatic GLM naming to a new conversation's first message so it never overwrites a user-renamed title.
[CodeX][260801235903] Clarified the system GLM title prompt with explicit user-message tags, Chinese eight-character and English eight-word limits, language-only output, and local versus Pages API Key quoting guidance.
[CodeX][260801233937] Fixed Calendar tool-call failure fallback: suppress provider DSML/internal tool markup, return a clear retry/reconnect message when all Calendar calls fail, and buffer Calendar-assisted responses until protocol-safe output is confirmed; added unit coverage.
[CodeX][260801234216] Reduced Calendar request latency by locally gating tool prechecks to calendar/date-related messages, lowering the precheck token budget, and renaming the status to accurately show Calendar checking; added intent-gate unit coverage.
[CodeX][260801234344] Restored the generic Request Analysis activity wording so it remains suitable as the unified entry point for future external capabilities while preserving the Calendar latency optimization.
[CodeX][260801234810] Switched automatic conversation-title generation to the current free GLM-4.7-Flash model and isolated optional title-model overrides under ZHIPU_TITLE_MODEL.
