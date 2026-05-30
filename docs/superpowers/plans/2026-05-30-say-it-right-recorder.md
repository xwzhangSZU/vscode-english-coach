# Say It Right — 🎙 Recorder, Compare & Feedback (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use checkbox (`- [ ]`).

**Goal:** Add an in-extension record button: record the learner's voice (host-side ffmpeg), play it back vs the model audio, get AI text feedback (word-level diff + a coaching tip), and export the recording. **macOS-first.**

**Architecture:** The webview CANNOT use the microphone (VS Code blocks `getUserMedia`). So a 🎙 button messages the extension host, which records from the default input via **`ffmpeg -f avfoundation`** to a temp file, hands it back to the webview via `asWebviewUri` for A/B playback, and runs ASR (Plan 2's `transcribe`) + a word-diff + an optional LLM tip for feedback. Verified feasible on the target machine (ffmpeg at `/opt/homebrew/bin/ffmpeg`; VS Code declares `NSMicrophoneUsageDescription`). First record triggers a one-time macOS mic-permission prompt.

**Tech Stack:** TypeScript, Vitest, Node `child_process`, VS Code Webview. Reuses Plan 2's `core/transcribe.ts`.

**Prereq:** Plans 1 (MVP) and 2 (word-highlight, for `core/transcribe.ts`) merged to `main`. New branch: `git checkout -b say-it-right-recorder`.

**Out of scope:** Windows/Linux capture (different ffmpeg input — follow-up); phoneme-level scoring (LLM gives qualitative feedback only); realtime.

---

## File Structure
```
src/core/feedback.ts          pure word-diff: target vs learner       (Task 1, TDD)
src/vscode/recorder.ts        ffmpeg record start/stop (macOS)        (Task 2: arg-builder TDD + class smoke)
src/vscode/player/panel.ts    +record/stop/compare/exportMine handlers (Task 3)
media/player/player.js+css    +🎙 Record / ▶ Your take / Compare / ⤓   (Task 4)
package.json                  macOS guard / messaging                  (Task 5)
```

---

## Task 1: `core/feedback.ts` — word-diff (TDD)

**Files:** Create `src/core/feedback.ts`; Test `test/core/feedback.test.ts`.

- [ ] **Step 1 — failing test**:
```typescript
import { describe, it, expect } from "vitest";
import { compareWords } from "../../src/core/feedback";

describe("compareWords", () => {
  it("reports matched count, missed, and extra words (case/punct-insensitive)", () => {
    const r = compareWords("I really want it.", "I want it");
    expect(r.matched).toBe(3);
    expect(r.total).toBe(4);
    expect(r.missed).toEqual(["really"]);
    expect(r.extra).toEqual([]);
  });
  it("flags extra words the learner added", () => {
    const r = compareWords("Go now", "Go go now please");
    expect(r.extra).toEqual(["go", "please"]); // normalized extras
    expect(r.missed).toEqual([]);
  });
  it("coverage is matched/total in [0,1]", () => {
    expect(compareWords("a b c d", "a b").coverage).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2 — run failing.**
- [ ] **Step 3 — implement** `src/core/feedback.ts`:
```typescript
export interface WordFeedback { matched: number; total: number; coverage: number; missed: string[]; extra: string[]; }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']+/g, " ").trim().split(/\s+/).filter(Boolean);

/** Compare a target sentence against the learner's transcript. Order-insensitive multiset diff. */
export function compareWords(target: string, hyp: string): WordFeedback {
  const t = norm(target), h = norm(hyp);
  const hPool = new Map<string, number>();
  for (const w of h) hPool.set(w, (hPool.get(w) ?? 0) + 1);
  const missed: string[] = [];
  let matched = 0;
  for (const w of t) {
    const n = hPool.get(w) ?? 0;
    if (n > 0) { matched++; hPool.set(w, n - 1); } else missed.push(w);
  }
  const extra: string[] = [];
  for (const [w, n] of hPool) for (let i = 0; i < n; i++) extra.push(w);
  return { matched, total: t.length, coverage: t.length ? matched / t.length : 0, missed, extra };
}
```
- [ ] **Step 4 — pass.** **Step 5 — commit:** `git commit -m "feat: word-level pronunciation feedback diff"`.

> Optional LLM coaching tip is wired in Task 3 (panel), reusing `generateWithProvider` with a short JSON schema `{tip: string}` over the target + transcript + missed/extra — not a separate core module.

---

## Task 2: `vscode/recorder.ts` — ffmpeg capture (arg-builder TDD + class smoke)

**Files:** Create `src/core/ffmpeg-args.ts` (pure, TDD) + `src/vscode/recorder.ts` (process mgmt, smoke). Keep the pure arg-builder in `core/` so it's unit-testable.

- [ ] **Step 1 — failing test** `test/core/ffmpeg-args.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildAvfoundationArgs } from "../../src/core/ffmpeg-args";

