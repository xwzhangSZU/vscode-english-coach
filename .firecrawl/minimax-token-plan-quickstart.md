[Skip to main content](https://platform.minimax.io/docs/token-plan/quickstart#content-area)

🎉 MiniMax-M2.7: Peak Performance. Ultimate Value. Master the Complex. ➔ [Try Now](https://platform.minimax.io/docs/api-reference/text-anthropic-api).

[MiniMax API Docs home page![light logo](https://mintcdn.com/minimax-cac98058/vfWbFijizRlVE0wN/logo/light.svg?fit=max&auto=format&n=vfWbFijizRlVE0wN&q=85&s=15eaf5914a5ac609b291bbe7c6e95f66)![dark logo](https://mintcdn.com/minimax-cac98058/vfWbFijizRlVE0wN/logo/dark.svg?fit=max&auto=format&n=vfWbFijizRlVE0wN&q=85&s=f5c9fe818d807df94edb6d3d79102cc9)](https://minimax.io/)

Search...

Ctrl K

[Sign Up](https://platform.minimax.io/login)

Search...

Navigation

Token Plan

Quick Start

[Developer Guides](https://platform.minimax.io/docs/guides/models-intro) [API Reference](https://platform.minimax.io/docs/api-reference/api-overview) [Pricing](https://platform.minimax.io/docs/pricing/overview) [Token Plan](https://platform.minimax.io/docs/token-plan/intro) [Cookbook](https://platform.minimax.io/docs/solutions) [Release Notes](https://platform.minimax.io/docs/release-notes/models) [Developer Program](https://platform.minimax.io/contact-us)

On this page

- [Getting Started](https://platform.minimax.io/docs/token-plan/quickstart#getting-started)
- [MCP Integration](https://platform.minimax.io/docs/token-plan/quickstart#mcp-integration)
- [Best Practices](https://platform.minimax.io/docs/token-plan/quickstart#best-practices)

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://platform.minimax.io/docs/llms.txt](https://platform.minimax.io/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

## [​](https://platform.minimax.io/docs/token-plan/quickstart\#getting-started)  Getting Started

1

[Navigate to header](https://platform.minimax.io/docs/token-plan/quickstart#)

Subscribe to Token Plan

Visit the [**Token Plan**](https://platform.minimax.io/subscribe/token-plan) Subscription page, choose the plan ( **Starter, Plus, Max**) that best suits your needs , and complete the subscription process.

2

[Navigate to header](https://platform.minimax.io/docs/token-plan/quickstart#)

Get API Key

Visit [API Keys > Create Token Plan Key](https://platform.minimax.io/user-center/payment/token-plan) to get your **API Key**

Important Notes:

- This API Key is exclusive to **Token Plan**. It is not interchangeable with pay-as-you-go API Keys.
- This API Key is only valid during the active period of your **Token Plan** subscription.
- Please protect your API Key. We recommend exporting it as an environment variable or saving it to a config file.

3

[Navigate to header](https://platform.minimax.io/docs/token-plan/quickstart#)

Test API Call (Optional)

Quickly test **MiniMax M2.7** via Compatible Anthropic API**1\. Install Anthropic SDK**

Python

Node.js

```
pip install anthropic
```

**2\. Configure Environment Variables**

```
export ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
export ANTHROPIC_API_KEY=${YOUR_API_KEY}
```

**3\. Call API**

Python

```
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="MiniMax-M2.7",
    max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[\
        {\
            "role": "user",\
            "content": [\
                {\
                    "type": "text",\
                    "text": "Hi, how are you?"\
                }\
            ]\
        }\
    ]
)

for block in message.content:
    if block.type == "thinking":
        print(f"Thinking:\n{block.thinking}\n")
    elif block.type == "text":
        print(f"Text:\n{block.text}\n")
```

4

[Navigate to header](https://platform.minimax.io/docs/token-plan/quickstart#)

Integrate with AI Coding Tools

Choose your preferred AI coding tool from the options below to experience the latest **MiniMax M2.7** model capabilities

[**Claude Code**](https://platform.minimax.io/docs/token-plan/claude-code)

[**Cursor**](https://platform.minimax.io/docs/token-plan/cursor)

[**Trae**](https://platform.minimax.io/docs/token-plan/trae)

[**OpenCode**](https://platform.minimax.io/docs/token-plan/opencode)

[**Kilo Code**](https://platform.minimax.io/docs/token-plan/kilo-code)

[**Cline**](https://platform.minimax.io/docs/token-plan/cline)

[**Roo Code**](https://platform.minimax.io/docs/token-plan/roo-code)

[**Grok CLI**](https://platform.minimax.io/docs/token-plan/grok-cli)

[**Codex CLI**](https://platform.minimax.io/docs/token-plan/codex-cli)

[**Droid**](https://platform.minimax.io/docs/token-plan/droid)

## [​](https://platform.minimax.io/docs/token-plan/quickstart\#mcp-integration)  MCP Integration

Quickly integrate **Token Plan MCP** for **Image Understanding** and **Web Search** capabilities

[**MCP Guide** \\
\\
Learn how to configure and use Token Plan MCP](https://platform.minimax.io/docs/token-plan/mcp-guide)

## [​](https://platform.minimax.io/docs/token-plan/quickstart\#best-practices)  Best Practices

Quickly view MiniMax M2.7 usage tips and practical examples

[**M2.7 Usage Tips** \\
\\
Master efficient usage methods and tips for M2.7 model](https://platform.minimax.io/docs/token-plan/best-practices)

[**Mini Agent** \\
\\
Build Agents with M2.7](https://platform.minimax.io/docs/token-plan/mini-agent)

[Overview](https://platform.minimax.io/docs/token-plan/intro) [FAQs](https://platform.minimax.io/docs/token-plan/faq)

Ctrl+I