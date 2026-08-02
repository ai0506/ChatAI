# 前端规格与红线

本文件是这个项目前端改动的**唯一依据**。动任何界面代码前先读完。

同一套要求也适用于我的其他项目（例如 AI0506 Calendar）。文中所有「错误案例」都是本项目里**真实出现过并被要求返工**的代码，不是假设。

---

## 0. 两条最高原则

### 原则一：稳定压倒一切

**任何状态切换都不许让已有元素移动。** 切换会话、hover、选中、流式输出、报错、开关弹窗——固定元素（标题、按钮、计数、标签、输入框）必须纹丝不动。

这条优先级高于一切视觉考量。如果「好看」和「不动」冲突，选不动。

### 原则二：视觉做减法

极简、大量留白、圆角、柔和、无彩。**默认答案是"删掉它"**，不是"再加一个"。

判断标准：这个描边/阴影/颜色/图标/提示文字，删掉之后功能还在吗？在的话就删。

---

## 1. 配色：无彩的「纸与墨」

全站**没有品牌强调色**。灰阶带一点暖，避免冷灰的塑料感。

### Token 定义（`src/styles.css` 顶部）

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#1b1a18` | 主区背景 |
| `--bg-sub` | `#f7f6f4` | `#151412` | 侧栏背景 |
| `--surface` | `#ffffff` | `#232220` | 弹窗背景 |
| `--surface-2` | `#f2f1ee` | `#2b2a27` | hover 填充 / 输入框 / 用户气泡 |
| `--surface-3` | `#e7e5e1` | `#37352f` | 选中填充 / 按下态 |
| `--text` | `#1d1b18` | `#ecebe7` | 正文 |
| `--text-2` | `#6b6862` | `#a5a19a` | 次要文字 |
| `--text-3` | `#a29e97` | `#706d67` | 极次要（分组标签、meta） |
| `--ink` / `--on-ink` | `#1d1b18` / `#fff` | `#ecebe7` / `#1b1a18` | **主操作实心块** |

### 规则

- **改颜色只能改 token，不许在组件里写死颜色值。**
- 有色相的东西全站只允许三处：删除相关的 `--danger`、连接状态点的 `--ok`、供应商官方 logo 图片。两个语义色都要压到很低的饱和度。
- 链接不用彩色区分，只用下划线（`text-decoration-color: var(--text-3)`）。
- 主操作（发送键、保存按钮、启用中的开关）用 `--ink` 实心反色，深浅主题自动对调。
- 自查方法：遍历页面所有元素的 `color`/`backgroundColor`/`borderColor`，`max(r,g,b) - min(r,g,b) > 26` 的应当只剩状态点。

---

## 2. 聊天界面的形态

参照 ChatGPT / Claude / DeepSeek 的共同做法：

- **AI 回复没有任何容器**——不带头像、不带气泡、不带卡片、不带边框，整块通栏左对齐。页面本身就是回复的载体。
- **用户消息是右侧一个中性灰小块**，`max-width: 78%`（移动端 88%）。这是全站唯一有「容器感」的东西。左右不对称是这类产品最强的识别特征。
- 正文 **16px / line-height 1.75**，内容列宽 `--measure: 744px` 居中，输入框与之同宽同轴。
- 侧栏字小而暗（13.5px / `--text-2`），正文字大而亮——两套密度反差要明显。
- 顶栏几乎是空的：一个会话标题而已，没有描边、没有工具条、没有状态 chip。
- 输入框是大圆角填充块（`--r-xl: 26px` + `--surface-2`），**没有描边没有阴影**，控件在框内第二行：左边模式开关，右边模型选择器和圆形发送键。
- 空状态：标题 + 一句说明 + 输入框作为一组，在顶栏以下的空间里垂直居中，底部不留空。
- AI 回复必须走 Markdown 渲染，不许用 `white-space: pre-wrap` 直接倒文本。

---

## 3. 错误案例 → 应该怎么改

### 3.1 抖动类（最严重，出现即返工）

#### ❌ hover 才显示的按钮用 `display` 切换

```css
/* 错 —— 按钮从无到有，会把同一行的标题挤走 */
.conversation div { display: none; }
.conversation:hover div { display: flex; }
```

```css
/* 对 —— 槽位始终存在，只切 opacity */
.conversation-actions {
  display: flex;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--fast);
}
.conversation:hover .conversation-actions,
.conversation:focus-within .conversation-actions {
  opacity: 1;
  pointer-events: auto;
}
```