describe("buildAvfoundationArgs", () => {
  it("builds a mac avfoundation audio-only capture to a wav path", () => {
    expect(buildAvfoundationArgs(":default", "/tmp/take.wav")).toEqual([
      "-y", "-f", "avfoundation", "-i", ":default", "-ac", "1", "-ar", "16000", "/tmp/take.wav",
    ]);
  });
});
```
- [ ] **Step 2 — implement** `src/core/ffmpeg-args.ts`:
```typescript
/** ffmpeg args for a mono 16kHz wav capture from a macOS avfoundation audio device. */
export function buildAvfoundationArgs(inputDevice: string, outPath: string): string[] {
  return ["-y", "-f", "avfoundation", "-i", inputDevice, "-ac", "1", "-ar", "16000", outPath];
}
```
- [ ] **Step 3 — pass + commit** (`git commit -m "feat: ffmpeg avfoundation arg builder"`).
- [ ] **Step 4 — `src/vscode/recorder.ts`** (process management; macOS-only; smoke-tested):
```typescript
import * as vscode from "vscode";
import { spawn, ChildProcess, execFile } from "node:child_process";
import { buildAvfoundationArgs } from "../core/ffmpeg-args";

const FFMPEG = "/opt/homebrew/bin/ffmpeg"; // TODO: resolve via `which`/config setting in a follow-up

export class Recorder {
  private proc?: ChildProcess;
  private outPath?: string;

  static async ffmpegAvailable(): Promise<boolean> {
    return new Promise((res) => execFile(FFMPEG, ["-version"], (e) => res(!e)));
  }

  async start(outPath: string): Promise<void> {
    if (process.platform !== "darwin") throw new Error("Recording is macOS-only in this version.");
    if (!(await Recorder.ffmpegAvailable())) throw new Error("ffmpeg not found. Install it: brew install ffmpeg");
    this.outPath = outPath;
    this.proc = spawn(FFMPEG, buildAvfoundationArgs(":default", outPath), { stdio: ["pipe", "ignore", "pipe"] });
    this.proc.stderr?.on("data", (b) => { const s = String(b); if (/Permission|not authorized/i.test(s)) void vscode.window.showWarningMessage("Grant VS Code microphone access: System Settings › Privacy & Security › Microphone."); });
  }

