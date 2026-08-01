# Provider compatibility

The settings dialog stores one profile as: provider label, API key, base URL, and model ID. The server calls the standard OpenAI-compatible `POST /chat/completions` endpoint, so switching profiles does not expose a key to the browser.

Included presets:

- Alibaba Cloud Model Studio / Qwen
- DeepSeek
- Zhipu AI / GLM
- Volcengine Ark / Doubao
- Tencent Hunyuan
- Baidu Qianfan
- OpenAI
- A custom HTTPS OpenAI-compatible endpoint

Preset endpoints and model IDs are editable. Providers change model names and regional endpoints regularly, so use the current values shown in the provider console when creating a real profile.

Calendar read tools are enabled only for presets whose OpenAI-compatible tool-calling support has been checked. Qianfan and Custom profiles still support ordinary chat, but Calendar querying remains disabled until their chosen model and endpoint are explicitly validated for tool calling.

The custom endpoint must be HTTPS and cannot point to localhost or private network addresses. This avoids turning the chat service into a path for reaching private infrastructure.
