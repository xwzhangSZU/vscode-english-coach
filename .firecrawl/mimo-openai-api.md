Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)

# OpenAI API Compatibility

## Request Address

```bash
https://api.xiaomimimo.com/v1/chat/completions
```

## Request Headers

The API supports the following two authentication methods. Please choose one and add it to the request headers:

1. Method 1: `api-key` field authentication, format:


```json
api-key: $MIMO_API_KEY
Content-Type: application/json
```

2. Method 2: `Authorization: Bearer` authentication, format:


```json
Authorization: Bearer $MIMO_API_KEY
Content-Type: application/json
```


## Request body

- messagesarrayRequired

The current conversation message list.









Hide child attributes














Developer message · object



System message · object

User message · object

Assistant message · object

Tool message · object

- Developer-provided instructions that the model should follow, regardless of messages sent by the user.









Hide child attributes

- messages.contentstring \| arrayRequired

The contents of the developer message.









Hide child attributes














Text content · string



Array of content parts · array

- The contents of the developer message.


messages.rolestringRequired

The role of the message author.

Available options: `developer`

messages.namestring

An optional name for the participant. Provides the model information to differentiate between participants of the same role.

modelstringRequired

Model ID is used to generate the response.

Available options: `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-tts`, `mimo-v2-flash`

audioobject

