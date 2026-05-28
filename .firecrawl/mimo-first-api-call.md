Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)

# First API Call

## Supported API Types

Xiaomi MiMo API Open Platform is compatible with OpenAI API and Anthropic API formats. You can use existing SDKs to access model inference services.

## Preparation Before Calling

### Log in to Xiaomi MiMo API Open Platform

Currently, the platform only provides personal account login. You need to use a Xiaomi account to log in. If you already have a Xiaomi account, you can log in directly. If you don't have a Xiaomi account, you can visit the [Console](https://platform.xiaomimimo.com/#/console/usage) to register, or register in advance at [id.mi.com](https://id.mi.com/).

### Get API Key

Create an API Key in [Console-API Keys](https://platform.xiaomimimo.com/#/console/api-keys). Please keep your API Key safe to avoid leakage that may result in quota theft. It is recommended to configure the API Key in environment variables.

## Quick Integration Examples

You can copy the following API example code and replace the API Key value to quickly make calls.

The following system prompts are HIGHTLY recommended, please choose from English and Chinese version.

> Chinese version
>
> ```json
> 你是MiMo（中文名称也是MiMo），是小米公司研发的AI智能助手。
> 今天的日期：{date} {week}，你的知识截止日期是2024年12月。
> ```

> English version
>
> ```json
> You are MiMo, an AI assistant developed by Xiaomi.
> Today's date: {date} {week}. Your knowledge cutoff date is December 2024.
> ```

### Python SDK Examples

#### OpenAI API Format Example

Install the OpenAI Python SDK by running the following command:

```shell
# If the run fails, you can replace pip with pip3 and run again
pip install -U openai
```

Call the API:

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-pro",
    messages=[\
        {\
            "role": "system",\
            "content": "You are MiMo, an AI assistant developed by Xiaomi. Today is date: Tuesday, December 16, 2025. Your knowledge cutoff date is December 2024."\
        },\
        {\
            "role": "user",\
            "content": "please introduce yourself"\
        }\
    ],
    max_completion_tokens=1024,
    temperature=1.0,
    top_p=0.95,
    stream=False,
    stop=None,
    frequency_penalty=0,
    presence_penalty=0
)

print(completion.model_dump_json())
```

#### Anthropic API Format Example

Install the Anthropic Python SDK by running the following command:

```shell
# If the run fails, you can replace pip with pip3 and run again
pip install -U anthropic
```

Call the API:

```python
import os
from anthropic import Anthropic

client = Anthropic(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/anthropic"
)

message = client.messages.create(
    model="mimo-v2.5-pro",
    max_tokens=1024,
    system="You are MiMo, an AI assistant developed by Xiaomi. Today is date: Tuesday, December 16, 2025. Your knowledge cutoff date is December 2024.",
    messages=[\
        {\
            "role": "user",\
            "content": [\
                {\
                    "type": "text",\
                    "text": "please introduce yourself"\
                }\
            ]\
        }\
    ],
    top_p=0.95,
    stream=False,
    temperature=1.0,
    stop_sequences=None
)

print(message.content)
```

### Curl Examples

#### OpenAI API Format Example

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header "Content-Type: application/json" \
--data-raw '{
    "model": "mimo-v2.5-pro",
    "messages": [\
        {\
            "role": "system",\
            "content": "You are MiMo, an AI assistant developed by Xiaomi. Today is date: Tuesday, December 16, 2025. Your knowledge cutoff date is December 2024."\
        },\
        {\
            "role": "user",\
            "content": "please introduce yourself"\
        }\
    ],
    "max_completion_tokens": 1024,
    "temperature": 1.0,
    "top_p": 0.95,
    "stream": false,
    "stop": null,
    "frequency_penalty": 0,
    "presence_penalty": 0
}'
```

#### Anthropic API Format Example

```bash
curl --location --request POST 'https://api.xiaomimimo.com/anthropic/v1/messages' \
--header "api-key: $MIMO_API_KEY" \
--header "Content-Type: application/json" \
--data-raw '{
    "model": "mimo-v2.5-pro",
    "max_tokens": 1024,
    "system": "You are MiMo, an AI assistant developed by Xiaomi. Today is date: Tuesday, December 16, 2025. Your knowledge cutoff date is December 2024.",
    "messages": [\
        {\
            "role": "user",\
            "content": [\
                {\
                    "type": "text",\
                    "text": "please introduce yourself"\
                }\
            ]\
        }\
    ],
    "top_p": 0.95,
    "stream": false,
    "temperature": 1.0,
    "stop_sequences": null
}'
```

### Make Multi-turn Tool Calls in Thinking Mode

During the multi-turn tool calls process in thinking mode, the model returns a `reasoning_content` field alongside `tool_calls`. To continue the conversation, it is recommended to keep all previous `reasoning_content` in the `messages` array for each subsequent request to achieve the best performance.

The requested example is as follows:

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header "Content-Type: application/json" \
--data-raw '{
    "messages": [\
        {\
            "role": "assistant",\
            "content": "Hello! I am MiMo.",\
            "reasoning_content": "Okay, the user just asked me to introduce myself. That is a pretty straightforward request, but I should think about why they are asking this."\
        },\
        {\
            "role": "user",\
            "content": "What is the weather like in Hebei?"\
        }\
    ],
    "model": "mimo-v2.5-pro",
    "max_completion_tokens": 1024,
    "temperature": 1.0,
    "stream": false,
    "tools": [\
        {\
            "type": "function",\
            "function": {\
                "name": "get_current_weather",\
                "description": "Get the current weather in a given location",\
                "parameters": {\
                    "type": "object",\
                    "properties": {\
                        "location": {\
                            "type": "string",\
                            "description": "The city and state, e.g. San Francisco, CA"\
                        },\
                        "unit": {\
                            "type": "string",\
                            "enum": [\
                                "celsius",\
                                "fahrenheit"\
                            ]\
                        }\
                    },\
                    "required": [\
                        "location"\
                    ]\
                }\
            }\
        }\
    ],
    "tool_choice": "auto"
}'
```

## Check Usage Information

On the [Usage Information](https://platform.xiaomimimo.com/#/console/usage) page, you can view and export detailed data of your account's model Token usage and request counts by date.

[Welcome](https://platform.xiaomimimo.com/docs/en-US/welcome) [Model Hyperparameters](https://platform.xiaomimimo.com/docs/en-US/quick-start/model-hyperparameters)

We use cookies and similar technologies of our own to ensure the proper functioning of the website, customize content according to user preferences and analyze users' interactions on the website, as well as their browsing habits. You can find more information in our Cookie Policy. Select an option or go to Cookie Settings to manage your preferences. [Learn More](https://platform.xiaomimimo.com/cookie-policy).

Cookie SettingsAccept AllDecline All