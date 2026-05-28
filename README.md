# English Coach (VS Code)

Rewrite your English (or Chinese) into idiomatic, native-sounding English while you code,
with a Simplified-Chinese explanation of *why* the new version is more natural.

## Features
- **Coach mode** — paste/type English → idiomatic rewrite + 中文讲解 (word choice, collocations, idioms, register).
- **Translate mode** — Chinese (or any source) → target language, no coaching.
- **Bring your own keys** — DeepSeek, Xiaomi MiMo, Gemini, Kimi, OpenAI. One provider at a time, switchable.
- **Clipboard watch** — stage or auto-coach whatever you copy (off by default).
- **Read aloud** — hear the native version (macOS).
- **Recent history** — every coach/translate is saved to the "Recent" view in the sidebar; click to restore, or copy/delete inline.
- **@coach in Copilot Chat** — type `@coach <your English>` for a rewrite + explanation inline, or `@coach /translate <text>`.

## Setup
1. Run **English Coach: Set API Key** and add at least one provider key.
2. Enable providers and tune models/base URLs in Settings (`englishCoach.*`).
3. Open the **English Coach** sidebar from the activity bar.

API keys are stored in VS Code SecretStorage (OS keychain), never in settings.json.

## Develop
- `npm install`
- `npm run watch` then press F5 to launch the Extension Development Host
- `npm test` runs the core unit tests
