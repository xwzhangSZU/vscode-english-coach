# Say It Right (VS Code) — Design Spec

- Date: 2026-05-30
- Status: Approved design, pre-implementation
- Author: xianwei_zhang (with Claude)
- Related: `2026-05-28-vscode-english-coach-design.md` (the English Coach extension whose
  `core/` this project reuses); `~/Projects/raycast-say-it-right` (the Raycast "Say It Right"
  whose feature set and prosody model this project ports and exceeds).

> **Update 2026-05-30 (supersedes any conflicting text below).** Final decisions:
> - Built **in place** in the existing `vscode-english-coach` repo — **not** a separate project, **no** core porting. New pronunciation modules are added alongside the existing code and reuse `core/` directly.
> - **Keeps all current English Coach features** (Coach rewrite, Translate, TTS, clipboard watch, `@coach` chat participant, Review Deck) and **adds** the Say It Right pronunciation player.
> - Manifest rebrand: `displayName` → **"Say It Right 英语口语教练"**, new Marketplace id **`vscode-say-it-right`**. Existing internal ids (`englishCoach.*` commands/config/views) stay (don't break working features); new features use `sayItRight.*`.
> - **At ship time only:** publish the new id, then **unpublish** the old `xianwei-zhang.vscode-english-coach` listing — **irreversible** (old id burned permanently), runs **last**, **only on explicit confirmation**.
> - Prosody stave rendering: **Style 1 — enhanced marks** (colored dots above words, underlined nuclear word, tone arrows), chosen from `docs/superpowers/mockups/2026-05-30-stave-variants.html`.

## 1. Purpose & background

"Say It Right" turns any English text into a **pronunciation lesson**: select or paste a
sentence, see *how to say it* — sentence stress, rising/falling intonation, thought-group
rhythm, connected-speech links, plus General American IPA — then hear a clear model voice you
can slow down, loop, shadow, and (optionally) record yourself against.

A Raycast version already exists (`~/Projects/raycast-say-it-right`). It is **reference
material**, not the deliverable. Raycast caps it hard: the coaching view is a read-only
Markdown `Detail`, playback shells out to macOS `afplay` (no seek / no continuous speed / no
true loop), and only two providers (OpenAI, Qwen) with `gpt-4o-mini` + basic TTS are wired.

This project grows Say It Right **inside the existing English Coach extension** (rebranded; see the
Update note above): it reuses the English Coach `core/` (multi-protocol LLM client, TTS layer,
model catalog, config patterns) in place and goes well beyond the Raycast version by using a real
interactive **webview** and the **current** (verified 2026-05-30) Qwen and OpenAI model lines.

## 2. Goals / Non-goals

### Goals
1. A focused VS Code extension ("Say It Right") with a webview **panel** (editor tab) player.
2. **Prosody analysis** of any English text: per-word stress / reduced, per-thought-group
   tone, nuclear word, connected-speech links, whole-sentence GA IPA — rendered as an
   interactive visual "stave," not static text.
3. **Model TTS reading** with a steerable "teacher" voice (slow, clear, articulated).
4. **Precision-listening practice**: continuous 0.25×–4× variable speed (pitch-preserved),
   AB-repeat, shadowing loop (N times + gap), repeat-last, sentence step-through.
5. **Karaoke word-highlight**: highlight each word as it is spoken, click a word to seek.
6. **Record yourself** with an in-extension 🎙 button (no browser), then compare your take to
   the model and get AI text feedback; **export** both the model audio and your recording.
7. **Bring-your-own-key (BYOK)**, reusing English Coach's provider set (Qwen / DeepSeek /
   MiniMax / MiMo / Gemini / OpenAI), one provider at a time, switchable.
8. Light integration with English Coach concepts: send a sentence to idiomatic "Coach"
   explanation; star a sentence to a review list. (Optional, additive.)

### Non-goals
- **In-webview microphone capture.** VS Code blocks `getUserMedia` in extension webviews by
  design (see §3); recording is done host-side via ffmpeg, not in the webview.
