# VS Code English Coach — Design Spec

- Date: 2026-05-28
- Status: Approved design, pre-implementation
- Author: xianwei_zhang (with Claude)

## 1. Purpose & background

The user does "vibe coding" by writing English prompts to AI assistants in VS Code
(Claude Code / GitHub Copilot Chat). They want continuous, low-friction feedback on
**how a native English speaker would phrase the same idea**, so that over time they
internalize idiomatic English.

This repo currently holds a Raycast extension ("AI Translate"). It is **reference
material**, not the deliverable. We repurpose it: the platform-agnostic core logic —
especially the multi-protocol LLM client and the existing "Rewrite & Coach" prompt — is
reused; everything Raycast/OCR/Swift specific is removed; a new VS Code extension is built
around the reused core.

The existing `buildRewriteCoachPrompt` already does exactly the coaching we want:
- English input → rewritten into natural, idiomatic English.
- Chinese input → rendered as how a native English speaker would actually say it.
- Plus a Simplified-Chinese explanation of **why** the new version is more natural
  (word choice, collocations, idioms, sentence rhythm, register), naming the typical
  Chinese-learner habit each change fixes.

## 2. Goals / non-goals

### Goals
1. A left-sidebar VS Code extension ("English Coach") with a webview UI.
2. Coach mode: given English (or Chinese) text, show the idiomatic native version plus a
   Chinese explanation of why it is more natural.
3. Three ways to get text into the coach: manual input/paste, clipboard watch, and a
   `@coach` chat participant in Copilot Chat.
4. Bring-your-own-key (BYOK) multi-LLM support (DeepSeek, Xiaomi MiMo, Gemini, Kimi,
   OpenAI), shown **one provider at a time, switchable**.
5. Read-aloud (TTS) of the native version, to train the ear.
6. Plain translation folded in as a secondary toggle (other target languages, no coaching).

### Non-goals
- Passively reading another extension's chat input box (technically impossible — see §3).
- OCR / screenshot capture (removed entirely).
- Side-by-side multi-provider comparison (explicitly out; one at a time).
- Non-macOS audio playback in v1 (read-aloud uses macOS `afplay`; matches the user's
  platform. Synthesis itself is platform-agnostic).
- Windows/Linux support is not a v1 requirement.

## 3. Key constraint: you cannot read another extension's chat input

VS Code extensions run in an isolated extension host. An extension **cannot** read the
DOM or internal state of another extension's webview (Claude Code's panel, Copilot Chat's
input box). There is no public API for observing another extension's chat input. So the
literal requirement "monitor the right-side input box" is not achievable for arbitrary
third-party chat extensions.

What VS Code *does* expose, and how we use each:
- **Clipboard** — `vscode.env.clipboard.readText()`. No change event exists, so we poll.
  This is the closest feasible equivalent to passive monitoring: the user copies their
  draft (Cmd+C) and the sidebar reacts.
- **Webview sidebar** — our own input box (`WebviewViewProvider`). Always works.
- **Chat Participant API** — `vscode.chat.createChatParticipant`. Users invoke `@coach`
  inside Copilot Chat; the participant receives `request.prompt` and streams a response.
  Works only in the Copilot Chat surface, not in Claude Code's separate panel.
- **Commands + keybindings** — used to wire the above (e.g. "coach clipboard now").

The active-editor selection API (`window.activeTextEditor`) is also available but was
**not** requested for v1, so it is omitted (trivial to add later).

## 4. Architecture

Two layers with a hard boundary:

```
package.json            VS Code manifest: sidebar view, commands, configuration, chat participant
esbuild.js              Bundling (replaces `ray build`)
src/
  extension.ts          activate()/deactivate(); wires everything together
  core/                 Platform-agnostic. NO imports from `vscode` or `@raycast/api`.
    providers.ts        Multi-protocol LLM client (OpenAI / Anthropic / Gemini compatible)
    prompt.ts           buildRewriteCoachPrompt + buildTranslationPrompt
    rewrite.ts          runRewrite -> { rewritten, why }
    translate.ts        runTranslate -> string  (extracted translate path)
    tts.ts              synthesize(text, opts) -> audio Buffer (Qwen / Gemini); no playback
    models.ts           model catalog + tier resolution
    languages.ts        translation target languages
    text.ts             normalizeInputText, quoted (from ui-constants.ts)
    types.ts            platform-agnostic types (NO Raycast `Preferences`)
  vscode/               VS Code platform layer
    config.ts           assemble ProviderConfig from settings + secrets (replaces preferences.ts)
    settings-store.ts   runtime UI state (mode/tone/provider/tts) in context.globalState
    secrets.ts          API-key get/set via context.secrets (SecretStorage)
    audio.ts            play a Buffer via macOS afplay using context.globalStorageUri
    history.ts          recent coached items in context.globalState (Phase 2)
    commands.ts         command handlers
    clipboard-watch.ts  visibility-gated clipboard polling
    chat-participant.ts @coach participant (Phase 2)
    sidebar/
      provider.ts       WebviewViewProvider: hosts the webview, message routing
      media/
        main.js         webview UI logic (vanilla, no framework)
        main.css        webview styling (uses VS Code theme variables)
```

