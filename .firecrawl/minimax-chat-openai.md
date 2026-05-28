[Skip to main content](https://platform.minimax.io/docs/api-reference/text-chat-openai#content-area)

🎉 MiniMax-M2.7: Peak Performance. Ultimate Value. Master the Complex. ➔ [Try Now](https://platform.minimax.io/docs/api-reference/text-anthropic-api).

[MiniMax API Docs home page![light logo](https://mintcdn.com/minimax-cac98058/vfWbFijizRlVE0wN/logo/light.svg?fit=max&auto=format&n=vfWbFijizRlVE0wN&q=85&s=15eaf5914a5ac609b291bbe7c6e95f66)![dark logo](https://mintcdn.com/minimax-cac98058/vfWbFijizRlVE0wN/logo/dark.svg?fit=max&auto=format&n=vfWbFijizRlVE0wN&q=85&s=f5c9fe818d807df94edb6d3d79102cc9)](https://minimax.io/)

Search...

Ctrl K

[Sign Up](https://platform.minimax.io/login)

Search...

Navigation

Text

Text Chat (Compatible OpenAI API)

[Developer Guides](https://platform.minimax.io/docs/guides/models-intro) [API Reference](https://platform.minimax.io/docs/api-reference/api-overview) [Pricing](https://platform.minimax.io/docs/pricing/overview) [Token Plan](https://platform.minimax.io/docs/token-plan/intro) [Cookbook](https://platform.minimax.io/docs/solutions) [Release Notes](https://platform.minimax.io/docs/release-notes/models) [Developer Program](https://platform.minimax.io/contact-us)

cURL

Request

```
curl --request POST \
  --url https://api.minimax.io/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '
{
  "model": "MiniMax-M2.7",
  "messages": [\
    {\
      "role": "system",\
      "name": "MiniMax AI"\
    },\
    {\
      "role": "user",\
      "content": "Hello",\
      "name": "User"\
    }\
  ]
}
'
```

200

Request

```
{
  "id": "0637a03982880edad2460180345734fe",
  "choices": [\
    {\
      "finish_reason": "stop",\
      "index": 0,\
      "message": {\
        "content": "<think>\nThe user just says \"Hello\". This is a simple greeting. I should respond with a friendly greeting and offer to help.\n</think>\n\nHello! How can I help you today?",\
        "role": "assistant",\
        "name": "MiniMax AI",\
        "audio_content": ""\
      }\
    }\
  ],
  "created": 1776839993,
  "model": "MiniMax-M2.7",
  "object": "chat.completion",
  "usage": {
    "total_tokens": 80,
    "total_characters": 0,
    "prompt_tokens": 42,
    "completion_tokens": 38,
    "completion_tokens_details": {
      "reasoning_tokens": 29
    }
  },
  "input_sensitive": false,
  "output_sensitive": false,
  "input_sensitive_type": 0,
  "output_sensitive_type": 0,
  "output_sensitive_int": 0,
  "base_resp": {
    "status_code": 0,
    "status_msg": ""
  }
}
```

POST

/

v1

/

chat

/

completions

Try it

cURL

Request

```
curl --request POST \
  --url https://api.minimax.io/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '
{
  "model": "MiniMax-M2.7",
  "messages": [\
    {\
      "role": "system",\
      "name": "MiniMax AI"\
    },\
    {\
      "role": "user",\
      "content": "Hello",\
      "name": "User"\
    }\
  ]
}
'
```

200

Request

```
{
  "id": "0637a03982880edad2460180345734fe",
  "choices": [\
    {\
      "finish_reason": "stop",\
      "index": 0,\
      "message": {\
        "content": "<think>\nThe user just says \"Hello\". This is a simple greeting. I should respond with a friendly greeting and offer to help.\n</think>\n\nHello! How can I help you today?",\
        "role": "assistant",\
        "name": "MiniMax AI",\
        "audio_content": ""\
      }\
    }\
  ],
  "created": 1776839993,
  "model": "MiniMax-M2.7",
  "object": "chat.completion",
  "usage": {
    "total_tokens": 80,
    "total_characters": 0,
    "prompt_tokens": 42,
    "completion_tokens": 38,
    "completion_tokens_details": {
      "reasoning_tokens": 29
    }
  },
  "input_sensitive": false,
  "output_sensitive": false,
  "input_sensitive_type": 0,
  "output_sensitive_type": 0,
  "output_sensitive_int": 0,
  "base_resp": {
    "status_code": 0,
    "status_msg": ""
  }
}
```

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://platform.minimax.io/docs/llms.txt](https://platform.minimax.io/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

#### Authorizations

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#authorization-authorization)

Authorization

string

header

required

`HTTP: Bearer Auth`

- Security Scheme Type: http
- HTTP Authorization Scheme: Bearer API\_key, used for account verification, can be viewed in [Account Management > API Keys](https://platform.minimax.io/user-center/basic-information/interface-key)

#### Headers

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#parameter-content-type)

Content-Type

enum<string>

default:application/json

required

Media type of the request body, should be set to `application/json` to ensure JSON format

Available options:

`application/json`

#### Body

application/json

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-model)

model

enum<string>

required

Model ID

Available options:

`MiniMax-M2.7`,

`MiniMax-M2.7-highspeed`,

`MiniMax-M2.5`,

`MiniMax-M2.1`

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-messages)

messages

object\[\]

required

A list of messages containing the conversation history. For more details on message parameters, refer to [Text Chat Guide](https://platform.minimax.io/docs/guides/text-chat)

Showchild attributes

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-stream)

stream

boolean

default:false

Whether to use streaming output, defaults to `false`. When set to `true`, the response will be returned in chunks

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-max-completion-tokens)

max\_completion\_tokens

integer<int64>

Specifies the upper limit for generated content length (in tokens), maximum is 2048. Content exceeding the limit will be truncated. If generation stops due to `length`, try increasing this value

Required range: `x >= 1`

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-temperature)

temperature

number<double>

default:1

Temperature coefficient, affects output randomness, value range (0, 1\], default value for `MiniMax-M2.7` model is 1.0. Higher values produce more random output; lower values produce more deterministic output

Required range: `0 < x <= 1`

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#body-top-p)

top\_p

number<double>

default:0.95

Sampling strategy, affects output randomness, value range (0, 1\], default value for `MiniMax-M2.7` model is 0.95

Required range: `0 < x <= 1`

#### Response

200

application/json

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-id)

id

string

Unique ID of this response

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-choices)

choices

object\[\]

List of response choices

Showchild attributes

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-created)

