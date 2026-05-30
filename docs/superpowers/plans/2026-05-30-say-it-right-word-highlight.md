# Say It Right — Karaoke Word-Highlight (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use checkbox (`- [ ]`).

**Goal:** Highlight each word in the prosody stave in sync with the model audio as it plays, and let the user click a word to seek to it.

**Architecture:** After the model audio is synthesized, run ASR on *that audio* to get per-word timestamps, align them onto the analysis words, send the timings to the webview, and drive highlighting from the `<audio>` element's `timeupdate`. All in the existing `vscode-english-coach` repo (now "Say It Right"), reusing the MVP's `core/`/`vscode/` boundary, caching, and conventions.

**Tech Stack:** TypeScript, Vitest, VS Code Webview. ASR word timestamps via **OpenAI `whisper-1`** (`response_format=verbose_json`, `timestamp_granularities=["word"]`) or **Qwen `qwen3-asr-flash-filetrans`** (`enable_words:true`, async submit/poll) / `paraformer-v2`.

**Source of truth:** `docs/superpowers/specs/2026-05-30-say-it-right-vscode-design.md` §8–9. Conventions (branch, `test/core/`, scoped commits, TDD) follow `2026-05-30-say-it-right-vscode-mvp.md`.

**Prereq:** Plan 1 (MVP) merged to `main`. Start this on a new branch `git checkout -b say-it-right-wordhl` off `main`.

**Out of scope:** recording (Plan 3); non-OpenAI/Qwen ASR.

---

## File Structure
```
src/core/transcribe.ts     ASR → { text, words[] }            (Task 1, TDD)
src/core/align.ts          ASR words → stave token timings    (Task 2, TDD)
src/vscode/asr-cache.ts    cache ASR timings by audio hash    (Task 3)
src/vscode/player/panel.ts  +transcribe→align→post "timings"  (Task 3)
media/player/player.js     +highlight on timeupdate, click-seek (Task 4)
media/player/player.css    +.word.active style                (Task 4)
```

---

## Task 1: `core/transcribe.ts` — ASR with word timestamps (TDD)

**Files:** Create `src/core/transcribe.ts`; Test `test/core/transcribe.test.ts`.

- [ ] **Step 1 — failing test** `test/core/transcribe.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeOpenAI } from "../../src/core/transcribe";

describe("transcribeOpenAI", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs multipart to /audio/transcriptions and returns words with timings", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({
      text: "Go now", words: [{ word: "Go", start: 0.0, end: 0.3 }, { word: "now", start: 0.3, end: 0.6 }],
    }) });
    const r = await transcribeOpenAI(Buffer.from([1,2,3]), "wav", { apiKey: "k", baseURL: "https://api.openai.com/v1" });
    expect(r.text).toBe("Go now");
    expect(r.words).toEqual([{ word: "Go", start: 0, end: 0.3 }, { word: "now", start: 0.3, end: 0.6 }]);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer k");
    // body is FormData with model=whisper-1, response_format=verbose_json, timestamp_granularities[]=word
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws the API error text on non-ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 400, text: async () => "bad" });
    await expect(transcribeOpenAI(Buffer.from([1]), "wav", { apiKey: "k", baseURL: "https://api.openai.com/v1" }))
      .rejects.toThrow(/400|bad/);
  });
});
```

- [ ] **Step 2 — run failing:** `npx vitest run test/core/transcribe.test.ts` → fail (module missing).

- [ ] **Step 3 — implement** `src/core/transcribe.ts`:
```typescript
export interface AsrWord { word: string; start: number; end: number; }
export interface AsrResult { text: string; words: AsrWord[]; }
export interface OpenAIAsrConfig { apiKey: string; baseURL: string; model?: string; signal?: AbortSignal; }

/** OpenAI Whisper transcription with word timestamps (verbose_json). */
export async function transcribeOpenAI(audio: Buffer, ext: string, cfg: OpenAIAsrConfig): Promise<AsrResult> {
  const form = new FormData();
  form.append("file", new Blob([audio]), `audio.${ext}`);
  form.append("model", cfg.model ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const url = `${cfg.baseURL.replace(/\/+$/, "")}/audio/transcriptions`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: cfg.signal });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `ASR HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string; words?: AsrWord[] };
  return { text: data.text ?? "", words: (data.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })) };
}
```
> Qwen path (`transcribeQwenFiletrans`) is a follow-up within this task if the user's provider is qwen: submit to `POST {dashscopeBase}/api/v1/services/audio/asr/transcription` with header `X-DashScope-Async: enable`, model `qwen3-asr-flash-filetrans`, `parameters:{enable_words:true}`, poll `…/api/v1/tasks/{id}`, download `transcription_url`, map `sentences[].words[]` (`begin_time`/`end_time` ms ÷ 1000). Add a sibling test mocking submit+poll+download. Keep it behind the same `AsrResult` return shape so Task 3 is provider-agnostic.

- [ ] **Step 4 — pass:** `npx vitest run test/core/transcribe.test.ts` → green.
- [ ] **Step 5 — commit:** `git add src/core/transcribe.ts test/core/transcribe.test.ts && git commit -m "feat: ASR transcription with word timestamps (whisper-1)"`

---

## Task 2: `core/align.ts` — map ASR words onto stave tokens (TDD)

**Files:** Create `src/core/align.ts`; Test `test/core/align.test.ts`.

- [ ] **Step 1 — failing test**:
```typescript
import { describe, it, expect } from "vitest";
import { alignTimings } from "../../src/core/align";