Parameters for audio output. For details, please refer to [Speech Synthesis](https://platform.xiaomimimo.com/#/docs/usage-guide/speech-synthesis-v2.1).

> Note: To generate audio, you must add a message with role set to `assistant`, which needs to specify the text for speech synthesis. Additionally, when using the `mimo-v2.5-tts-voicedesign` model, a message with the role of `user` is required. For detailed usage, please refer to [Speech Synthesis](https://platform.xiaomimimo.com/#/docs/usage-guide/speech-synthesis-v2.1).

> Currently, only the `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are supported.

Hide child attributes

audio.formatstringDefault: wav

Specifies the output audio format. Default: `wav`, or `pcm` when you set `stream: true`.

> Passing in `pcm` or `pcm16` both indicate specifying the use of the `pcm16` format.

Available options: `wav`, `mp3`, `pcm`, `pcm16`

audio.voicestring

The voice ID of the built-in voice or the base64 encoding of the audio sample.

- `mimo-v2.5-tts`, `mimo-v2-tts`: This field is optional and only supports using built-in voices, with the default value being `mimo_default`
- `mimo-v2.5-tts-voiceclone`: This field is required and only supports passing in the base64 encoding of audio samples, and only supports passing in audio sample files in `mp3` and `wav` formats
- `mimo-v2.5-tts-voicedesign` does not support this field

Available options:

- `mimo-v2-tts`: `mimo_default`, `default_en`, `default_zh`
- `mimo-v2.5-tts`: `mimo_default`, `冰糖`, `茉莉`, `苏打`, `白桦`, `Mia`, `Chloe`, `Milo`, `Dean`

frequency\_penaltynumber \| nullDefault: 0

Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

Required range: `[-2.0, 2.0]`

max\_completion\_tokensinteger \| null

An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.

- `mimo-v2-flash`: default `65536`
- `mimo-v2.5-pro`, `mimo-v2-pro`: default `131072`
- `mimo-v2.5`, `mimo-v2-omni`: default `32768`
- `mimo-v2.5-tts`, `mimo-v2.5-tts-voiceclone`, `mimo-v2.5-tts-voicedesign`, `mimo-v2-tts`: default `8192`, required range is `[0, 8192]`

Required range: `[0, 131072]`

presence\_penaltynumber \| nullDefault: 0

Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

Required range: `[-2.0, 2.0]`

response\_formatobject

An object specifying the format that the model must output.

> `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are not supported.

Hide child attributes

Text · object

JSON object · object

Default response format. Used to generate text responses.

Hide child attributes

response\_format.typestringRequired

The type of response format being defined. Always `text`.

stopstring \| array \| nullDefault: null

Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.

> `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are not supported.

streamboolean \| nullDefault: false

If set to true, the model response data will be streamed to the client as it is generated using server-sent events.

thinkingobject

This parameter is used to control whether the model enables the chain of thought.

> Note: During the multi-turn tool calls process in thinking mode, the model returns a `reasoning_content` field alongside `tool_calls`. To continue the conversation, it is recommended to keep all previous `reasoning_content` in the `messages` array for each subsequent request to achieve the best performance.

> `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are not supported.

Hide child attributes

thinking.typestringRequired

Whether to enable the chain of thought.

- `mimo-v2-flash`: default `disabled`
- `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2-pro`, `mimo-v2-omni`: default `enabled`

Available options: `enabled`, `disabled`

temperaturenumber

What sampling temperature to use, between 0 and 1.5. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or `top_p` but not both.

- `mimo-v2-flash`: default `0.3`
- `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2-pro`, `mimo-v2-omni`: default `1.0`
- `mimo-v2.5-tts`, `mimo-v2.5-tts-voiceclone`, `mimo-v2.5-tts-voicedesign`, `mimo-v2-tts`: default `0.6`

Required range: `[0, 1.5]`

tool\_choicestring

Controls how the model selects a tool.

> Note: When a value other than `auto` is passed to `tool_choice`, the backend will remove this field by default, and the model response behavior will still be equivalent to the `auto` mode (this logic is subject to future adjustments).

> `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are not supported.

Available options: `auto`

toolsarray

A list of tools the model may call. You can provide function tools.

> Note: During the multi-turn tool calls process in thinking mode, the model returns a `reasoning_content` field alongside `tool_calls`. To continue the conversation, it is recommended to keep all previous `reasoning_content` in the `messages` array for each subsequent request to achieve the best performance.

> `mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`, `mimo-v2.5-tts-voiceclone` and `mimo-v2-tts` models are not supported.

Hide child attributes

Function tool · object

Web search tool · object

A function tool that can be used to generate a response.

Hide child attributes

tools.functionobjectRequired

Hide child attributes

tools.function.namestringRequired

The name of the tool function. Must be `a-z`, `A-Z`, `0-9`, or contain underscores (`_`) and dashes (`-`), with a maximum length of 64.

Required string length: `1 - 64`

tools.function.descriptionstring

A description of what the function does, used by the model to choose when and how to call the function.

tools.function.parametersobject

The parameters the functions accept, described as a JSON Schema object.

Omitting `parameters` defines a function with an empty parameter list.

tools.function.strictbooleanDefault: false

Whether to enable strict schema adherence when generating the function call. If set to true, the model will follow the exact schema defined in the `parameters` field. Only a subset of JSON Schema is supported when `strict` is `true`.

tools.typestringRequired

Tool type. Currently, only `function` is supported.

top\_pnumberDefault: 0.95

The probability threshold for nucleus sampling, which controls the diversity of the text that the model generates. A higher `top_p` value results in more diverse text. A lower `top_p` value results in more deterministic text.

Because both `temperature` and `top_p` control the diversity of the generated text, we recommend that you set only one of them.

Required range: `[0.01, 1.0]`

## Chat response object (non-streaming output)

- choicesarray

A list of chat completion choices.









Hide child attributes

- choices.finish\_reasonstring

The reason the model stopped generating tokens. This will be `stop` if the model hit a natural stop point or a provided stop sequence, `length` if the maximum number of tokens specified in the request was reached, `tool_calls` if the model called a tool, `content_filter` if content was omitted due to a flag from our content filters, `repetition_truncation` if the model detects repetition.


choices.indexinteger

The index of the choice in the list of choices.

choices.messageobject

A chat completion message generated by the model.

Hide child attributes

choices.message.contentstring

The contents of the message.

choices.message.reasoning\_contentstring

The reasoning contents of the assistant message, before the final answer.

choices.message.rolestring

The role of the author of this message.

choices.message.tool\_callsarray

After a function call is initiated, the model returns the tool to be called and the parameters that are Required for the call. This parameter can contain one or more tool response objects.

Hide child attributes

Function tool call · object

A call to a function tool created by the model.

Hide child attributes

choices.message.tool\_calls.functionobject

The function that the model called.

Hide child attributes

choices.message.tool\_calls.function.argumentsstring

The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

choices.message.tool\_calls.function.namestring

The name of the function to call.

choices.message.tool\_calls.idstring

The ID of the tool call.

choices.message.tool\_calls.typestring

The type of the tool. Currently, only `function` is supported.

choices.message.annotationsarray

After web search, the model returns annotations for all referenced URLs.

Hide child attributes

web\_search tool call · object

A call to a web search tool created by the model.

Hide child attributes

choices.message.annotations.logo\_urlstring

Logo url.

choices.message.annotations.publish\_timestring

Publish time.

choices.message.annotations.site\_namestring

Site name.

choices.message.annotations.summarystring

Summary.

choices.message.annotations.titlestring

Title.

choices.message.annotations.typestring

Type.

choices.message.annotations.urlstring

Url.

choices.message.error\_messagestring

Error message of web search.

choices.message.audioobject

If the audio output is requested, this object contains data about the audio response from the model.

Hide child attributes

choices.message.audio.idstring

Unique identifier for this audio response.

choices.message.audio.datastring

Base64 encoded audio bytes generated by the model, in the format specified in the request.

choices.message.audio.expires\_atnumber \| null

The Unix timestamp (in seconds) for when this audio response expires. Currently always `null`.

choices.message.audio.transcriptstring \| null

Transcript of the audio generated by the model. Currently always `null`.

createdinteger

The Unix timestamp (in seconds) of when the chat completion was created.

idstring

A unique identifier for the chat completion.

modelstring

The model to generate the completion.

objectstring

The object type, which is always `chat.completion`.

usageobject \| null

Usage statistics for the completion request.

Hide child attributes

usage.completion\_tokensinteger

Number of tokens in the generated completion.

usage.prompt\_tokensinteger

Number of tokens in the prompt.

usage.total\_tokensinteger

Total number of tokens used in the request (prompt + completion).

usage.completion\_tokens\_detailsobject

Breakdown of tokens used in a completion.

Hide child attributes

usage.completion\_tokens\_details.reasoning\_tokensinteger

Tokens generated by the model for reasoning.

usage.prompt\_tokens\_detailsobject

Breakdown of tokens used in the prompt.

Hide child attributes

usage.prompt\_tokens\_details.cached\_tokensinteger

Number of tokens served from cache.

usage.prompt\_tokens\_details.audio\_tokensinteger

Audio input tokens present in the prompt.

usage.prompt\_tokens\_details.image\_tokensinteger

Image input tokens present in the prompt.

usage.prompt\_tokens\_details.video\_tokensinteger

Video input tokens present in the prompt.

usage.web\_search\_usageobject

Detailed usage of the web search API.

Hide child attributes

usage.web\_search\_usage.tool\_usageinteger

Number of API calls in web search.

usage.web\_search\_usage.page\_usageinteger

Number of web pages returned by the web search API.

## Chat response chunk object (streaming output)

- choicesarray

A list of chat completion choices.









Hide child attributes

- choices.deltaobject

A chat completion delta generated by streamed model responses.









Hide child attributes

- choices.delta.contentstring

The contents of the chunk message.


choices.delta.reasoning\_contentstring

The reasoning contents of the assistant message, before the final answer.

choices.delta.rolestring

The role of the author of this message.

choices.delta.tool\_callsarray

The tools to be called by the model and the parameters Required for the calls. It can contain one or more tool response objects.

Hide child attributes

choices.delta.tool\_calls.indexinteger

The index of the called tool in the `tool_calls` list, starting from 0.

choices.delta.tool\_calls.functionobject

The function to be called.

Hide child attributes

choices.delta.tool\_calls.function.argumentsstring

The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

choices.delta.tool\_calls.function.namestring

The name of the function to call.

choices.delta.tool\_calls.idstring

The ID of the tool call.

choices.delta.tool\_calls.typestring

The type of the tool. Currently, only `function` is supported.

choices.delta.annotationsarray

After web search, the model returns annotations for all referenced URLs.

Hide child attributes

web\_search tool call · object

A call to a web search tool created by the model.

Hide child attributes

choices.delta.annotations.logo\_urlstring

Logo url.

choices.delta.annotations.publish\_timestring

Publish time.

choices.delta.annotations.site\_namestring

Site name.

choices.delta.annotations.summarystring

Summary.

choices.delta.annotations.titlestring

Title.

choices.delta.annotations.typestring

Type.

choices.delta.annotations.urlstring

Url.

choices.delta.error\_messagestring

Error message of web search.

choices.delta.audioobject \| null

If the audio output modality is requested, this object contains data about the audio response from the model.

Hide child attributes

choices.delta.audio.idstring

Unique identifier for this audio response.

choices.delta.audio.datastring

Base64 encoded audio bytes generated by the model, in the format specified in the request.

choices.delta.audio.expires\_atnumber \| null

The Unix timestamp (in seconds) for when this audio response expires. Currently always `null`.

choices.delta.audio.transcriptstring \| null

Transcript of the audio generated by the model. Currently always `null`.

choices.finish\_reasonstring \| null

The reason the model stopped generating tokens. This will be `stop` if the model hit a natural stop point or a provided stop sequence, `length` if the maximum number of tokens specified in the request was reached, `tool_calls` if the model called a tool, `content_filter` if content was omitted due to a flag from our content filters, `repetition_truncation` if the model detects repetition.

choices.indexinteger

The index of the choice in the list of choices.

createdinteger

The Unix timestamp (in seconds) of when the chat completion was created. Each chunk has the same timestamp.

idstring

A unique identifier for the chat completion. Each chunk has the same ID.

modelstring

The model to generate the completion.

objectstring

The object type, which is always `chat.completion.chunk`.

usageobject \| null

Usage statistics for the completion request.

Hide child attributes

usage.completion\_tokensinteger

Number of tokens in the generated completion.

usage.prompt\_tokensinteger

Number of tokens in the prompt.

usage.total\_tokensinteger

Total number of tokens used in the request (prompt + completion).

usage.completion\_tokens\_detailsobject

Breakdown of tokens used in a completion.

Hide child attributes

usage.completion\_tokens\_details.reasoning\_tokensinteger

Tokens generated by the model for reasoning.

usage.prompt\_tokens\_detailsobject

Breakdown of tokens used in the prompt.

Hide child attributes

usage.prompt\_tokens\_details.cached\_tokensinteger

Number of tokens served from cache.

usage.prompt\_tokens\_details.audio\_tokensinteger

Audio input tokens present in the prompt.

usage.prompt\_tokens\_details.image\_tokensinteger

Image input tokens present in the prompt.

usage.prompt\_tokens\_details.video\_tokensinteger

Video input tokens present in the prompt.

usage.web\_search\_usageobject

Detailed usage of the web search API.

Hide child attributes

usage.web\_search\_usage.tool\_usageinteger

Number of API calls in web search.

usage.web\_search\_usage.page\_usageinteger

Number of web pages returned by the web search API.

curlpython

default

streaming

function call

web search

image input

audio input

video input

speech synthesis

structured output

deep thinking

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
    "presence_penalty": 0,
    "thinking": {
        "type": "disabled"
    }
}'
```

response

default

streaming

function call

web search

image input

audio input

video input

speech synthesis

structured output

deep thinking

```json
{
    "id": "8b51f9e0515949cb8207fbd35ea6ea5c",
    "choices": [\
        {\
            "finish_reason": "stop",\
            "index": 0,\
            "message": {\
                "content": "Hello! I'm MiMo, Xiaomi's AI assistant created by the Xiaomi LLM-Core team. I'm here to chat, help answer questions, and assist with various tasks—whether it's providing information, brainstorming ideas, or just having a friendly conversation. Feel free to ask me anything, and I'll do my best to help! 😊",\
                "role": "assistant",\
                "tool_calls": null\
            }\
        }\
    ],
    "created": 1776848906,
    "model": "mimo-v2.5-pro",
    "object": "chat.completion",
    "usage": {
        "completion_tokens": 72,
        "prompt_tokens": 57,
        "total_tokens": 129,
        "completion_tokens_details": {
            "reasoning_tokens": 0
        },
        "prompt_tokens_details": null
    }
}
```

[MiMo-V2-Flash Release 2025/12/16](https://platform.xiaomimimo.com/docs/en-US/news/previous-news/news20251216) [Anthropic API](https://platform.xiaomimimo.com/docs/en-US/api/chat/anthropic-api)

Table of Contents

curlpython

default

streaming

function call

web search

image input

audio input

video input

speech synthesis

structured output

deep thinking

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
    "presence_penalty": 0,
    "thinking": {
        "type": "disabled"
    }
}'
```

response

default

streaming

function call

web search

image input

audio input

video input

speech synthesis

structured output

deep thinking

```json
{
    "id": "8b51f9e0515949cb8207fbd35ea6ea5c",
    "choices": [\
        {\
            "finish_reason": "stop",\
            "index": 0,\
            "message": {\
                "content": "Hello! I'm MiMo, Xiaomi's AI assistant created by the Xiaomi LLM-Core team. I'm here to chat, help answer questions, and assist with various tasks—whether it's providing information, brainstorming ideas, or just having a friendly conversation. Feel free to ask me anything, and I'll do my best to help! 😊",\
                "role": "assistant",\
                "tool_calls": null\
            }\
        }\
    ],
    "created": 1776848906,
    "model": "mimo-v2.5-pro",
    "object": "chat.completion",
    "usage": {
        "completion_tokens": 72,
        "prompt_tokens": 57,
        "total_tokens": 129,
        "completion_tokens_details": {
            "reasoning_tokens": 0
        },
        "prompt_tokens_details": null
    }
}
```

Scroll to top

We use cookies and similar technologies of our own to ensure the proper functioning of the website, customize content according to user preferences and analyze users' interactions on the website, as well as their browsing habits. You can find more information in our Cookie Policy. Select an option or go to Cookie Settings to manage your preferences. [Learn More](https://platform.xiaomimimo.com/cookie-policy).

Cookie SettingsAccept AllDecline All