import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Markdown } from "./markdown.jsx";
import "./styles.css";
import "./provider.css";

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false)
    throw new Error(body.error?.message || "请求失败，请重试");
  return body.data;
};

const providerPresets = {
  qwen: {
    label: "通义千问",
    short: "Q",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    platformUrl: "https://bailian.console.aliyun.com/",
    docsUrl: "https://help.aliyun.com/zh/model-studio/get-api-key/",
  },
  deepseek: {
    label: "DeepSeek",
    short: "DS",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    platformUrl: "https://platform.deepseek.com/",
    docsUrl: "https://api-docs.deepseek.com/",
  },
  zhipu: {
    label: "智谱 GLM",
    short: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.5-air",
    platformUrl: "https://open.bigmodel.cn/",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/develop/http/introduction",
  },
  volcengine: {
    label: "火山方舟",
    short: "ARK",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615",
    platformUrl: "https://console.volcengine.com/ark",
    docsUrl: "https://www.volcengine.com/docs/82379/",
  },
  hunyuan: {
    label: "腾讯混元",
    short: "H",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    model: "hunyuan-turbos-latest",
    platformUrl: "https://console.cloud.tencent.com/hunyuan",
    docsUrl: "https://cloud.tencent.com/document/product/1729/111008",
  },
  qianfan: {
    label: "百度千帆",
    short: "千",
    baseUrl: "https://qianfan.baidubce.com/v2",
    model: "ernie-4.5-turbo-128k",
    platformUrl: "https://console.bce.baidu.com/qianfan/",
    docsUrl: "https://cloud.baidu.com/doc/qianfan/s/Kmh4sutww",
  },
  openai: {
    label: "OpenAI",
    short: "OA",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    platformUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs/api-reference",
  },
  custom: { label: "自定义接口", short: "＋", baseUrl: "", model: "" },
};

/* ===== 图标 =============================================================== */

const svg = (paths, size = 16) => (props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {paths}
  </svg>
);