describe("alignTimings", () => {
  it("matches tokens to ASR words by normalized text, in order", () => {
    const tokens = ["I", "really", "want", "it"];
    const asr = [
      { word: "I", start: 0, end: 0.1 }, { word: "really", start: 0.1, end: 0.5 },
      { word: "want", start: 0.5, end: 0.8 }, { word: "it.", start: 0.8, end: 1.0 },
    ];
    expect(alignTimings(tokens, asr, 1.0)).toEqual([
      { start: 0, end: 0.1 }, { start: 0.1, end: 0.5 }, { start: 0.5, end: 0.8 }, { start: 0.8, end: 1.0 },
    ]);
  });
  it("falls back to proportional timing when ASR is empty", () => {
    const out = alignTimings(["a", "b"], [], 2.0);
    expect(out).toEqual([{ start: 0, end: 1 }, { start: 1, end: 2 }]);
  });
});
```

- [ ] **Step 2 — run failing.**
- [ ] **Step 3 — implement** `src/core/align.ts`:
```typescript
import { AsrWord } from "./transcribe";

export interface TokenTiming { start: number; end: number; }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Map each stave token to a {start,end}. Greedy in-order match on normalized text; proportional fallback. */
export function alignTimings(tokenTexts: string[], asr: AsrWord[], durationSec: number): TokenTiming[] {
  if (asr.length === 0) {
    const step = durationSec / Math.max(1, tokenTexts.length);
    return tokenTexts.map((_t, i) => ({ start: i * step, end: (i + 1) * step }));
  }
  const out: TokenTiming[] = [];
  let j = 0;
  for (let i = 0; i < tokenTexts.length; i++) {
    const t = norm(tokenTexts[i]);
    let k = j;
    while (k < asr.length && norm(asr[k].word) !== t) k++;
    if (k < asr.length) { out.push({ start: asr[k].start, end: asr[k].end }); j = k + 1; }
    else { const prev = out[i - 1]; out.push({ start: prev?.end ?? 0, end: prev?.end ?? 0 }); }
  }
  return out;
}
```
- [ ] **Step 4 — pass.** **Step 5 — commit:** `git commit -m "feat: align ASR word timings onto stave tokens"`.

---

## Task 3: panel + ASR cache — produce timings (smoke)

**Files:** Create `src/vscode/asr-cache.ts` (mirror `audio-cache.ts`, key by audio file hash); Modify `src/vscode/player/panel.ts`.

- [ ] **Step 1** — `asr-cache.ts`: `getCachedTimings(context, audioKey): TokenTiming[]|undefined` and `putTimings(context, audioKey, timings)` persisted as JSON under `globalStorageUri/asr-cache/<key>.json`. (Pure JSON I/O; verified by compile + reuse.)
- [ ] **Step 2** — In `panel.ts handleSynthesize`, AFTER `cacheAudio` returns the file and you `post("audio", …)`: also kick off timing generation:
  - compute `audioKey` (reuse the `key` already computed);
  - if cached timings exist → post them; else: read the audio bytes, call `transcribeOpenAI`/qwen (provider from `getTtsTarget`/`getAnalysisConfig`, with the right key/baseURL), get the audio duration (use the analysis token count fallback if duration unknown — pass `0` and rely on proportional only when ASR empty), `alignTimings(currentStaveTokenTexts, asr.words, durationSec)`, cache, and `post({ type: "timings", timings })`.
  - Wrap in try/catch → on failure just skip (no highlight; never break playback).
  - Keep the current sentence's stave token texts available on the instance (store them when posting `analysis`).
- [ ] **Step 3** — build + smoke: `npm run check` clean; F5 → analyze → Play → confirm a `timings` message arrives (check webview devtools) without errors.
- [ ] **Step 4 — commit:** `git commit -m "feat: generate + cache word timings after synthesis"`.

---

## Task 4: webview highlight + click-seek (smoke)

**Files:** Modify `media/player/player.js`, `media/player/player.css`.

- [ ] **Step 1** — In `renderStave`, give each word element `dataset.index` = a running token counter across all groups, and store the element list (e.g. `window.__words = []`).
- [ ] **Step 2** — Handle `{type:"timings", timings}`: store `timings` (array aligned to the running token index).
- [ ] **Step 3** — On `audio.addEventListener("timeupdate", …)`: find the token whose `[start,end)` contains `audio.currentTime`, add class `active` to it and remove from others. Clear on `ended`.
- [ ] **Step 4** — Click a word → `audio.currentTime = timings[index].start; audio.play()`.
- [ ] **Step 5** — `player.css`: `.word.active .txt { background: var(--vscode-editor-selectionBackground); border-radius: 3px; }`.
- [ ] **Step 6** — smoke: F5 → Play → the spoken word highlights in time; click a later word → audio jumps there.
- [ ] **Step 7 — commit:** `git commit -m "feat: karaoke word-highlight + click-to-seek in player"`.

---

## Self-Review
- Spec coverage: design §2 goal 5 (word-highlight) + §8 ASR timestamps + §9 click-to-seek → Tasks 1–4. ✓
- Types: `AsrWord`/`AsrResult` (T1) used by `alignTimings` (T2) and panel (T3); `TokenTiming` (T2) posted as `timings` and consumed by player.js (T4) by running index. Keep the running-index contract identical between `renderStave` (T4 step1) and the `timings` array order (T3 align input = same token order).
- Cost note: one extra ASR call per sentence per voice — cached. If the active provider lacks ASR (e.g. analysis=deepseek), fall back to the proportional timing (ASR empty path) rather than erroring.