- **Phoneme-level pronunciation scoring** (a calibrated GOP/ELSA-style score). General LLMs
  give qualitative feedback only; a dedicated assessment service is out of scope.
- **Realtime conversation tutor** (`gpt-realtime-2`, Qwen omni-realtime). Expensive and
  mic-constrained; deferred to a future mode.
- **Audio / video import + STT subtitling** (the EchoEnglish model). The source is always
  text; audio is synthesized, not imported.
- **Non-macOS recording in v1.** Playback/analysis/TTS are cross-platform; the 🎙 recorder
  uses macOS `avfoundation` first (Windows/Linux ffmpeg inputs deferred), matching English
  Coach's macOS-first audio stance.
- **0.1× / 5× speed extremes** — outside the audible playbackRate range (clamp to 0.25–4×).

## 3. Key constraints (verified 2026-05-29/30)

These platform facts shaped the design. Each was verified against a primary source, not
assumed.

1. **Webview microphone is blocked.** `navigator.mediaDevices.getUserMedia()` in an extension
   webview is denied with no prompt, by design; the relevant tracking issue is currently a
   `feature-request` with no timeline (microsoft/vscode #113916, #250568). → recording must be
   out-of-webview.
2. **Host-side ffmpeg recording is feasible on this machine.** `ffmpeg` is installed
   (`/opt/homebrew/bin/ffmpeg`), and the local VS Code app declares
   `NSMicrophoneUsageDescription` ("An application in Visual Studio Code wants to use the
   Microphone"), so macOS can grant the mic to a VS Code-spawned process after a one-time
   prompt. (A 2021-era maintainer note claiming VS Code lacks mic permission is stale; verified
   live on 2026-05-30.) → an in-extension 🎙 button is viable, macOS-first. End-to-end capture
   to be smoke-tested in implementation.
3. **Webview `<audio>` plays mp3/wav/ogg/flac**; CSP must include `media-src ${cspSource}`
   (and `data:`/`blob:` if used). AAC/`.m4a` is silent — not relevant here since we synthesize
   our own audio (request wav/mp3).
4. **Variable speed**: HTML5 `playbackRate` is audible ~0.25×–4× (`preservesPitch` defaults
   true; audio mutes outside the range). 0.1×/5× are out.
5. **TTS returns no word timestamps** (neither Qwen TTS nor OpenAI TTS). Word-highlight timing
   must come from ASR run on the synthesized audio (see §9).
6. **`vscode.lm` is text-only and Copilot-gated**; it cannot take audio and is not used for
   STT. All AI goes through BYOK HTTP providers, as in English Coach.
7. **Marketplace `.vsix` ≈ 25 MiB** (server-enforced). → do not bundle ffmpeg; detect/guide
   `brew install ffmpeg` instead.

## 4. Relationship to English Coach

Say It Right **is** the English Coach extension, evolved in place. Development happens in the
existing `/Users/xianweizhang/Projects/vscode-english-coach` repo on a feature branch. The
existing features (Coach rewrite, Translate, read-aloud TTS, clipboard watch, `@coach` chat
participant, Review Deck) are **kept**; the prosody player is **added**. The existing `core/`
(`providers.ts`, `tts.ts`, `models.ts`, `types.ts`, `text.ts`) and platform layer (`config.ts`,
`secrets.ts`, `settings-store.ts`) are reused **directly** — no copying, no second codebase.

Rebrand: `package.json` `displayName` → "Say It Right 英语口语教练" and `name` (id) →
`vscode-say-it-right`. To avoid breaking the working extension, existing internal identifiers
(`englishCoach.*` command/view/config ids) are left as-is; the new pronunciation features add
`sayItRight.*` commands and settings, reusing the already-configured Qwen and OpenAI keys. At ship
time the new id is published and the old `xianwei-zhang.vscode-english-coach` Marketplace listing
is unpublished (irreversible; last step; explicit confirmation required — see the shipping task in
the plan).

## 5. Architecture

Two layers with a hard boundary, mirroring English Coach.

```
package.json            VS Code manifest: panel command, configuration, BYOK keys
esbuild.js              bundling
src/
  extension.ts          activate()/deactivate(); wires panel + commands
  core/                 Platform-agnostic. NO imports from `vscode`.
    providers.ts        Multi-protocol LLM client (ported from English Coach)
    tts.ts              synthesize(text, opts) -> audio Buffer; +OpenAI TTS, +instructions
    transcribe.ts       audio -> { text, words[] {word,start,end} } (Whisper / Qwen file-ASR)
    prosody.ts          analyze(text) -> ProsodyAnalysis (ported schema + prompt)
    segment.ts          splitSentences(text) -> string[] (deterministic, offline)
    feedback.ts         compare(target, userTranscript) -> structured feedback
    models.ts           model catalog + tier resolution (+TTS/ASR model ids)
    align.ts            map ASR word timings onto analysis words (word-highlight)
    types.ts            ProsodyAnalysis, Word, ThoughtGroup, Tone, Link, etc.
  vscode/               VS Code platform layer
    config.ts           assemble ProviderConfig from settings + secrets
    secrets.ts          API keys via SecretStorage (per provider)
    settings-store.ts   UI state (provider/voice/speed/loop prefs) in globalState
    audio-cache.ts      synthesized audio + ASR-timing cache under globalStorageUri
    recorder.ts         host-side ffmpeg record (start/stop), macOS avfoundation
    export.ts           save model audio / user recording via showSaveDialog
    player/
      panel.ts          WebviewPanel provider: hosts UI, routes messages, runs core
      media/
        player.js       webview UI (vanilla): stave render, <audio>, controls, record
        player.css      theme-variable styling
```

### Boundary rules
- `core/` is pure TS over `fetch` + Node built-ins; unit-testable without VS Code; never
  imports `vscode`.
- The **webview never holds secrets**. It exchanges plain messages (text, sentence index,
  chosen voice/speed, "play"/"record"/"analyze") with the host; all LLM/TTS/ASR/ffmpeg calls
  happen host-side where keys live.
- **Playback is in the webview `<audio>` element** (not `afplay`) — this is what enables seek,
  AB-loop, continuous variable speed, word-highlight, and cross-platform playback.

## 6. Components

Each: what it does / used by / depends on.

### core/prosody.ts
- **Does:** `analyze(text, {isWord, accent:"GA"}, config) -> ProsodyAnalysis`. Builds the
  ported Say It Right system+user prompt, calls `generateWithProvider` with a strict JSON
  schema, parses + validates. For a single selected word, generates one natural example
  sentence and analyzes that.
- **Used by:** panel (per current sentence).
- **Depends on:** `providers.ts`, `types.ts`.

### core/types.ts (data model, ported from Say It Right)
- `ProsodyAnalysis { text, isGeneratedExample, sourceWord?, ipa, thoughtGroups[], notes? }`
- `ThoughtGroup { tone: "fall"|"rise"|"fall-rise"|"rise-fall"|"level", words[] }`
- `Word { text, syllables[], stressIndex|null, stressed, nuclear, ipa?, linkToNext? }`
  with invariants: a nuclear word is stressed; `stressIndex` is a valid syllable index.

### core/segment.ts
- **Does:** `splitSentences(text)` — deterministic offline sentence split handling
  abbreviations, decimals, and quotes; returns `[text]` if no boundary found.
- **Used by:** panel (step-through). **Depends on:** none.

### core/tts.ts (extended from English Coach)
- **Does:** `synthesize(text, {provider, voice, instructions?, format})` -> audio Buffer.
  Keeps Qwen/Gemini/MiMo/MiniMax; **adds OpenAI `/v1/audio/speech`** (`gpt-4o-mini-tts`,
  voices incl. `marin`/`cedar`, `instructions`, `speed`) and threads a steerable
  `instructions` string for Qwen `qwen3-tts-instruct-flash` and OpenAI.
- **Used by:** panel (model reading, teacher mode). **Depends on:** `fetch`, config.

### core/transcribe.ts
- **Does:** `transcribe(audio, {provider}) -> { text, words: {word,start,end}[] }`. OpenAI
  path: `whisper-1` + `response_format=verbose_json` + `timestamp_granularities=["word",
  "segment"]`. Qwen path: `qwen3-asr-flash-filetrans` (`enable_words:true`, async submit/poll)
  or `paraformer-v2` (`sentences[].words[]` ms).
- **Used by:** word-highlight (ASR on model audio) and record-compare (ASR on user audio).
- **Depends on:** `fetch`, config.

### core/align.ts
- **Does:** map ASR word timings onto the analysis `Word[]` (normalize/match tokens) so the
  stave highlights in sync with playback. Falls back to proportional time estimates if ASR
  timing is unavailable.
- **Used by:** panel/webview. **Depends on:** none.

### core/feedback.ts
- **Does:** `compare(targetText, userTranscript) -> { coverage, missed[], extra[], notes }`
  via a structured-JSON LLM call (word-level diff + one coaching tip). Optional richer path:
  send the user's audio to Qwen-Omni / Gemini for qualitative pronunciation/intonation notes.
- **Used by:** record-compare. **Depends on:** `providers.ts`.

### vscode/recorder.ts
- **Does:** `start()` spawns `ffmpeg -f avfoundation -i ":<device>" -y <tmp.wav>`; `stop()`
  ends capture gracefully (`q`/SIGINT) and resolves the file path. Enumerates the default
  input via `ffmpeg -f avfoundation -list_devices`. Detects missing ffmpeg and surfaces a
  `brew install ffmpeg` hint. macOS-only in v1.
- **Used by:** panel (🎙 button). **Depends on:** Node `child_process`, `globalStorageUri`.

### vscode/audio-cache.ts
- **Does:** cache synthesized audio (key = hash of `text|provider|voice|instructions|format`)
  and ASR word-timings (key = audio hash) under `globalStorageUri`; reused so replay / speed
  changes / re-highlight never re-hit the API.
- **Used by:** panel. **Depends on:** `globalStorageUri`, Node fs.

### vscode/player/panel.ts
- **Does:** implements the WebviewPanel. Splits input into sentences, drives analysis + TTS +
  ASR for the current sentence, posts results to the webview, and handles messages: `analyze`,
  `synthesize`, `play`(rate), `loop`(times,gap), `repeatLast`, `record`/`stopRecord`,
  `compare`, `exportModel`, `exportRecording`, `next`/`prev`, `switchProvider`, `wordExample`,
  `sendToCoach`, `star`.
- **Used by:** registered in `extension.ts`. **Depends on:** all of `core/` + `vscode/`.

## 7. Data flow

### Analyze + show stave
```
text -> splitSentences -> current sentence
  -> analyze(sentence) [cache] -> ProsodyAnalysis -> postMessage("analysis")
  -> webview renders interactive stave (marks above words + IPA)
```

### Synthesize + play (+ word-highlight)
```
play(rate) -> synthesize(sentence, voice, instructions?) [cache] -> audio file (asWebviewUri)
  -> (for highlight) transcribe(audio) [cache] -> words[] -> align onto analysis words
  -> webview <audio>.playbackRate = rate; on timeupdate, highlight current word
```

### Shadowing loop
```
loop(times, gap) -> play sentence, wait sentence-duration + gap, repeat ×times
  (pure webview timer over the cached <audio>; no re-synth)
```

### Record + compare + feedback
```
🎙 record -> host recorder.start() (ffmpeg avfoundation) -> user clicks stop
  -> recorder.stop() -> user.wav (asWebviewUri)
  -> webview: [▶ model] vs [▶ your recording]
  -> compare: transcribe(user.wav) -> feedback(targetText, userTranscript)
  -> postMessage("feedback") -> webview shows word diff + coaching tip
export -> showSaveDialog -> copy cached model audio / user.wav to chosen path
```

## 8. AI model strategy (verified 2026-05-30; Qwen-first, OpenAI parity, BYOK fallback)

One provider is active at a time (reusing English Coach's switcher). Per task, the recommended
models:

| Task | Qwen (preferred) | OpenAI | Notes |
| --- | --- | --- | --- |
| Prosody analysis (JSON) | `qwen3.5-flash` | `gpt-5.4-nano` / `-mini` | cheapest capable; strict structured output; 1M ctx (Qwen) |
| Model voice (natural) | `qwen3-tts-flash` (Jennifer/Aiden/Ryan…) | `gpt-4o-mini-tts` (`marin`/`cedar`) | `language_type="English"`; 600 chars/req (Qwen) |
| Teacher voice (steerable slow/clear) | `qwen3-tts-instruct-flash` + `instructions` (+`optimize_instructions`) | `gpt-4o-mini-tts` + `instructions` (+`speed`) | "read slowly, articulate each word, patient teacher" |
| Word timestamps | `qwen3-asr-flash-filetrans` (`enable_words`) / `paraformer-v2` | `whisper-1` + `verbose_json` + `timestamp_granularities` | TTS gives none; ASR only. whisper-1 is OpenAI's only timestamp path |
| Recording feedback | Qwen-Omni (`qwen3.5-omni`) listens + advises | transcribe (whisper-1) + word diff | qualitative only; no calibrated phoneme score |

- Endpoints: Qwen OpenAI-compatible `https://dashscope.aliyuncs.com/compatible-mode/v1`;
  Qwen TTS/ASR use DashScope native endpoints (already handled in `tts.ts`; ASR added).
- Other English Coach providers (DeepSeek/MiniMax/MiMo/Gemini) remain available for the
  analysis step; only Qwen and OpenAI offer the full TTS+ASR stack, so TTS/ASR fall back to a
  user-selected Qwen or OpenAI key when the active analysis provider lacks them.
- Realtime APIs (`gpt-realtime-2`, Qwen omni-realtime) are noted for a future live-tutor mode;
  not in MVP.

## 9. Webview UI

Vanilla HTML/CSS/JS, VS Code theme variables. A WebviewPanel (editor tab) for room.

**Rendering style: Style 1 — enhanced marks** (chosen 2026-05-30 from
`docs/superpowers/mockups/2026-05-30-stave-variants.html`): colored dots above words (`●` stress /
`·` reduced), the nuclear word colored + underlined, a tone arrow per thought group, `‿` liaison
ties, `‖` group breaks. (The pitch-contour and other mockup styles are deferred.)

```
[ provider ▾ ]  [ voice ▾ ]  [ ◀ prev ]  sentence 2 / 5  [ next ▶ ]
────────────────────────────────────────────────────────────────
  ●        ·   ●       ↘‖     ·   ●        ‿●        ↘
  I  really  want  to  finish   this  project   today.        (stave: marks above words)
  /aɪ ˈrɪli wɑnt tə ˈfɪnɪʃ ðɪs ˈprɑdʒɛkt təˈdeɪ/                (whole-sentence GA IPA)
────────────────────────────────────────────────────────────────
[ ▶ Play ]  speed [────●──── 1.0×]  [ Teacher slow ]  [ AB-repeat ]  [ Shadow ×3 ]  [ ↻ ]
[ 🎙 Record ]   [ ▶ Your take ]   [ Compare ]        [ ⤓ Export model ] [ ⤓ Export mine ]
────────────────────────────────────────────────────────────────
💡 Feedback:  matched 7/8 · missed "to" · tip: link "want‿to" → /ˈwɑnə/
[ Coach this sentence ]   [ ⭐ Save ]      (optional, later integration)
```

- Stress `●` / reduced `·`, tone `↗ ↘ ↘↗ ↗↘ →`, thought-group `‖`, link `‿`; colored, with
  the current word highlighted during playback; hover a word for its IPA; click a word to seek.
- Continuous speed slider (0.25–4×); "Teacher slow" re-synthesizes with `instructions` for a
  natural slow delivery (distinct from playbackRate slowdown).
- Record/compare/feedback and export controls appear inline; loading/errors render in place.
- Selected provider/voice/speed/loop prefs persist via `settings-store.ts`.

## 10. Error handling

- Missing API key → inline "Add a <Provider> key" with a button to the set-key command.
- Provider/model rejection → surfaced via the ported `refineProviderError` (model-not-found
  guidance, etc.).
- Invalid analysis JSON → schema validation fails → one retry, then "regenerate" prompt.
- ffmpeg missing → inline hint with the `brew install ffmpeg` command; record button disabled.
- macOS mic denied → detect ffmpeg permission error → guide to System Settings › Privacy ›
  Microphone; never crash.
- ASR timing unavailable → fall back to proportional word-highlight (degrade, don't fail).
- Non-macOS → record button hidden with a clear "macOS only in v1" note; everything else works.
- Timeouts and aborts reuse the English Coach patterns.

## 11. Caching

Three caches under `globalStorageUri`, all keyed by content hash so they survive restarts and
never re-bill: (1) prosody analysis (`text|provider|model|accent`), (2) synthesized audio
(`text|provider|voice|instructions|format`), (3) ASR word timings (audio hash). User
recordings are kept until the user clears them or exports.

## 12. Testing

- **core/** unit tests (no VS Code host): `segment.splitSentences` (abbreviations, decimals,
  quotes); `prosody` JSON parsing/validation incl. the nuclear/stressIndex invariants;
  `transcribe` response shaping + endpoint/param selection (mock `fetch`); `align` token
  matching + proportional fallback; `feedback` word-diff. Reuse ported `providers`/`tts` tests.
- **vscode/** manual smoke in the Extension Development Host: analyze → stave renders →
  play/slow/teacher → AB-repeat → shadow loop → word-highlight follows → 🎙 record (grant mic
  once) → compare + feedback → export model + recording → next/prev → provider switch.
- **recorder.ts**: end-to-end ffmpeg avfoundation capture is the highest-risk item — smoke-test
  first on the dev machine before building UI on top of it.

## 13. Phasing

- **Phase 1 (MVP, fully usable):** independent extension; text in (paste/select/open/clipboard)
  + sentence step-through; prosody analysis + interactive stave; model TTS + teacher voice;
  continuous variable speed; AB-repeat; shadowing loop; repeat-last; export model audio; word →
  example; BYOK provider switch; configuration + SecretStorage.
- **Phase 1.5 (high-value, one extra ASR call):** karaoke word-highlight (ASR-timed) with the
  proportional fallback already in place.
- **Phase 2 (the 🎙 differentiator):** host-side ffmpeg record button (macOS) → compare +
  AI feedback → export your recording.
- **Later:** Windows/Linux recording; realtime live-tutor mode; persistent passage library +
  last-position memory; English Coach integration ("Coach this sentence" / shared review deck,
  which needs porting `rewrite.ts` + `prompt.ts`).

## 14. Security

- Keys in `SecretStorage` (OS keychain), never in settings/webview, per project security rules.
- Webview CSP: `default-src 'none'; media-src ${cspSource} blob:; img-src ${cspSource};
  style-src ${cspSource}; script-src 'nonce-...'`.
- `localResourceRoots` includes the media dir and the `globalStorageUri` audio-cache dir so
  `asWebviewUri` can serve synthesized/recorded audio (whitelist the cache dir, not arbitrary
  paths).
- ffmpeg is invoked with a fixed argument vector (no shell interpolation of user text).

## 15. Open items for the implementation plan

- Extension id / publisher / display name (proposed id `vscode-say-it-right`, display
  "Say It Right"); new repo vs sibling folder.
- ffmpeg avfoundation device selection (default index vs `:default`) and clean stop signal;
  confirm the first-run macOS permission flow end-to-end.
- Whether Phase 1.5 word-highlight ships inside the MVP or immediately after.
- Exact default TTS voice + teacher `instructions` wording per provider (tune by ear).
- Reuse strategy detail: straight port of `core/` vs a thin shared package (decide at plan
  time; MVP assumes port-and-own).
- Minimum `engines.vscode` version.