同样的写法适用于：消息操作条、配置卡的编辑/删除图标、任何 hover 显形的东西。别忘了 `:focus-within`，否则键盘用户点不到。

#### ❌ 选中态改字重

```css
/* 错 —— 中文在 400 和 550 下宽度不同，选中瞬间标题会变宽 */
.conversation.active { background: var(--surface-3); font-weight: 550; }
```

```css
/* 对 —— 选中只换背景色 */
.conversation.active { background: var(--surface-3); color: var(--text); }
```

#### ❌ 流式输出用平滑滚动跟随

```jsx
// 错 —— 每个 token 都触发一次平滑动画，输出时画面一直在晃，
// 而且用户往上翻历史时会被强行拽回底部
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

```jsx
// 对 —— 只有本来就贴着底部时才跟随，且不用平滑动画
useEffect(() => {
  const pane = paneRef.current;
  if (pane && stickRef.current) pane.scrollTop = pane.scrollHeight;
}, [messages]);

const onPaneScroll = () => {
  const pane = paneRef.current;
  if (!pane) return;
  stickRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 90;
};
```

#### ❌ 两列各自决定滚动条槽位

消息区是滚动容器、输入区不是，结果滚动条出现时两列中心差了 5px，而且滚动条出现/消失还会让内容横向跳。

```css
/* 对 —— 两边都预留同宽槽位，宽度在同一条规则里声明 */
.scroll-area { overflow-y: auto; scrollbar-gutter: stable; }
.composer-zone { overflow: hidden; scrollbar-gutter: stable; }
.scroll-area::-webkit-scrollbar,
.composer-zone::-webkit-scrollbar { width: 10px; }
```

#### ❌ 栅格容器只写 `height` 不写行定义

```css
/* 错 —— 隐式行有「自动最小尺寸」会被内容撑高，100vh 管不住。
   会话攒到十几条时，侧栏底部（主题切换、退出登录）被推出屏幕外 */