### Boundary rules
- `core/` is pure TypeScript over `fetch` + Node built-ins. It can be unit-tested without
  VS Code. It must never import `vscode`.
- `vscode/` adapts the platform: configuration, secrets, storage, webview, audio playback,
  commands, chat, clipboard.
- The **webview never holds secrets**. It exchanges only plain messages (user text,
  selected mode/tone/provider) with the extension host; all LLM/TTS calls happen in the
  host (Node side), where keys live.

### Secrets vs settings (security)
API keys are stored in **`context.secrets`** (VS Code SecretStorage, backed by the OS
keychain), **not** in `settings.json`. Rationale: `settings.json` is plain JSON, can be
committed or synced via Settings Sync, and the project security rules forbid secrets in
git-tracked/synced files. Keys are set via commands ("English Coach: Set DeepSeek API
Key", etc.) using a password-masked `showInputBox`.

Everything non-secret uses `contributes.configuration` (workspace settings):
- per-provider: enabled, base URL, model name
- default provider, provider order, model tier (fast/pro/custom)
- request timeout, max output tokens
- TTS provider/voice/model/language; read-aloud on/off
- clipboard-watch defaults (off; stage vs auto; min length)

Because secret reads are async, `config.ts` exposes an async
`getProviderConfig(id): Promise<ProviderConfig>` that awaits the relevant secret.

## 5. Components

Each component states: what it does / how it is used / what it depends on.

### core/providers.ts
- **Does:** sends a system+user prompt to a configured provider over the right wire
  protocol (OpenAI chat-completions, Anthropic messages, or Gemini generateContent),
  returns cleaned text. Includes timeout, structured-output (JSON schema) options, and
  provider-error refinement.
- **Used by:** `rewrite.ts`, `translate.ts`.
- **Depends on:** `fetch`, `types.ts`. (Ported essentially as-is from the Raycast version.)

### core/rewrite.ts
- **Does:** `runRewrite(config, text, tone, timeoutMs, maxTokens)` → `{ rewritten, why }`
  via the coach prompt with a JSON schema; robust JSON parsing.
- **Used by:** sidebar coach action, `@coach` participant.
- **Depends on:** `providers.ts`, `prompt.ts`.

### core/translate.ts
- **Does:** `runTranslate(config, request)` → translated string (no coaching). Wraps the
  translate path currently in `providers.ts`/`prompt.ts`.
- **Used by:** sidebar Translate mode.
- **Depends on:** `providers.ts`, `prompt.ts`, `languages.ts`.

### core/tts.ts
- **Does:** `synthesize(text, { provider, slow, ... }): Promise<Buffer>` — calls Qwen or
  Gemini TTS and returns WAV/audio bytes. **No playback, no UI.** (Refactored from the
  Raycast `tts.ts`, stripping `@raycast/api` toast/HUD/supportPath/afplay.)
- **Used by:** `vscode/audio.ts`.
- **Depends on:** `fetch`, config passed in.

### vscode/audio.ts
- **Does:** write a Buffer to a temp file under `context.globalStorageUri`, play it via
  `/usr/bin/afplay`, clean up; support stop/abort. (The playback half of the old `tts.ts`.)
- **Used by:** read-aloud command / webview message.
- **Depends on:** `core/tts.ts`, Node `child_process`, `context.globalStorageUri`.
- **Note:** macOS-only. On other platforms, read-aloud is disabled with a clear message.

### vscode/config.ts
- **Does:** read `workspace.getConfiguration("englishCoach")` + secrets to build a
  `ProviderConfig`; resolve model by tier; ordered/enabled provider list.
- **Used by:** everything that calls an LLM.
- **Depends on:** `vscode.workspace`, `vscode/secrets.ts`, `core/models.ts`, `core/types.ts`.

### vscode/sidebar/provider.ts
- **Does:** implements `WebviewViewProvider`. Renders the webview, sends it the current
  settings + provider list, receives messages (`coach`, `translate`, `readAloud`,
  `copy`, `setMode`, `setTone`, `setProvider`, `fromClipboard`, `toggleWatch`,
  `setWatchMode`), invokes core logic, posts results back.
- **Used by:** registered in `extension.ts` for the sidebar view id.
- **Depends on:** `core/rewrite.ts`, `core/translate.ts`, `vscode/config.ts`,
  `vscode/audio.ts`, `vscode/settings-store.ts`.

### vscode/clipboard-watch.ts
- **Does:** while the sidebar view is visible, poll `clipboard.readText()` (~1s). On a new
  value that passes filters (changed, length ≥ min, not code/path/URL-looking, not equal
  to the last coached text), either **stage** it (post to webview to fill the input box) or
  **auto** coach it, per the watch sub-mode. Stops polling when the view is hidden.
- **Used by:** toggled from the webview; owned by the sidebar provider.
- **Depends on:** `vscode.env.clipboard`, `WebviewView.onDidChangeVisibility`.

### vscode/chat-participant.ts (Phase 2)
- **Does:** registers `@coach`. On a request, runs `runRewrite` with the default provider
  and streams `rewritten` then the `why` explanation into the chat via `ChatResponseStream`.
- **Used by:** Copilot Chat surface.
- **Depends on:** `vscode.chat`, `core/rewrite.ts`, `vscode/config.ts`.
- **Risk:** highest platform uncertainty (min VS Code version, behavior without/with
  Copilot). Verified during implementation; isolated so it can ship later.

### vscode/commands.ts
- **Does:** registers commands — set-API-key (per provider), coach clipboard now, focus
  sidebar, toggle clipboard watch, switch provider.
- **Depends on:** `vscode.commands`, sidebar provider, `vscode/secrets.ts`.

## 6. Data flow

### Coach (manual / clipboard)
```
user text (webview input)
  -> postMessage("coach", { text, tone, providerId, mode })  [webview -> host]
  -> host: config = await getProviderConfig(providerId)
  -> mode==="coach": runRewrite(config, text, tone, ...) -> { rewritten, why }
     mode==="translate": runTranslate(config, {text, targetLang,...}) -> string
  -> postMessage("result", { rewritten, why } | { translation })   [host -> webview]
  -> webview renders Native version + 为什么更自然
```

### Clipboard watch (stage mode, default)
```
view visible -> poll clipboard -> new+valid text
  -> postMessage("stage", { text })  -> webview fills input, highlights -> user clicks Coach
```
Auto mode replaces the last step with an immediate `coach` run.

### Read aloud
```
webview "Read aloud" -> postMessage("readAloud", { text, slow })
  -> host: buf = await synthesize(text, {provider, slow, ...})
  -> audio.play(buf)  (afplay)
```

### @coach (Phase 2)
```
@coach <text> in Copilot Chat -> participant handler
  -> runRewrite(defaultConfig, text, "natural", ...)
  -> stream.markdown(rewritten) ; stream.markdown(why)
```

## 7. Webview UI

Vanilla HTML/CSS/JS (no React) for a lightweight bundle. Uses VS Code theme CSS variables
so it matches the user's theme. Layout:

```
Mode: [Coach ▾]      Provider: [DeepSeek ▾]      (Coach | Translate)
Tone: [Natural ▾]                                (Natural/Casual/Formal/Concise)
[ multiline input box                          ]
[ Coach ⌘↵ ]   [📋 from clipboard]
☐ Watch clipboard     mode:( Stage ▾ )           (default off; Stage | Auto)
──────────────────────────────────────────
✨ Native version
  "…rewritten idiomatic English…"
  [Copy]  [🔊 Read aloud]  [🔊 Slow]
──────────────────────────────────────────
💡 为什么更自然
  - …Chinese bullet explanation…
```

- In Translate mode, "Tone" is replaced by a "Target language" dropdown, and the "why"
  section is hidden.
- Loading and error states render inline in the result area.
- Selected mode/tone/provider/watch settings persist via `settings-store.ts`.

## 8. Error handling

- Missing API key → result area shows "Add a <Provider> API key" with a button that runs
  the set-key command. (Mirrors `MissingAPIKeyError` in the core.)
- Provider/model errors → surface the refined message from `providers.ts`
  (`refineProviderError`), e.g. model-not-found guidance.
- Timeouts → "Request timed out"; configurable timeout.
- TTS on non-macOS or missing TTS key → disabled with a clear inline message; never crash.
- Clipboard watch never throws into the UI; failures are swallowed and polling continues.
- Invalid coach JSON → core retries parse strategies, then asks the user to regenerate.

## 9. Testing

- **core/** is unit-testable without VS Code. Priority tests:
  - `rewrite.parseRewriteResult` — JSON in code fences, with prose, balanced braces, empty.
  - `providers` URL builders + protocol selection + reasoning-model param branching
    (mock `fetch`).
  - `languages.resolveTargetLanguage` / Chinese detection.
  - `tts` chunking + WAV header wrapping.
- Test runner: a lightweight Node test setup (e.g. `node:test` + esbuild, or vitest) — TBD
  in the implementation plan; must not require the VS Code host.
- **vscode/** layer is verified by manual smoke tests in the Extension Development Host:
  sidebar renders, coach round-trips for English and Chinese input, provider switch,
  clipboard stage/auto, read-aloud plays, set-key flow. (No automated UI tests in v1.)

## 10. Cleanup list (final sign-off required before deletion)

### Delete
- All Raycast UI commands: `src/translate.tsx`, `src/translate-paste.tsx`,
  `src/rewrite-coach.tsx`, `src/rewrite-replace.tsx`, `src/screenshot-translate.tsx`,
  `src/screenshot-ocr.tsx`, `src/screenshot-ocr-copy.tsx`, `src/translation-settings.tsx`,
  `src/history.tsx` (logic is reused; the Raycast UIs are not).
- OCR core: `src/ocr-engines.ts`, `src/recognize-text.ts`, `src/ocr-errors.ts`.
- Swift OCR: `Sources/`, `Package.swift`, `scripts/build-swift.sh`, `.build/`,
  `assets/recognizeText`.
- Raycast/store assets: `assets/screenshot-translate-icon.png`, `metadata/`,
  `raycast-env.d.ts`, `scripts/generate-icons.mjs`.
- Research notes: `.firecrawl/`.
- Manifest: the Raycast `package.json` is rewritten (not kept) into a VS Code manifest.

### Keep & port (into `core/`, stripping `@raycast/api`)
- `providers.ts`, `prompt.ts`, `rewrite.ts`, `models.ts`, `languages.ts`, `types.ts`
  (drop the `ExtensionPreferences = Preferences` alias).
- `ui-constants.ts` → split: `normalizeInputText` + `quoted` go to `core/text.ts`; the
  Raycast `Icon` map is dropped.
- `tts.ts` → `core/tts.ts` (synthesis) + `vscode/audio.ts` (playback).

### Rewrite into `vscode/`
- `preferences.ts` → `config.ts`; `runtime-settings.ts` → `settings-store.ts`;
  `history-store.ts` → `history.ts`.

### Tooling changes
- Replace Raycast build (`ray build/dev/lint`) with esbuild + `@vscode/vsce`.
- Keep `.prettierrc`, `eslint.config.ts`, `tsconfig.json` (adjust for VS Code).
- Update `.gitignore` (drop Swift `.build`; keep `node_modules`, `dist`/`out`, audio temp).

## 11. Phasing

- **Phase 1 (core, fully usable):** webview sidebar; Coach mode (English→idiomatic + 中文
  讲解; Chinese→native English folded in); 5-provider BYOK, one-at-a-time switchable;
  manual input + "from clipboard"; clipboard watch (stage/auto, off by default);
  read-aloud (Qwen/Gemini via afplay); plain Translate toggle; VS Code configuration +
  SecretStorage keys.
- **Phase 2 (additive):** `@coach` chat participant; history view of recent coached items.

## 12. Open items to resolve in the implementation plan

- Exact minimum `engines.vscode` version for the Chat Participant API; verify `@coach`
  works in the user's setup. (Phase 2; does not block Phase 1.)
- Choice of test runner for `core/` (node:test vs vitest).
- Extension id / display name (proposed: id `vscode-english-coach`, display "English Coach").
- Whether read-aloud should also offer a webview `<audio>` fallback for non-macOS (deferred;
  v1 is macOS `afplay`).