  /** Stop gracefully (send 'q' to ffmpeg) and resolve the file path. */
  stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = this.proc, out = this.outPath;
      if (!p || !out) return reject(new Error("Not recording."));
      p.on("close", () => resolve(out));
      p.on("error", reject);
      p.stdin?.write("q"); p.stdin?.end();
      this.proc = undefined;
    });
  }
}
```
- [ ] **Step 5 — smoke** (real mic): F5 → call start→stop via a temporary test command → confirm a non-empty `.wav` is produced after granting mic permission once. Commit: `git commit -m "feat: host-side ffmpeg recorder (macOS)"`.

---

## Task 3: panel handlers — record / stop / compare / export (smoke)

**Files:** Modify `src/vscode/player/panel.ts`.

- [ ] **Step 1** — Hold a `Recorder` instance + `lastRecordingUri`. Add `localResourceRoots` entry for a `recordings` dir under `globalStorageUri`.
- [ ] **Step 2** — `case "record"`: make `recordings/<ts>.wav` path under globalStorage, `await recorder.start(path)`, post `{type:"recording-started"}`; catch → post `{type:"error", message}` (ffmpeg-missing/permission messages flow through).
- [ ] **Step 3** — `case "stopRecord"`: `const file = await recorder.stop()`; `this.lastRecordingUri = Uri.file(file)`; post `{type:"recording", src: asWebviewUri(...)}`.
- [ ] **Step 4** — `case "compare"`: read the recording bytes → `transcribeOpenAI/qwen` (Plan 2) → `compareWords(currentSentence, asr.text)` → optionally one `generateWithProvider` call for a `{tip}` → post `{type:"feedback", matched, total, coverage, missed, extra, tip}`. Wrap in try/catch.
- [ ] **Step 5** — `case "exportMine"`: `showSaveDialog` + `workspace.fs.copy(lastRecordingUri, …)`.
- [ ] **Step 6** — build + smoke: `npm run check` clean. Commit: `git commit -m "feat: panel record/compare/export handlers"`.

---

## Task 4: webview record UI + feedback (smoke)

**Files:** Modify `media/player/player.js`, `media/player/player.css`; add buttons to `panel.ts html()` controls: `🎙 Record` (toggles to `⏹ Stop`), `▶ Your take`, `Compare`, `⤓ Export mine`, and a `#feedback` div.

- [ ] **Step 1** — `🎙 Record` click → send `record`, swap label to `⏹ Stop`; next click → send `stopRecord`, swap back.
- [ ] **Step 2** — handle `recording` → store `mySrc`, enable `▶ Your take` (a second `<audio id="myaudio">`) and `Compare`/`Export mine`.
- [ ] **Step 3** — `▶ Your take` plays `mySrc`; `Compare` → send `compare`; `Export mine` → send `exportMine`.
- [ ] **Step 4** — handle `feedback` → render in `#feedback`: `匹配 {matched}/{total} ({coverage}%) · 漏读: {missed} · 多读: {extra}` + the `tip`.
- [ ] **Step 5** — smoke: F5 → Record → speak → Stop → Your take plays → Compare shows the diff + tip → Export mine saves a file.
- [ ] **Step 6 — commit:** `git commit -m "feat: webview record/compare/feedback UI"`.

---

## Task 5: platform guard + UX + README (smoke)

- [ ] **Step 1** — In `panel.ts html()`, only render the record controls when `process.platform === "darwin"` (pass a flag into the HTML), with a small note otherwise ("Recording is macOS-only in this version").
- [ ] **Step 2** — First-run UX: if `Recorder.ffmpegAvailable()` is false, the record handler already posts the `brew install ffmpeg` hint; surface it inline in `#feedback`.
- [ ] **Step 3** — README: add a "🎙 Record & compare (macOS)" subsection (record → A/B playback → AI feedback → export; needs ffmpeg + a one-time mic grant).
- [ ] **Step 4 — commit:** `git commit -m "feat: macOS guard + first-run mic UX + README for recorder"`.

---

## Self-Review
- Spec coverage: design §2 goal 6 (record/compare/feedback/export) + §3.2 (host-side ffmpeg feasibility) → Tasks 1–5. ✓
- Types: `WordFeedback` (T1) is what the `feedback` message carries (T3→T4). `buildAvfoundationArgs` (T2) feeds `Recorder` (T2). `transcribeOpenAI` reused from Plan 2.
- Risks to verify live (per design §3): the **first-run macOS mic-permission prompt actually grants** to the VS-Code-spawned ffmpeg (smoke Task 2 step 5) — if it silently fails, fall back to the manual "import your recording" flow (a follow-up). The hardcoded `FFMPEG` path should become a `which`/`sayItRight.ffmpegPath` setting before shipping widely. Do NOT trigger a JS dialog; surface permission errors via `showWarningMessage`/`#feedback` only.
