[Skip to main content](https://platform.kimi.ai/docs/api/models-overview#content-area)

🎉 Kimi K2.6 has been released with improved long-context coding stability.

[Kimi API Platform home page![light logo](https://mintcdn.com/moonshotai/VkIZwtOfD17qdlSH/assets/logo/light.svg?fit=max&auto=format&n=VkIZwtOfD17qdlSH&q=85&s=016dd8a23e75e7f50adc3d58d99869a7)![dark logo](https://mintcdn.com/moonshotai/VkIZwtOfD17qdlSH/assets/logo/dark.svg?fit=max&auto=format&n=VkIZwtOfD17qdlSH&q=85&s=c89fbccdef687a78e6dde8f46ed43356)](https://platform.kimi.ai/)

Search...

Ctrl K

Search...

Navigation

Using the API

Model Parameter Reference

[Get Started](https://platform.kimi.ai/docs/overview) [Guides](https://platform.kimi.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api) [API Reference](https://platform.kimi.ai/docs/api/overview) [Pricing](https://platform.kimi.ai/docs/pricing/chat) [Resources](https://platform.kimi.ai/docs/guide/prompt-best-practice)

On this page

- [Parameter Comparison](https://platform.kimi.ai/docs/api/models-overview#parameter-comparison)
- [Kimi K2.6 — thinking Parameter](https://platform.kimi.ai/docs/api/models-overview#kimi-k2-6-%E2%80%94-thinking-parameter)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://platform.kimi.ai/docs/llms.txt](https://platform.kimi.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Different model families have different defaults and constraints for Chat Completions API parameters. For the full model list, see the [Model List](https://platform.kimi.ai/docs/models).

## [​](https://platform.kimi.ai/docs/api/models-overview\#parameter-comparison)  Parameter Comparison

| Parameter | kimi-k2.6 | kimi-k2 series | kimi-k2-thinking series | moonshot-v1 series |
| --- | --- | --- | --- | --- |
| `temperature` | **Cannot be modified** | 0.6 | 1.0 | 0.0 |
| `top_p` | 0.95 **Cannot be modified** | 1.0 | 1.0 | 1.0 |
| `n` | 1 **Cannot be modified** | 1 (max 5) | 1 (max 5) | 1 (max 5) |
| `presence_penalty` | 0 **Cannot be modified** | 0 (modifiable) | 0 (modifiable) | 0 (modifiable) |
| `frequency_penalty` | 0 **Cannot be modified** | 0 (modifiable) | 0 (modifiable) | 0 (modifiable) |
| `thinking` | Supported | — | — | — |

When `temperature` is close to 0, `n` can only be 1. Otherwise, the API returns `invalid_request_error`.

## [​](https://platform.kimi.ai/docs/api/models-overview\#kimi-k2-6-%E2%80%94-thinking-parameter)  Kimi K2.6 — thinking Parameter

Kimi K2.6 supports the `thinking` parameter to control whether deep thinking is enabled. Accepts `{"type": "enabled"}` or `{"type": "disabled"}`.Since the OpenAI SDK doesn’t have a native `thinking` parameter, use `extra_body`:

Python

cURL

```
completion = client.chat.completions.create(
    model="kimi-k2.6",
    messages=[\
        {"role": "user", "content": "Hello"}\
    ],
    extra_body={
        "thinking": {"type": "disabled"}
    },
    max_tokens=1024*32,
)
```

Was this page helpful?

YesNo

[Quickstart](https://platform.kimi.ai/docs/api/quickstart) [Errors](https://platform.kimi.ai/docs/api/errors)

Ctrl+I