const IconPlus = svg(<path d="M12 5v14M5 12h14" />);
const IconMenu = svg(<path d="M4 7h16M4 12h16M4 17h16" />, 18);
const IconPencil = svg(
  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />,
  14,
);
const IconTrash = svg(
  <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  14,
);
const IconCopy = svg(
  <path d="M9 9h10v10H9zM5 15V5h10" />,
  15,
);
const IconCheck = svg(<path d="M5 12.5l4.5 4.5L19 7" />, 15);
const IconArrowUp = svg(<path d="M12 19V5M6 11l6-6 6 6" />, 17);
const IconSparkle = svg(
  <path d="M12 3l1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1z" />,
  13,
);
const IconChevron = svg(<path d="M9 6l6 6-6 6" />, 14);
const IconChevronDown = svg(<path d="M6 9l6 6 6-6" />, 13);
const IconBack = svg(<path d="M15 6l-6 6 6 6" />, 16);
const IconClose = svg(<path d="M6 6l12 12M18 6L6 18" />, 15);
const IconSun = svg(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
  13,
);
const IconMoon = svg(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />, 13);
const IconAuto = svg(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
  </>,
  13,
);
const IconCalendar = svg(
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </>,
  14,
);
const IconGlobe = svg(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5a12 12 0 0 1 3.2 8.5 12 12 0 0 1-3.2 8.5 12 12 0 0 1-3.2-8.5A12 12 0 0 1 12 3.5z" />
  </>,
  14,
);
const IconLogout = svg(<path d="M15 17l5-5-5-5M20 12H9M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />, 14);

/* 流式期间占用「消息操作条」那一格：有执行状态就显示状态，否则显示生成中的三点。
   两种形态和结束后的复制键高度完全一致，所以整轮回复过程中回复正文不会上下跳。 */
function StreamStatus({ activities = [] }) {
  const running = activities.filter((item) => item.status === "running");
  const failed = activities.filter((item) => item.status === "error");
  const current = running[running.length - 1] || failed[failed.length - 1];

  if (!current)
    return (
      <span className="typing-dots" role="status" aria-label="正在生成">
        <i />
        <i />
        <i />
      </span>
    );

  return (
    <span
      className={`activity-status ${current.status === "running" ? "is-running" : "is-error"}`}
      role="status"
    >
      <span className="activity-pulse" aria-hidden="true" />
      <span className="activity-label">{current.label}</span>
      {current.detail && <span className="activity-detail">{current.detail}</span>}
    </span>
  );
}

/* ===== 主题 =============================================================== */

const THEME_KEY = "ai0506-theme";
const CALENDAR_MODE_KEY = "ai0506-calendar-mode";
// 未来新增的工具（联网搜索等）在这里注册即可；calendar 是第一个接入的工具。
const TOOL_MODES = [
  { value: "auto", label: "自动" },
  { value: "on", label: "强制开启" },
  { value: "off", label: "强制关闭" },
];

const resolveTheme = (mode) => {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
};

function useTheme() {
  const [mode, setMode] = useState(
    () => localStorage.getItem(THEME_KEY) || "system",
  );
  useEffect(() => {
    resolveTheme(mode);
    localStorage.setItem(THEME_KEY, mode);
    if (mode !== "system") return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => resolveTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);
  return [mode, setMode];
}

/* ===== 通用组件 =========================================================== */

function useEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

function Confirm({ open, title, message, confirmText, onConfirm, onCancel }) {
  useEscape(open, onCancel);
  if (!open) return null;
  return (
    // 确认框可能嵌在别的弹窗里，必须阻止冒泡，否则会连带关掉外层
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation();
        onCancel();
      }}
    >
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="destroy" onClick={onConfirm} autoFocus>
            {confirmText || "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 通用工具设置小菜单：位置绝对定位，不占布局空间，不会推动其它元素。
function ToolMenu({ options, value, onChange, onClose }) {
  useEscape(true, onClose);
  return (
    <>
      <div
        className="tool-menu-backdrop"
        onMouseDown={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        className="tool-menu"
        role="menu"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={value === option.value}
            className={value === option.value ? "on" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function ProviderLogo({ provider, small = false }) {
  const item = providerPresets[provider] || providerPresets.custom;
  const [broken, setBroken] = useState(false);
  const known = Boolean(providerPresets[provider]) && provider !== "custom";
  return (
    <span
      aria-label={item.label}
      className={`provider-logo ${provider} ${small ? "small" : ""}`}
    >
      {known && !broken && (
        <img
          src={`/provider-icons/${provider}.png`}
          alt=""
          onError={() => setBroken(true)}
        />
      )}
      {(!known || broken) && <b>{item.short}</b>}
    </span>
  );
}

/* ===== 登录 =============================================================== */

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit} className="login-card">
        <h1>AI0506 Chat</h1>
        <p className="login-copy">一个只属于你的对话与日程助手。</p>
        <label className="field">
          <span className="field-label">登录密码</span>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="btn-primary" disabled={loading}>
          {loading ? "正在进入…" : "进入工作台"}
        </button>
        {/* 报错槽位常驻且在按钮之下 —— 出现时不会把输入框和按钮顶下去 */}
        <div className="login-error">{error && <div className="error">{error}</div>}</div>
      </form>
    </main>
  );
}

/* ===== 模型与 API ========================================================= */

function ApiKeySettings({ onClose, onChanged }) {
  const [profiles, setProfiles] = useState([]);
  const [fallback, setFallback] = useState(false);
  // null = 配置列表；{ mode: "add" } / { mode: "edit", id } = 表单页
  const [view, setView] = useState(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("qwen");
  const [baseUrl, setBaseUrl] = useState(providerPresets.qwen.baseUrl);
  const [model, setModel] = useState(providerPresets.qwen.model);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  // 确认框打开时把 Esc 让给它，避免一次关掉两层；表单页的 Esc 先退回列表
  const escape = useCallback(() => {
    if (view) setView(null);
    else onClose();
  }, [view, onClose]);
  useEscape(!pendingDelete, escape);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/api-keys");
      setProfiles(data.profiles);
      setFallback(data.environment_fallback_available);
      onChanged?.(data);
    } catch (e) {
      setError(e.message);
    }
  }, [onChanged]);

  useEffect(() => {
    load();
  }, [load]);

  const chooseProvider = (value) => {
    const preset = providerPresets[value];
    setProvider(value);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const openAdd = () => {
    chooseProvider("qwen");
    setName("");
    setApiKey("");
    setError("");
    setModels([]);
    setView({ mode: "add" });
  };

  const openEdit = (item) => {
    setProvider(item.provider);
    setBaseUrl(item.base_url || "");
    setModel(item.model);
    setName(item.name);
    setApiKey("");
    setError("");
    setModels([]);
    setView({ mode: "edit", id: item.id });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (view.mode === "edit") {
        // api_key 留空表示沿用原来的 Key
        await api(`/api/api-keys/${view.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, model, base_url: baseUrl, api_key: apiKey }),
        });
      } else {
        await api("/api/api-keys", {
          method: "POST",
          body: JSON.stringify({
            name,
            api_key: apiKey,
            provider,
            base_url: baseUrl,
            model,
          }),
        });
      }
      await load();
      setView(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fetchModels = async () => {
    if (view.mode === "add" && !apiKey.trim()) {
      setError("请先输入 API Key，再获取模型列表");
      return;
    }
    setLoadingModels(true);
    setError("");
    try {
      const data = await api("/api/api-keys/models", {
        method: "POST",
        body: JSON.stringify(view.mode === "edit"
          ? { profile_id: view.id }
          : { provider, api_key: apiKey, base_url: baseUrl }),
      });
      setModels(data.models);
    } catch (e) {
      setModels([]);
      setError(e.message);
    } finally {
      setLoadingModels(false);
    }
  };

  const activate = async (profileId) => {
    setError("");
    try {
      await api(`/api/api-keys/${profileId}`, { method: "PATCH", body: "{}" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await api(`/api/api-keys/${target.id}`, { method: "DELETE", body: "{}" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const selected = providerPresets[provider];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-title">
            {/* 返回键槽位常驻，列表页只是隐形 —— 两页之间标题不会左右跳 */}
            <button
              type="button"
              className={`back-button ${view ? "" : "hidden"}`}
              onClick={() => setView(null)}
              aria-label="返回配置列表"
              aria-hidden={!view}
              tabIndex={view ? 0 : -1}
            >
              <IconBack />
            </button>
            <div>
              <h2>
                {!view
                  ? "模型与 API"
                  : view.mode === "edit"
                    ? "编辑配置"
                    : "添加配置"}
              </h2>
              <p>
                {!view
                  ? "保存多个供应商配置，随时切换当前使用的模型。"
                  : view.mode === "edit"
                    ? "API Key 留空表示沿用原来的 Key。"
                    : "先选择供应商，再填入平台上创建的 Key。"}
              </p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} aria-label="关闭">
            <IconClose />
          </button>
        </header>

        <div className="modal-body scroll-area">
          {!view ? (
            <>
              <div className="section-heading">
                <h3>已保存的配置</h3>
                <span>{profiles.length} 个</span>
              </div>

              {profiles.length === 0 ? (
                <div className="empty-profile">
                  {fallback
                    ? "当前正在使用服务器默认配置。添加自己的 Key 后即可切换。"
                    : "还没有配置 API Key，添加一个就能开始使用。"}
                </div>
              ) : (
                <div className="profile-list">
                  {profiles.map((item) => (
                    <article
                      className={`profile-card ${item.is_active ? "active" : ""}`}
                      key={item.id}
                    >
                      <ProviderLogo provider={item.provider} small />
                      <div className="profile-info">
                        <strong>{item.name}</strong>
                        <span>
                          {providerPresets[item.provider]?.label ||
                            item.provider}{" "}
                          · {item.model}
                        </span>
                      </div>
                      <div className="profile-actions">
                        {item.is_active ? (
                          <span className="active-pill">使用中</span>
                        ) : (
                          <button
                            type="button"
                            className="switch"
                            onClick={() => activate(item.id)}
                          >
                            切换
                          </button>
                        )}
                        {/* 槽位常驻，只切 opacity —— hover 时配置名不会被挤动 */}
                        <div className="profile-icons">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`编辑 ${item.name}`}
                            title="编辑"
                          >
                            <IconPencil />
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => setPendingDelete(item)}
                            aria-label={`删除 ${item.name}`}
                            title="删除"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {error && <div className="error list-error">{error}</div>}

              <button type="button" className="add-profile" onClick={openAdd}>
                <IconPlus />
                添加配置
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="key-form">
              {view.mode === "add" && (
                <>
                  <div className="section-heading">
                    <h3>选择供应商</h3>
                  </div>
                  <div className="provider-picker">
                    {Object.entries(providerPresets).map(([id, item]) => (
                      <button
                        type="button"
                        className={`provider-tile ${provider === id ? "selected" : ""}`}
                        onClick={() => chooseProvider(id)}
                        key={id}
                      >
                        <ProviderLogo provider={id} small />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="selected-provider">
                <ProviderLogo provider={provider} small />
                <div>
                  <strong>{selected.label}</strong>
                  <span>
                    {view.mode === "edit"
                      ? "供应商不可更改，如需更换请新建配置"
                      : "在平台创建 Key 后填入下方表单"}
                  </span>
                </div>
                {selected.platformUrl && (
                  <div className="provider-links">
                    <a
                      href={selected.platformUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      API 平台 ↗
                    </a>
                    <a href={selected.docsUrl} target="_blank" rel="noreferrer">
                      文档 ↗
                    </a>
                  </div>
                )}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="field-label">配置名称</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={`例如：我的 ${selected.label} Key`}
                    required
                    maxLength="50"
                  />
                </label>
                <label className="field">
                  <span className="field-label">模型标识</span>
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="输入模型名称"
                    required
                  />
                </label>
                <label className="field wide">
                  <span className="field-label">API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      view.mode === "edit"
                        ? "留空则不更换现有 Key"
                        : "只在保存时提交，之后不会再显示"
                    }
                    required={view.mode === "add"}
                    autoComplete="off"
                  />
                </label>
                <label className="field wide">
                  <span className="field-label">接口地址</span>
                  <input
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://.../v1"
                    required
                  />
                </label>
              </div>

              <div className="model-catalog-action">
                <button type="button" className="catalog-button" onClick={fetchModels} disabled={loadingModels || busy}>
                  {loadingModels ? "正在获取模型列表…" : "获取平台模型列表"}
                </button>
                <span>{models.length ? `已获取 ${models.length} 个模型，点击即可选用` : "使用当前 Key 请求该平台的 /models 接口"}</span>
                <div className="model-options" aria-live="polite">
                  {models.map((id) => (
                    <button type="button" className={model === id ? "selected" : ""} key={id} onClick={() => setModel(id)}>
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="error">{error}</div>}

              <button className="btn-primary" disabled={busy}>
                {busy
                  ? "正在保存…"
                  : view.mode === "edit"
                    ? "保存修改"
                    : `保存并切换到 ${selected.label}`}
              </button>
            </form>
          )}
        </div>
      </section>

      <Confirm
        open={Boolean(pendingDelete)}
        title="删除这个配置？"
        message="仅从本站移除，不会影响供应商平台上的 API Key。"
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/* ===== 侧边栏 ============================================================= */

const groupConversations = (items) => {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const day = 86400000;
  const buckets = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "过去 7 天", items: [] },
    { label: "更早", items: [] },
  ];
  for (const item of items) {
    const stamp = Date.parse(item.updated_at || item.created_at || "");
    if (!Number.isFinite(stamp)) buckets[3].items.push(item);
    else if (stamp >= startOfToday) buckets[0].items.push(item);
    else if (stamp >= startOfToday - day) buckets[1].items.push(item);
    else if (stamp >= startOfToday - day * 7) buckets[2].items.push(item);
    else buckets[3].items.push(item);
  }
  return buckets.filter((bucket) => bucket.items.length);
};

/* ===== 应用 =============================================================== */

function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState(
    () => localStorage.getItem(CALENDAR_MODE_KEY) || "auto",
  );
  const [openToolMenu, setOpenToolMenu] = useState(null);
  const [error, setError] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingCalendar, setPendingCalendar] = useState(false);
  // 初值就用「未配置」，避免 /api/api-keys 取不到时留下空标签和一个绿色状态点
  const [modelLabel, setModelLabel] = useState("未配置模型");
  const [modelShort, setModelShort] = useState("未配置模型");
  const [copied, setCopied] = useState(null);
  const [theme, setTheme] = useTheme();

  const paneRef = useRef(null);
  const textareaRef = useRef(null);
  const stickRef = useRef(true);

  const loadConversations = async () => {
    const data = await api("/api/conversations");
    setItems(data);
    return data;
  };

  const applyModelInfo = useCallback((data) => {
    const current = data?.profiles?.find((item) => item.is_active);
    if (current) {
      setModelLabel(`${current.name} · ${current.model}`);
      setModelShort(current.model);
    } else if (data?.environment_fallback_available) {
      setModelLabel("服务器默认配置");
      setModelShort("默认模型");
    } else {
      setModelLabel("未配置模型");
      setModelShort("未配置模型");
    }
  }, []);

  const open = async (id) => {
    if (id === active) {
      setDrawer(false);
      return;
    }
    try {
      setError("");
      setDrawer(false);
      const data = await api(`/api/conversations/${id}`);
      setActive(data.id);
      setMessages(data.messages);
      stickRef.current = true;
    } catch (e) {
      setError(e.message);
    }
  };

  const boot = async () => {
    try {
      const status = await api("/api/auth/status");
      setAuthed(status.authenticated);
      if (status.authenticated) {
        const [list, cal, keys] = await Promise.all([
          loadConversations(),
          api("/api/calendar/status").catch(() => ({ connected: false })),
          api("/api/api-keys").catch(() => null),
        ]);
        setCalendar(cal.connected);
        if (keys) applyModelInfo(keys);
        if (list[0]) open(list[0].id);
      }
    } catch {
      setAuthed(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    localStorage.setItem(CALENDAR_MODE_KEY, calendarMode);
  }, [calendarMode]);

  // 只有用户本来就贴着底部时才跟随滚动，且不使用平滑动画 —— 避免流式输出时画面抖动
  useEffect(() => {
    const pane = paneRef.current;
    if (pane && stickRef.current) pane.scrollTop = pane.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [input]);

  const onPaneScroll = () => {
    const pane = paneRef.current;
    if (!pane) return;
    stickRef.current =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight < 90;
  };

  const create = async () => {
    try {
      const data = await api("/api/conversations", { method: "POST", body: "{}" });
      setItems((current) => [data, ...current]);
      setActive(data.id);
      setMessages([]);
      setDrawer(false);
      stickRef.current = true;
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await api(`/api/conversations/${target.id}`, { method: "DELETE" });
      const next = items.filter((item) => item.id !== target.id);
      setItems(next);
      if (active === target.id) {
        setActive(null);
        setMessages([]);
        if (next[0]) open(next[0].id);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const startRename = (item) => {
    setRenaming(item.id);
    setRenameValue(item.title);
  };

  const commitRename = async () => {
    const id = renaming;
    const title = renameValue.trim();
    setRenaming(null);
    const original = items.find((item) => item.id === id);
    if (!id || !title || title === original?.title) return;
    try {
      const changed = await api(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setItems((current) =>
        current.map((item) => (item.id === id ? changed : item)),
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  };

  const send = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    let id = active;
    if (!id) {
      const conversation = await api("/api/conversations", {
        method: "POST",
        body: "{}",
      });
      setItems((current) => [conversation, ...current]);
      id = conversation.id;
      setActive(id);
    }

    setInput("");
    setError("");
    setBusy(true);
    stickRef.current = true;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: "stream", role: "assistant", content: "", activities: [] },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: id,
          message: text,
          thinking,
          tool_modes: { calendar: calendarMode },
        }),
      });
      if (!response.ok || !response.body)
        throw new Error("AI 服务暂时不可用，请稍后重试。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let answer = "";

      const processEvent = (rawEvent) => {
        const dataLine = rawEvent
          .split("\n")
          .find((entry) => entry.startsWith("data: "));
        if (!dataLine) return;
        const payload = JSON.parse(dataLine.slice(6));
        if (payload.type === "delta") {
          answer += payload.text;
          setMessages((current) =>
            current.map((message) =>
              message.id === "stream"
                ? { ...message, content: answer }
                : message,
            ),
          );
        }
        if (payload.type === "activity" && payload.activity) {
          setMessages((current) => current.map((message) => {
            if (message.id !== "stream") return message;
            const activities = message.activities || [];
            const previous = activities.findIndex((item) => item.id === payload.activity.id);
            const next = previous === -1 ? [...activities, payload.activity] : activities.map((item, index) => index === previous ? { ...item, ...payload.activity } : item);
            return { ...message, activities: next };
          }));
        }
        if (payload.type === "title" && typeof payload.title === "string") {
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, title: payload.title } : item,
            ),
          );
        }
        if (payload.type === "error") throw new Error(payload.message);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        for (const rawEvent of events) processEvent(rawEvent);
      }
      // A server or proxy may close immediately after its final SSE event,
      // without the trailing blank line. Render that final buffered event too.
      if (buffer.trim()) processEvent(buffer);

      setMessages((current) =>
        current.map((message) =>
          message.id === "stream"
            ? {
                ...message,
                id: crypto.randomUUID(),
                content: answer || "抱歉，这次没有生成回复。",
              }
            : message,
        ),
      );
      await loadConversations();
    } catch (e) {
      setMessages((current) =>
        current.filter((message) => message.id !== "stream"),
      );
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleCalendar = () => {
    if (!calendar) {
      location.assign("/api/calendar/connect");
      return;
    }
    setPendingCalendar(true);
  };

  const disconnectCalendar = async () => {
    setPendingCalendar(false);
    try {
      await api("/api/calendar/disconnect", { method: "POST", body: "{}" });
      setCalendar(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    setAuthed(false);
    setItems([]);
    setActive(null);
    setMessages([]);
  };

  const groups = useMemo(() => groupConversations(items), [items]);

  if (!ready) return <main className="loading">正在加载工作台…</main>;
  if (!authed) return <Login onLogin={boot} />;

  const title = items.find((item) => item.id === active)?.title || "新对话";

  return (
    <main className={`shell ${drawer ? "drawer-open" : ""}`}>
      <div className="scrim" onClick={() => setDrawer(false)} />

      <aside className="sidebar">
        <div className="brand">AI0506</div>

        <button className="new-chat" onClick={create}>
          <IconPlus />
          新建对话
        </button>

        <div className="conversations scroll-area">
          {groups.length === 0 && (
            <div className="conversations-empty">
              还没有对话记录。
              <br />
              从下方输入框开始第一句吧。
            </div>
          )}
          {groups.map((group) => (
            <React.Fragment key={group.label}>
              <div className="group-label">{group.label}</div>
              {group.items.map((item) => (
                <div
                  className={`conversation ${active === item.id ? "active" : ""}`}
                  key={item.id}
                >
                  {renaming === item.id ? (
                    <input
                      className="rename-input"
                      value={renameValue}
                      autoFocus
                      maxLength={80}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setRenaming(null);
                      }}
                    />
                  ) : (
                    <>
                      {/* 标题本身就是按钮，键盘可聚焦 —— 操作区的 :focus-within 才真的有意义 */}
                      <button
                        type="button"
                        className="conversation-open"
                        onClick={() => open(item.id)}
                        aria-current={active === item.id ? "true" : undefined}
                      >
                        {item.title}
                      </button>
                      <div className="conversation-actions">
                        <button
                          type="button"
                          onClick={() => startRename(item)}
                          aria-label={`重命名「${item.title}」`}
                          title="重命名"
                        >
                          <IconPencil />
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => setPendingDelete(item)}
                          aria-label={`删除「${item.title}」`}
                          title="删除"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="side-bottom">
          <button className="model-button" onClick={() => setShowKeys(true)}>
            <span
              className={`status-dot ${modelLabel === "未配置模型" ? "off" : ""}`}
            />
            模型与 API
            <span className="model-meta">{modelLabel}</span>
            <IconChevron />
          </button>

          <button onClick={toggleCalendar}>
            <IconCalendar />
            {calendar ? "Calendar 已连接（只读）" : "连接 Calendar"}
          </button>

          <button onClick={logout}>
            <IconLogout />
            退出登录
          </button>

          <div className="theme-switch">
            {[
              ["light", <IconSun key="l" />, "浅色"],
              ["dark", <IconMoon key="d" />, "深色"],
              ["system", <IconAuto key="s" />, "跟随系统"],
            ].map(([value, icon, label]) => (
              <button
                key={value}
                className={theme === value ? "on" : ""}
                onClick={() => setTheme(value)}
                title={label}
                aria-label={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className={`chat ${messages.length === 0 ? "is-empty" : ""}`}>
        <header className="chat-header">
          <button
            className="menu-button"
            onClick={() => setDrawer(true)}
            aria-label="打开会话列表"
          >
            <IconMenu />
          </button>
          <h2>{title}</h2>
        </header>

        <div className="messages scroll-area" ref={paneRef} onScroll={onPaneScroll}>
          <div className="messages-inner">
            {messages.length === 0 ? (
              <div className="empty">
                <h1>今天想聊什么？</h1>
                <p>
                  {calendar
                    ? "已连接 Calendar，可以直接问今天的日程或 Deadline。"
                    : "连接 Calendar 后，也可以直接查询日程。"}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-body">
                    {message.role === "user" ? (
                      <div className="bubble">{message.content}</div>
                    ) : (
                      <div className="answer">
                        <Markdown text={message.content} />
                      </div>
                    )}
                  </div>
                  {/* 槽位常驻且高度固定：流式时装状态指示，结束后换成复制键。
                      内容替换而不是增删元素，所以回复正文的位置全程不动。 */}
                  <div className="message-tools">
                    {message.id === "stream" ? (
                      <StreamStatus activities={message.activities} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => copyMessage(message)}
                        aria-label={copied === message.id ? "已复制" : "复制"}
                        title={copied === message.id ? "已复制" : "复制"}
                      >
                        {copied === message.id ? <IconCheck /> : <IconCopy />}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="composer-zone">
          <div className="composer-inner">
            {error && <div className="error composer-error">{error}</div>}

            <div className="tool-row">
              <div className="tool-item">
                <button
                  type="button"
                  className={`tool-button ${calendarMode !== "auto" ? calendarMode : ""}`}
                  onClick={() =>
                    setOpenToolMenu((current) =>
                      current === "calendar" ? null : "calendar",
                    )
                  }
                  title={`Calendar · ${TOOL_MODES.find((mode) => mode.value === calendarMode).label}`}
                  aria-label="Calendar 工具设置"
                >
                  <IconCalendar />
                </button>
                {openToolMenu === "calendar" && (
                  <ToolMenu
                    options={TOOL_MODES}
                    value={calendarMode}
                    onChange={(value) => {
                      setCalendarMode(value);
                      setOpenToolMenu(null);
                    }}
                    onClose={() => setOpenToolMenu(null)}
                  />
                )}
              </div>
              <button
                type="button"
                className="tool-button disabled"
                disabled
                title="联网搜索（即将支持）"
                aria-label="联网搜索（即将支持）"
              >
                <IconGlobe />
              </button>
            </div>

            <form className="composer" onSubmit={send}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="给 AI0506 发送消息…"
                maxLength="12000"
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className={`toggle-pill ${thinking ? "on" : ""}`}
                  onClick={() => setThinking((value) => !value)}
                  title="对已验证支持的模型启用深度推理；不支持时会明确提示并普通作答"
                >
                  <IconSparkle />
                  思考模式
                </button>
                <button
                  type="button"
                  className="model-pill"
                  onClick={() => setShowKeys(true)}
                  title="切换模型"
                >
                  <span>{modelShort}</span>
                  <IconChevronDown />
                </button>
                <button
                  className="send-button"
                  disabled={busy || !input.trim()}
                  aria-label="发送消息"
                >
                  <IconArrowUp />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {showKeys && (
        <ApiKeySettings
          onClose={() => setShowKeys(false)}
          onChanged={applyModelInfo}
        />
      )}

      <Confirm
        open={Boolean(pendingDelete)}
        title="删除这个会话？"
        message={`「${pendingDelete?.title || ""}」及其全部消息都会被永久删除。`}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />

      <Confirm
        open={pendingCalendar}
        title="断开 Calendar 连接？"
        message="断开后 AI 将无法再读取你的日程，已有对话记录不受影响。之后可以随时重新连接。"
        confirmText="断开连接"
        onConfirm={disconnectCalendar}
        onCancel={() => setPendingCalendar(false)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
