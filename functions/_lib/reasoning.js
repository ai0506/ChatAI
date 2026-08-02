const unavailable = (reason) => ({ enabled: false, parameters: {}, reason });

export function reasoningRequest(credentials, enabled) {
  if (!enabled) return unavailable("未开启");
  const model = String(credentials.model || "").toLowerCase();

  if (credentials.provider === "qwen") {
    return { enabled: true, parameters: { enable_thinking: true }, reason: "Qwen 深度思考" };
  }
  if (credentials.provider === "deepseek") {
    return {
      enabled: true,
      parameters: { thinking: { type: "enabled" }, reasoning_effort: "high" },
      reason: "DeepSeek 高强度推理",
    };
  }
  if (credentials.provider === "qianfan" && /^(qwen3|ernie-5\.0-thinking|deepseek-(r1|v3\.2))/.test(model)) {
    return { enabled: true, parameters: { enable_thinking: true }, reason: "千帆深度思考" };
  }
  if (credentials.provider === "volcengine" && model.includes("thinking")) {
    return { enabled: true, parameters: { thinking: { type: "enabled" } }, reason: "豆包深度思考" };
  }
  if (credentials.provider === "openai" && /^(gpt-5|o[1-9])/.test(model)) {
    return { enabled: true, parameters: { reasoning_effort: "high" }, reason: "OpenAI 高强度推理" };
  }
  return unavailable("当前供应商或模型没有已验证的深度推理参数");
}

export function isReasoningParameterError(status, message) {
  return status === 400 && /thinking|reasoning|enable_thinking|unsupported parameter|unknown parameter|invalid parameter/i.test(message || "");
}