.shell { height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
```

```css
/* 对 */
.shell {
  height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}
.sidebar, .chat { min-height: 0; }
```

**规律：任何 flex/grid 子项，只要内部有滚动区，就要给它 `min-height: 0`（或 `min-width: 0`）**，否则它不肯缩到内容高度以下。

#### ❌ 弹窗在不同子页高度不同

列表页 ~300px、表单页 ~600px，来回切时弹窗忽大忽小。

```css
/* 对 —— 高度固定，两页之间尺寸不变 */
.modal { height: min(86vh, 640px); overflow: hidden; }
.modal-body { flex: 1; min-height: 0; overflow-y: auto; }
```

#### ❌ 返回键只在子页渲染

标题会因为前面多出一个按钮而右移 24px。

```jsx
// 对 —— 槽位常驻，列表页只是隐形
<button
  className={`back-button ${view ? "" : "hidden"}`}
  aria-hidden={!view}
  tabIndex={view ? 0 : -1}
>
```

#### ❌ hover 时元素位移

```css
/* 错 —— 元素在动，直接违反原则一 */
.new-chat:hover { transform: translateY(-1px); }
```

hover 只允许改颜色（背景、文字、边框色）。**不许有任何 `transform` 位移、缩放、阴影抬升。**

#### ❌ 报错提示插进来把输入框顶下去

报错要么占独立行且不改变输入框位置，要么预留固定高度槽位。弹窗内的报错同理，不能改变面板高度。

### 3.2 视觉类

| ❌ 错误做法 | ✅ 应该怎么改 |
| --- | --- |
| 橄榄灰底 + 奶油色字 + 冷紫强调色，三者互相打架 | 统一到上表的中性暖灰阶 |
| 强调色同时用在用户气泡、发送键、头像、开关、脉动点等 5 处 | 强调色只服务主操作一处，其余全灰 |
| AI 回复用 `white-space: pre-wrap` 倒纯文本 | 走 Markdown 渲染 |
| AI 回复带彩色渐变头像 + 气泡 | 去掉头像和容器，通栏 |
| 用户气泡用品牌色实心 + 白字（像客服组件） | 中性灰底 + 正常文字色 |
| 正文 14.5px / 1.6 | 16px / 1.75 |
| 输入框、卡片、代码块、表格到处 `1px solid` | 靠背景明度差分层，边框基本清零 |
| 登录页加径向渐变光晕、卡片带描边和大阴影 | 就是背景色上的一段文字加一个输入框 |
| 全大写小标题（`eyebrow`）、渐变 logo 方块、起始建议按钮 | 删掉 |
| 消息操作条是「图标 + 文字」按钮 | 纯图标，无边框无背景，颜色很暗 |
| 阴影分 shadow-1/2/3 到处用 | 只有弹窗有阴影，其余一律无 |

### 3.3 交互与正确性类

#### ❌ 原生 `confirm()` / `prompt()`

用项目里的 `<Confirm>` 组件（居中、圆角、取消在左删除在右）。重命名用就地编辑的 `input`，不弹 `prompt`。

#### ❌ 破坏性操作没有二次确认

删除会话、删除 API 配置、断开 Calendar，**都必须先弹确认，并在正文里说清后果**。例如：

> 断开后 AI 将无法再读取你的日程，已有对话记录不受影响。之后可以随时重新连接。

#### ❌ 嵌套弹窗没有阻止冒泡

确认框嵌在设置弹窗里时，点确认框的背景会连带关掉外层；按 Esc 会一次关两层。

```jsx
// 对 —— 背景点击阻止冒泡
<div className="modal-backdrop" onMouseDown={(e) => { e.stopPropagation(); onCancel(); }}>

// 对 —— 确认框打开时把 Esc 让给它
useEscape(!pendingDelete, onClose);
```

#### ❌ 移动端把侧栏 `display: none`

会话列表直接访问不到。要做成 `transform: translateX(-100%)` 的抽屉 + 半透明 scrim，顶栏左侧给一个菜单键。

#### ❌ 用 CSS 属性选择器 hack 探测 DOM 状态

```css
/* 错 —— 极其脆弱 */
.provider-logo:has(img:not([style*="display: none"])) { ... }
```

用 React state（`onError` → `setBroken(true)`）驱动。

#### ❌ 用 `dangerouslySetInnerHTML` 渲染 Markdown

**这是安全红线。** Markdown 必须产出 React 元素；链接必须过协议白名单（只放行 `http`/`https`/`mailto`）。见 `src/markdown.jsx`。

---

## 4. 其他必须遵守的细节

- 所有可点控件的文字 `user-select: none`，避免连点误选。
- 动效短促自然、不弹跳：`--fast: 0.16s`、`--base: 0.24s`，缓动 `cubic-bezier(0.32, 0.72, 0, 1)`。
- 必须有 `@media (prefers-reduced-motion: reduce)` 兜底。
- 浅色 / 深色 / 跟随系统三档，`index.html` 里保留首帧前的内联主题脚本，不许闪白。
- `--text-3` 只能用在分组标签和 meta 上，**不要用在需要阅读的正文和说明文字上**（对比度不够）。说明文字用 `--text-2`。
- 图标统一线性、`stroke-width: 1.8`、`currentColor`，尺寸 13–18px。不许出现填充图标或彩色图标。
- 移动端断点 `860px`；不许出现横向滚动。

---

## 5. 提交前自查清单

改完界面，**逐条实测**再说做完了：

1. `getBoundingClientRect()` 对比 hover 前后、选中前后，关键元素的 `x` / `width` 是否完全一致。
2. 弹窗在各子页之间切换，`height` 和标题 `x` 是否不变。
3. 消息列 `.messages-inner` 与输入框 `.composer-inner` 的 `x` 和 `width` 是否严格相等（桌面 + 移动端各测一次）。
4. 会话列表塞满 15 条以上，侧栏底部是否仍完整可见（`sidebar.bottom <= window.innerHeight`）。
5. 流式输出时，用户向上翻页后是否不再被强行拽回底部。
6. 遍历全页元素，确认除状态点外没有其他有色相的颜色。
7. 浅色 / 深色两套都测。
8. `document.documentElement.scrollWidth <= window.innerWidth`（无横向溢出）。
9. `npm run check` 通过。

### 验证时的一个坑

如果预览面板没有实际显示（不合成帧），**CSS transition 不会推进，`getComputedStyle` 读到的是动画起始值**，会得到「样式没生效」的假阳性（抽屉的 `translateX`、开关的背景色都踩过）。测稳态前先临时关掉动画：

```js
const st = document.createElement('style');
st.textContent = '*{transition:none!important}';
document.head.appendChild(st);
// …测量…
st.remove();
```