created

integer<int64>

Unix timestamp (seconds) when the response was created

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-model)

model

string

Model ID used for this request

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-object)

object

enum<string>

Object type. `chat.completion` for non-streaming, `chat.completion.chunk` for streaming

Available options:

`chat.completion`,

`chat.completion.chunk`

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-usage)

usage

object

Token usage statistics for this request

Showchild attributes

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-input-sensitive)

input\_sensitive

boolean

Whether the input content triggered sensitive word detection. If the input content is severely inappropriate, the API will return a content violation error message with empty reply content

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-input-sensitive-type)

input\_sensitive\_type

integer<int64>

Type of sensitive word triggered by input, returned when input\_sensitive is true. Values: 1 Severe violation; 2 Pornography; 3 Advertising; 4 Prohibited; 5 Abuse; 6 Violence/Terrorism; 7 Other

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-output-sensitive)

output\_sensitive

boolean

Whether the output content triggered sensitive word detection. If the output content is severely inappropriate, the API will return a content violation error message with empty reply content

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-output-sensitive-type)

output\_sensitive\_type

integer<int64>

Type of sensitive word triggered by output

[​](https://platform.minimax.io/docs/api-reference/text-chat-openai#response-base-resp)

base\_resp

object

Error status code and details

Showchild attributes

[Text Chat (Compatible Anthropic API)](https://platform.minimax.io/docs/api-reference/text-chat-anthropic) [Text Generation](https://platform.minimax.io/docs/api-reference/text-post)

Ctrl+I