Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)Xiaomi MiMo-V2.5 Series Launches Public Beta! Token Plan users now enjoy preferential rate, 20% off off-peak calls, save up to 30% with monthly auto-renewal, and get a FULL RESET of your used Credits. [Try it now](https://platform.xiaomimimo.com/token-plan)

# Pricing and Rate Limits

The platform sets a model concurrency limit for accounts. When server load is high, response delays or 429 errors may occur. For details on the RPM and TPM limits of each model, please refer to the following table. We recommend that you plan your request frequency reasonably.

> RPM: Requests Per Minute, which refers to the maximum number of requests you can initiate to us within one minute, and is the sum of the number of requests from all API Keys of a single account when invoking a certain model
>
> TPM: Tokens Per Minute, which refers to the maximum number of Tokens you can interact with us within one minute, and is the sum of the number of requested Tokens from all API Keys of a single account when invoking a certain model

## Pricing

### Domestic Pricing of the Model

|  | Input ≤ 256K | Input 256K - 1M |
| --- | --- | --- |
|  | Input (Cache Hit) | Input (Cache Miss) | Output | Input (Cache Hit) | Input (Cache Miss) | Output |
| `mimo-v2.5-pro`<br>`mimo-v2-pro` | ¥1.40 | ¥7.00 | ¥21.00 | ¥2.80 | ¥14.00 | ¥42.00 |
| `mimo-v2.5` | ¥0.56 | ¥2.80 | ¥14.00 | ¥1.12 | ¥5.60 | ¥28.00 |
| `mimo-v2-omni` | ¥0.56 | ¥2.80 | ¥14.00 | — | — | — |
| `mimo-v2-flash` | ¥0.07 | ¥0.70 | ¥2.10 | — | — | — |
| `mimo-v2.5-tts`<br>`mimo-v2.5-tts-voiceclone`<br>`mimo-v2.5-tts-voicedesign`<br>`mimo-v2-tts` | Limited-time free |  |  |  |  |  |

> Note: Cache writing is currently free of charge for a limited time; — indicates that the context limit of this model is 256K, and this range does not apply. Unit: yuan / 1M tokens.

### Overseas Pricing of the Model

|  | Input ≤ 256K | Input 256K - 1M |
| --- | --- | --- |
|  | Input (Cache Hit) | Input (Cache Miss) | Output | Input (Cache Hit) | Input (Cache Miss) | Output |
| `mimo-v2.5-pro`<br>`mimo-v2-pro` | $0.20 | $1.00 | $3.00 | $0.40 | $2.00 | $6.00 |
| `mimo-v2.5` | $0.08 | $0.40 | $2.00 | $0.16 | $0.80 | $4.00 |
| `mimo-v2-omni` | $0.08 | $0.40 | $2.00 | — | — | — |
| `mimo-v2-flash` | $0.01 | $0.10 | $0.30 | — | — | — |
| `mimo-v2.5-tts`<br>`mimo-v2.5-tts-voiceclone`<br>`mimo-v2.5-tts-voicedesign`<br>`mimo-v2-tts` | Limited-time free |  |  |  |  |  |

> Note: Cache writing is currently free of charge for a limited time; — indicates that the context limit of this model is 256K, and this range does not apply. Unit: $ / 1M tokens.

### Pricing for Network Service Plugins

| Service Item | Price | Description |
| --- | --- | --- |
| Domestic Internet Connectivity Service | ¥25 / 1000 times | Includes web search and web parsing, used for domestic regional networked search of relevant content |
| Overseas Internet Connectivity Service | $5 / 1000 times | Includes web search and web parsing, used for networked search of relevant content in overseas regions |

## Model Details

### Pro Series

| **Model Name** | `mimo-v2.5-pro`, `mimo-v2-pro` |
| --- | --- |
| **Category** | Text Generation - General Large Language Model |
| **Context Length** | 1 M |
| **Maximum Output Length** | 128 K |
| **Model Capability** | Text generation, deep thinking, streaming output, function call, structured output, internet search |
| **Flow Control** | RPM: 100<br>TPM: 10 M |

### Omni Series

| **Model Name** | `mimo-v2.5` | `mimo-v2-omni` |
| --- | --- | --- |
| **Category** | Text Generation - Full Modal Understanding Model | Text Generation - Full Modal Understanding Model |
| **Context Length** | 1 M | 256 K |
| **Maximum Output Length** | 128 K | 128 K |
| **Model Capability** | Full-modal understanding, in-depth thinking, streaming output, function call, structured output, and internet search |
| **Flow Control** | RPM: 100<br>TPM: 10 M |

### TTS Series

| **Model Name** | `mimo-v2.5-tts` | `mimo-v2.5-tts-voiceclone` | `mimo-v2.5-tts-voicedesign` | `mimo-v2-tts` |
| --- | --- | --- | --- | --- |
| **Category** | Speech Synthesis Model | Speech Synthesis Model | Speech Synthesis Model | Speech Synthesis Model |
| **Context Length** | 8 K | 8 K | 8 K | 8 K |
| **Maximum Output Length** | 8 K | 8 K | 8 K | 8 K |
| **Model Capability** | Speech Synthesis | Timbre Cloning | Timbre Design | Speech Synthesis |
| **Flow Control** | RPM: 100<br>TPM: 10 M |

### MiMo-V2-Flash

| **Model Name** | `mimo-v2-flash` |
| --- | --- |
| **Category** | Text Generation - General Large Language Model |
| **Context Length** | 256 K |
| **Maximum Output Length** | 64 K |
| **Model Capability** | Text generation, deep thinking, streaming output, function call, structured output, internet search |
| **Flow Control** | RPM: 100<br>TPM: 10 M |

[Error Codes](https://platform.xiaomimimo.com/docs/en-US/quick-start/error-codes) [Xiaomi MiMo-V2.5 series open-sourced & Orbit 100 trillion token plan launched](https://platform.xiaomimimo.com/docs/en-US/news/v2.5-open-sourced)

We use cookies and similar technologies of our own to ensure the proper functioning of the website, customize content according to user preferences and analyze users' interactions on the website, as well as their browsing habits. You can find more information in our Cookie Policy. Select an option or go to Cookie Settings to manage your preferences. [Learn More](https://platform.xiaomimimo.com/cookie-policy).

Cookie SettingsAccept AllDecline All