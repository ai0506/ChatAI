export const PROVIDERS = {
  qwen: { label: "阿里云百炼 / 通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", supportsTools: true },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", supportsTools: true },
  zhipu: { label: "智谱 AI / GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5-air", supportsTools: true },
  volcengine: { label: "火山方舟 / 豆包", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-250615", supportsTools: true },
  hunyuan: { label: "腾讯混元", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-turbos-latest", supportsTools: true },
  qianfan: { label: "百度千帆", baseUrl: "https://qianfan.baidubce.com/v2", model: "ernie-4.5-turbo-128k", supportsTools: false },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", supportsTools: true },
  custom: { label: "自定义 OpenAI 兼容接口", baseUrl: "", model: "", supportsTools: false },
};

export function isSafeBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch { return false; }
}
