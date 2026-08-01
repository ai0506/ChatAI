import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./provider.css";

const api = async (path, options = {}) => {
  const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error?.message || "请求失败，请重试");
  return body.data;
};
const providerPresets = {
  qwen: { label: "阿里云百炼 / 通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" },
  zhipu: { label: "智谱 AI / GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5-air" },
  volcengine: { label: "火山方舟 / 豆包", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-250615" },
  hunyuan: { label: "腾讯混元", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-turbos-latest" },
  qianfan: { label: "百度千帆", baseUrl: "https://qianfan.baidubce.com/v2", model: "ernie-4.5-turbo-128k" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  custom: { label: "自定义 OpenAI 兼容接口", baseUrl: "", model: "" },
};

function Login({ onLogin }) {
  const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(""); try { await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); onLogin(); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return <main className="login"><form onSubmit={submit} className="login-card"><div className="mark">AI</div><h1>AI0506 Chat</h1><p>你的私人 AI 助手</p><label>登录密码<input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <div className="error">{error}</div>}<button disabled={loading}>{loading ? "正在登录…" : "进入聊天"}</button></form></main>;
}

function ApiKeySettings({ onClose }) {
  const [profiles, setProfiles] = useState([]), [fallback, setFallback] = useState(false), [name, setName] = useState(""), [apiKey, setApiKey] = useState(""), [provider, setProvider] = useState("qwen"), [baseUrl, setBaseUrl] = useState(providerPresets.qwen.baseUrl), [model, setModel] = useState(providerPresets.qwen.model), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = async () => { try { const data = await api("/api/api-keys"); setProfiles(data.profiles); setFallback(data.environment_fallback_available); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); }, []);
  const add = async event => { event.preventDefault(); setBusy(true); setError(""); try { await api("/api/api-keys", { method: "POST", body: JSON.stringify({ name, api_key: apiKey, provider, base_url: baseUrl, model }) }); setName(""); setApiKey(""); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const chooseProvider = value => { const preset = providerPresets[value]; setProvider(value); setBaseUrl(preset.baseUrl); setModel(preset.model); };
  const activate = async id => { setError(""); try { await api(`/api/api-keys/${id}`, { method: "PATCH", body: "{}" }); await load(); } catch (e) { setError(e.message); } };
  const remove = async id => { if (!confirm("删除此 API Key 配置？")) return; try { await api(`/api/api-keys/${id}`, { method: "DELETE", body: "{}" }); await load(); } catch (e) { setError(e.message); } };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="modal"><header><div><h2>模型 API Key</h2><p>密钥加密保存在服务器，列表不会显示原文。</p></div><button className="icon" onClick={onClose}>×</button></header><form onSubmit={add} className="key-form"><label>名称<input value={name} onChange={e => setName(e.target.value)} placeholder="例如：我的百炼主 Key" required maxLength="50" /></label><label>供应商<select value={provider} onChange={event => chooseProvider(event.target.value)}>{Object.entries(providerPresets).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}</select></label><label>API Key<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="粘贴你的 API Key" required autoComplete="off" /></label><label>接口地址<input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://.../v1" required /></label><label>模型<input value={model} onChange={e => setModel(e.target.value)} placeholder="输入模型标识符" required /></label><button disabled={busy}>{busy ? "保存中…" : "保存并切换到此 Key"}</button></form>{error && <div className="error">{error}</div>}<div className="key-list"><h3>已保存的 Key</h3>{profiles.length === 0 ? <p className="muted">还没有保存的 Key。{fallback ? "当前会使用服务器环境变量中的默认 Key。" : "添加后才能进行真实模型对话。"}</p> : profiles.map(item => <div className="key-row" key={item.id}><div><strong>{item.name}</strong><span>{providerPresets[item.provider]?.label || item.provider} · {item.model}{item.is_active ? " · 当前使用" : ""}</span></div><div>{!item.is_active && <button onClick={() => activate(item.id)}>切换</button>}<button className="danger" onClick={() => remove(item.id)}>删除</button></div></div>)}</div></section></div>;
}

function App() {
  const [ready, setReady] = useState(false), [authed, setAuthed] = useState(false), [items, setItems] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([]), [input, setInput] = useState(""), [busy, setBusy] = useState(false), [calendar, setCalendar] = useState(false), [error, setError] = useState(""), [showKeys, setShowKeys] = useState(false);
  const bottom = useRef(null);
  const loadConversations = async () => { const data = await api("/api/conversations"); setItems(data); return data; };
  const boot = async () => { try { const status = await api("/api/auth/status"); setAuthed(status.authenticated); if (status.authenticated) { const [list, cal] = await Promise.all([loadConversations(), api("/api/calendar/status")]); setCalendar(cal.connected); if (list[0]) open(list[0].id); } } catch { setAuthed(false); } finally { setReady(true); } };
  useEffect(() => { boot(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  const open = async id => { try { setError(""); const data = await api(`/api/conversations/${id}`); setActive(data.id); setMessages(data.messages); } catch (e) { setError(e.message); } };
  const create = async () => { const data = await api("/api/conversations", { method: "POST", body: "{}" }); setItems(x => [data, ...x]); setActive(data.id); setMessages([]); };
  const remove = async (id, event) => { event.stopPropagation(); if (!confirm("删除这个会话及其全部消息？")) return; await api(`/api/conversations/${id}`, { method: "DELETE" }); const next = items.filter(x => x.id !== id); setItems(next); if (active === id) { setActive(next[0]?.id || null); setMessages([]); if (next[0]) open(next[0].id); } };
  const rename = async (id, event) => { event.stopPropagation(); const title = prompt("会话名称", items.find(x => x.id === id)?.title); if (!title?.trim()) return; const changed = await api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() }) }); setItems(x => x.map(i => i.id === id ? changed : i)); };
  const send = async event => { event?.preventDefault(); const text = input.trim(); if (!text || busy) return; let id = active; if (!id) { const c = await api("/api/conversations", { method: "POST", body: "{}" }); setItems(x => [c, ...x]); id = c.id; setActive(id); }
    setInput(""); setError(""); setBusy(true); setMessages(x => [...x, { id: crypto.randomUUID(), role: "user", content: text }, { id: "stream", role: "assistant", content: "" }]);
    try { const response = await fetch("/api/chat", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: id, message: text }) }); if (!response.ok || !response.body) throw new Error("AI 服务暂时不可用，请稍后重试。");
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "", answer = "";
      while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split("\n\n"); buffer = events.pop(); for (const line of events) { const dataLine = line.split("\n").find(x => x.startsWith("data: ")); if (!dataLine) continue; const payload = JSON.parse(dataLine.slice(6)); if (payload.type === "delta") { answer += payload.text; setMessages(x => x.map(m => m.id === "stream" ? { ...m, content: answer } : m)); } if (payload.type === "error") throw new Error(payload.message); } }
      setMessages(x => x.map(m => m.id === "stream" ? { ...m, id: crypto.randomUUID(), content: answer || "抱歉，这次没有生成回复。" } : m)); const list = await loadConversations(); if (list.some(x => x.id === id)) setActive(id);
    } catch (e) { setMessages(x => x.filter(m => m.id !== "stream")); setError(e.message); } finally { setBusy(false); }
  };
  const logout = async () => { await api("/api/auth/logout", { method: "POST", body: "{}" }); setAuthed(false); setItems([]); setActive(null); setMessages([]); };
  if (!ready) return <main className="loading">正在加载…</main>; if (!authed) return <Login onLogin={boot} />;
  return <main className="shell"><aside><div className="brand"><span>AI</span> AI0506 Chat</div><button className="new" onClick={create}>＋ 新建对话</button><div className="conversations">{items.map(item => <div className={`conversation ${active === item.id ? "active" : ""}`} onClick={() => open(item.id)} key={item.id}><span>{item.title}</span><div><button onClick={e => rename(item.id, e)}>重命名</button><button onClick={e => remove(item.id, e)}>删除</button></div></div>)}</div><div className="side-bottom"><button onClick={() => setShowKeys(true)}>模型 API Key 设置</button><button onClick={() => calendar ? api("/api/calendar/disconnect", { method: "POST", body: "{}" }).then(() => setCalendar(false)) : location.assign("/api/calendar/connect")}>{calendar ? "Calendar 已连接 · 断开" : "连接 Calendar"}</button><button onClick={logout}>退出登录</button></div></aside><section className="chat"><header><div><h2>{items.find(x => x.id === active)?.title || "新对话"}</h2><p>{calendar ? "Calendar 已连接（仅查询）" : "普通聊天模式；连接 Calendar 后可查询日程"}</p></div></header><div className="messages">{messages.length === 0 && <div className="empty"><div className="mark">AI</div><h1>今天想聊什么？</h1><p>{calendar ? "你可以问：我今天有什么安排？" : "连接 Calendar 后，可以直接询问你的日程。"}</p></div>}{messages.map(m => <article key={m.id} className={`message ${m.role}`}><div className="avatar">{m.role === "user" ? "你" : "AI"}</div><div className="bubble">{m.content || (m.id === "stream" ? "正在思考…" : "")}</div></article>)}<div ref={bottom}/></div>{error && <div className="notice">{error}</div>}<form className="composer" onSubmit={send}><textarea value={input} onChange={e => setInput(e.target.value)} placeholder="输入消息，Enter 发送，Shift+Enter 换行" maxLength="12000" disabled={busy} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} /><button disabled={busy || !input.trim()}>{busy ? "回复中…" : "发送"}</button></form></section>{showKeys && <ApiKeySettings onClose={() => setShowKeys(false)} />}</main>;
}
createRoot(document.getElementById("root")).render(<App />);
