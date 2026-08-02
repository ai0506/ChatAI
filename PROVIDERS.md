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

## Official portals

The API Key settings dialog links to these official sources for creating keys and checking current model names:

| Provider | API platform | Documentation |
| --- | --- | --- |
| Alibaba Cloud Model Studio / Qwen | [Console](https://bailian.console.aliyun.com/) | [API Key guide](https://help.aliyun.com/zh/model-studio/get-api-key/) |
| DeepSeek | [Platform](https://platform.deepseek.com/) | [Docs](https://api-docs.deepseek.com/) |
| Zhipu AI / GLM | [Platform](https://open.bigmodel.cn/) | [HTTP API docs](https://docs.bigmodel.cn/cn/guide/develop/http/introduction) |
| Volcengine Ark / Doubao | [Console](https://console.volcengine.com/ark) | [Docs](https://www.volcengine.com/docs/82379/) |
| Tencent Hunyuan | [Console](https://console.cloud.tencent.com/hunyuan) | [API Key guide](https://cloud.tencent.com/document/product/1729/111008) |
| Baidu Qianfan | [Console](https://console.bce.baidu.com/qianfan/) | [Authentication guide](https://cloud.baidu.com/doc/qianfan/s/Kmh4sutww) |
| OpenAI | [API keys](https://platform.openai.com/api-keys) | [API reference](https://platform.openai.com/docs/api-reference) |

Preset endpoints and model IDs are editable. Providers change model names and regional endpoints regularly, so use the current values shown in the provider console when creating a real profile.

Calendar read tools are enabled only for presets whose OpenAI-compatible tool-calling support has been checked. Qianfan and Custom profiles still support ordinary chat, but Calendar querying remains disabled until their chosen model and endpoint are explicitly validated for tool calling.

The custom endpoint must be HTTPS and cannot point to localhost or private network addresses. This avoids turning the chat service into a path for reaching private infrastructure.
