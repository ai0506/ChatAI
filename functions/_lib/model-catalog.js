export function modelListUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/models`;
}

export function extractModelIds(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  return [...new Set(items.map((item) => typeof item === "string" ? item : item?.id).filter((id) => typeof id === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(id)))].sort((a, b) => a.localeCompare(b));
}
