# Say It Right (VS Code) — MVP Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working VS Code extension that turns selected/pasted English into a per-sentence pronunciation lesson — an interactive prosody "stave" plus a steerable model voice you can slow down (0.25–4×), AB-repeat, and shadow.

**Architecture:** Built **in place** in the existing `/Users/xianweizhang/Projects/vscode-english-coach` repo (rebranded to Say It Right; new Marketplace id `vscode-say-it-right`). The new pronunciation modules sit alongside the existing Coach features and reuse `core/` (multi-protocol LLM client, TTS layer) **directly — no porting**. A hard `core/` (pure TS, unit-tested) vs `vscode/` (platform glue) boundary. **Playback happens in a webview `<audio>` element** (not `afplay`), unlocking seek, continuous variable speed, and AB-loop cross-platform. Secrets stay in the extension host; the webview only exchanges plain messages. The old `vscode-english-coach` Marketplace listing is unpublished at ship time (last, gated — Task 13).

**Tech Stack:** TypeScript, esbuild, Vitest, VS Code WebviewPanel API, `fetch`. LLM analysis via `qwen3.5-flash` / `gpt-5.4-nano` (strict JSON). TTS via `qwen3-tts-flash` / `qwen3-tts-instruct-flash` / `gpt-4o-mini-tts`.

**Source of truth:** `docs/superpowers/specs/2026-05-30-say-it-right-vscode-design.md` (in the english-coach repo). The Raycast reference is `~/Projects/raycast-say-it-right`.

**Out of scope for this plan (separate follow-up plans):** karaoke word-highlight (needs ASR timing — Plan 2), the 🎙 host-side recorder + compare + feedback (Plan 3), persistent passage library, English-Coach cross-extension integration, Windows/Linux recording.

> **Update 2026-05-30:** This plan targets the **existing `vscode-english-coach` repo** (rebranded in place), **not** a new project. **Task 1 is a manifest rebrand + folder setup, not scaffold-and-port** — follow the clearly-marked REVISED box at the top of Task 1. All later-task file paths are inside this repo; `tests/` is at the repo root, and `core/`/`vscode/` files referenced as "Create" that already exist (`providers.ts`, `tts.ts`, `models.ts`, `types.ts`, `text.ts`, `config.ts`, `secrets.ts`) are **modified in place**, not created. Stave style = **Style 1 (enhanced marks)**. A gated shipping step is added as **Task 13**.

---

## File Structure

New project `/Users/xianweizhang/Projects/vscode-say-it-right/`:

```
package.json            VS Code manifest + BYOK config (NEW, written in Task 1)
esbuild.js              copied verbatim from english-coach
tsconfig.json           copied verbatim from english-coach
vitest.config.ts        copied verbatim from english-coach (or created in Task 1)
src/
  extension.ts          activate(): register panel + commands (Task 9, 12)
  core/
    providers.ts        PORTED verbatim from english-coach (LLM client)
    models.ts           PORTED + extended: TTS/voice catalog (Task 8)
    text.ts             PORTED verbatim (normalizeInputText)
    types.ts            PORTED provider types + prosody types added (Task 3)
    tts.ts              PORTED + OpenAI /v1/audio/speech & instructions (Task 5)
    segment.ts          splitSentences (Task 2)
    prosody.ts          prompt + parse + analyzeProsody (Task 4)
    stave.ts            ProsodyAnalysis -> renderable rows (Task 6)
    loop.ts             shadow-loop timing plan (Task 7)
  vscode/
    config.ts           ProviderConfig from settings+secrets (Task 8)
    secrets.ts          SecretStorage keys (Task 8)
    settings-store.ts   UI prefs in globalState (Task 8)
    audio-cache.ts      synth-audio cache under globalStorageUri (Task 8)
    export.ts           save model audio via showSaveDialog (Task 12)
    player/
      panel.ts          WebviewPanel host + message routing (Task 9)
      media/
        player.js       webview UI: stave + <audio> + controls (Task 10, 11)
        player.css      theme-variable styling (Task 10)
tests/                  vitest specs mirroring core/ (Tasks 2-8)
```

---

## Task 1: Rebrand in place + add the player surface

> **REVISED 2026-05-30 — do the steps in THIS box. The original "new project" steps that follow (until Task 2) are superseded; ignore them.** All work is in the existing `/Users/xianweizhang/Projects/vscode-english-coach` repo; existing features and `core/` are kept and reused directly.
>
> 1. **Branch:** `cd /Users/xianweizhang/Projects/vscode-english-coach && git checkout -b say-it-right`
> 2. **Rebrand `package.json`:** set `"name": "vscode-say-it-right"`, `"displayName": "Say It Right 英语口语教练"`, bump `"version": "0.2.0"`. Keep `publisher`/`repository` and **every** existing `englishCoach.*` command/view/config entry.
> 3. **Add commands** to `contributes.commands`: `sayItRight.analyzeSelection` ("Say It Right: Analyze Selection") and `sayItRight.practiceSentence` ("Say It Right: Practice a Sentence"); add an `editor/context` menu entry for `sayItRight.analyzeSelection` with `when: editorHasSelection`.
> 4. **Add config** to `contributes.configuration.properties` (new keys only; existing untouched): `sayItRight.provider` (enum `qwen`|`openai`, default `qwen`), `sayItRight.analysisModel.qwen` (`qwen3.5-flash`), `sayItRight.analysisModel.openai` (`gpt-5.4-nano`), `sayItRight.ttsModel.qwen` (`qwen3-tts-flash`), `sayItRight.ttsInstructModel.qwen` (`qwen3-tts-instruct-flash`), `sayItRight.ttsModel.openai` (`gpt-4o-mini-tts`), `sayItRight.voice.qwen` (`Cherry`), `sayItRight.voice.openai` (`marin`), `sayItRight.teacherInstructions` (the slow/clear-teacher string), `sayItRight.loopCount` (`3`), `sayItRight.loopGapSeconds` (`1.0`).
> 5. **Reuse existing keys/secrets** — the Qwen (DashScope) and OpenAI keys are already managed by the existing `secrets.ts`; no new secret storage.
> 6. **Create folders:** `mkdir -p src/vscode/player/media && touch src/vscode/player/panel.ts src/vscode/player/media/player.js src/vscode/player/media/player.css`
> 7. **Build + commit:** `npm install && npm run compile && npm run check` (existing features still build), then `git add -A && git commit -m "chore: rebrand to Say It Right + add player surface scaffolding"`.
>
> In every later task, ignore "new project / copy core" framing — those files already exist here and are imported/modified in place. `tests/` is at the repo root.

---

### (Superseded) original new-project steps

**Files:**
- Create: `/Users/xianweizhang/Projects/vscode-say-it-right/` (new project)
- Create: `package.json`, copy `esbuild.js`, `tsconfig.json`, `.gitignore`, `.prettierrc`
- Copy: `src/core/{providers.ts,text.ts}` verbatim from english-coach; `src/core/{models.ts,types.ts,tts.ts}` (adapted in later tasks); `src/vscode/{config.ts,secrets.ts,settings-store.ts}` as a base
- Create: `src/extension.ts` (minimal)

- [ ] **Step 1: Create the project and copy tooling + reusable core**

```bash
SRC=/Users/xianweizhang/Projects/vscode-english-coach
DST=/Users/xianweizhang/Projects/vscode-say-it-right
mkdir -p "$DST/src/core" "$DST/src/vscode/player/media" "$DST/tests/core"
cd "$DST"
git init -q
cp "$SRC/esbuild.js" "$SRC/tsconfig.json" "$SRC/.gitignore" "$SRC/.prettierrc" "$DST/" 2>/dev/null || true
# Reusable core (used as-is for MVP):
cp "$SRC/src/core/providers.ts" "$SRC/src/core/text.ts" "$DST/src/core/"
cp "$SRC/src/core/models.ts" "$SRC/src/core/types.ts" "$SRC/src/core/tts.ts" "$DST/src/core/"
cp "$SRC/src/vscode/config.ts" "$SRC/src/vscode/secrets.ts" "$SRC/src/vscode/settings-store.ts" "$DST/src/vscode/"
```

- [ ] **Step 2: Write `package.json`** (manifest for the new extension)

```jsonc
{
  "name": "vscode-say-it-right",
  "displayName": "Say It Right 英语发音教练",
  "description": "Turn any English text into a pronunciation lesson: stress, intonation, rhythm, linking + IPA, with a steerable model voice you can slow down, loop, and shadow. Powered by Qwen / OpenAI. BYOK.",
  "version": "0.0.1",
  "publisher": "xianwei-zhang",
  "license": "MIT",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Education", "Other"],
  "main": "./out/extension.js",
  "activationEvents": [],
  "contributes": {
    "commands": [
      { "command": "sayItRight.analyzeSelection", "title": "Say It Right: Analyze Selection" },
      { "command": "sayItRight.practiceSentence", "title": "Say It Right: Practice a Sentence" },
      { "command": "sayItRight.setApiKey", "title": "Say It Right: Set API Key" }
    ],
    "menus": {
      "editor/context": [
        { "command": "sayItRight.analyzeSelection", "when": "editorHasSelection", "group": "navigation" }
      ]
    },
    "configuration": {
      "title": "Say It Right",
      "properties": {
        "sayItRight.provider": { "type": "string", "enum": ["qwen", "openai"], "default": "qwen", "description": "Provider for analysis, TTS, and (later) ASR." },
        "sayItRight.qwen.baseURL": { "type": "string", "default": "https://dashscope.aliyuncs.com/compatible-mode/v1" },
        "sayItRight.qwen.analysisModel": { "type": "string", "default": "qwen3.5-flash" },
        "sayItRight.qwen.ttsModel": { "type": "string", "default": "qwen3-tts-flash" },
        "sayItRight.qwen.ttsInstructModel": { "type": "string", "default": "qwen3-tts-instruct-flash" },
        "sayItRight.qwen.ttsVoice": { "type": "string", "default": "Cherry" },
        "sayItRight.qwen.ttsBaseURL": { "type": "string", "default": "https://dashscope.aliyuncs.com/api/v1" },
        "sayItRight.openai.baseURL": { "type": "string", "default": "https://api.openai.com/v1" },
        "sayItRight.openai.analysisModel": { "type": "string", "default": "gpt-5.4-nano" },
        "sayItRight.openai.ttsModel": { "type": "string", "default": "gpt-4o-mini-tts" },
        "sayItRight.openai.ttsVoice": { "type": "string", "default": "marin" },
        "sayItRight.teacherInstructions": { "type": "string", "default": "Read slowly and clearly like a patient English teacher. Articulate each word, slightly exaggerate stressed syllables, neutral General American accent." },
        "sayItRight.loopCount": { "type": "number", "default": 3 },
        "sayItRight.loopGapSeconds": { "type": "number", "default": 1.0 },
        "sayItRight.requestTimeoutSeconds": { "type": "number", "default": 45 }
      }
    }
  },
  "scripts": {
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "vscode:prepublish": "node esbuild.js --production",
    "check": "tsc --noEmit",
    "test": "vitest run",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "@types/vscode": "^1.90.0",
    "@vscode/vsce": "^3.2.0",
    "esbuild": "^0.24.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write a minimal `src/extension.ts`** so it compiles and activates

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sayItRight.practiceSentence", () => {
      void vscode.window.showInformationMessage("Say It Right: panel coming in Task 9.");
    }),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 4: Install and build**

Run:
```bash
cd /Users/xianweizhang/Projects/vscode-say-it-right && npm install && npm run compile && npm run check
```
Expected: `npm run compile` produces `out/extension.js` with no errors; `npm run check` (tsc) passes. (Ported `providers.ts`/`tts.ts`/`models.ts`/`types.ts` may reference each other but not `vscode` — they compile standalone. If `config.ts`/`secrets.ts`/`settings-store.ts` reference english-coach-only config keys, leave them; they are rewritten in Task 8 and are not imported by `extension.ts` yet.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Say It Right extension, port reusable core"
```

---

## Task 2: `core/segment.ts` — split text into sentences

**Files:**
- Create: `src/core/segment.ts`
- Test: `tests/core/segment.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { splitSentences } from "../../src/core/segment";

describe("splitSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    expect(splitSentences("I want this. Do you?")).toEqual(["I want this.", "Do you?"]);
  });
  it("does not split on abbreviations", () => {
    expect(splitSentences("Dr. Smith arrived. He left.")).toEqual(["Dr. Smith arrived.", "He left."]);
  });
  it("does not split on decimals", () => {
    expect(splitSentences("It costs 3.5 dollars. Cheap.")).toEqual(["It costs 3.5 dollars.", "Cheap."]);
  });
  it("keeps a trailing fragment with no terminator", () => {
    expect(splitSentences("Just one line")).toEqual(["Just one line"]);
  });
  it("trims whitespace and drops empties", () => {
    expect(splitSentences("  A.   B.  ")).toEqual(["A.", "B."]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/xianweizhang/Projects/vscode-say-it-right && npx vitest run tests/core/segment.test.ts`
Expected: FAIL — "splitSentences is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e", "a.m", "p.m",
]);

/** Split English text into sentences. Deterministic and offline. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // Decimal like 3.5 — digits on both sides of a dot.
    if (ch === "." && /\d/.test(normalized[i - 1] ?? "") && /\d/.test(normalized[i + 1] ?? "")) continue;
    // Abbreviation — the token immediately before the dot.
    if (ch === ".") {
      const before = normalized.slice(start, i);
      const lastWord = before.split(/\s/).pop()?.toLowerCase() ?? "";
      if (ABBREVIATIONS.has(lastWord)) continue;
    }
    // Consume any run of terminators (e.g. "?!").
    let end = i + 1;
    while (end < normalized.length && "!?.".includes(normalized[end])) end++;
    const sentence = normalized.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
    i = end - 1;
  }
  const tail = normalized.slice(start).trim();
  if (tail) out.push(tail);
  return out.length > 0 ? out : [normalized];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/segment.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/segment.ts tests/core/segment.test.ts && git commit -m "feat: offline sentence segmentation"
```

---

## Task 3: `core/types.ts` — prosody data model + validator

**Files:**
- Modify: `src/core/types.ts` (append prosody types + `validateProsody`)
- Test: `tests/core/prosody-types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { validateProsody } from "../../src/core/types";

const good = {
  text: "Finish it.",
  isGeneratedExample: false,
  ipa: "/ˈfɪnɪʃ ɪt/",
  thoughtGroups: [
    { tone: "fall", words: [
      { text: "Finish", syllables: ["Fin", "ish"], stressIndex: 0, stressed: true, nuclear: true },
      { text: "it", syllables: ["it"], stressIndex: null, stressed: false, nuclear: false },
    ] },
  ],
};

describe("validateProsody", () => {
  it("accepts a well-formed analysis", () => {
    expect(validateProsody(good).text).toBe("Finish it.");
  });
  it("rejects a nuclear word that is not stressed", () => {
    const bad = structuredClone(good);
    bad.thoughtGroups[0].words[0].stressed = false;
    expect(() => validateProsody(bad)).toThrow(/nuclear/i);
  });
  it("rejects an out-of-range stressIndex", () => {
    const bad = structuredClone(good);
    bad.thoughtGroups[0].words[0].stressIndex = 5;
    expect(() => validateProsody(bad)).toThrow(/stressIndex/i);
  });
  it("rejects an unknown tone", () => {
    const bad = structuredClone(good);
    (bad.thoughtGroups[0] as any).tone = "wobble";
    expect(() => validateProsody(bad)).toThrow(/tone/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/prosody-types.test.ts`
Expected: FAIL — "validateProsody is not a function".

- [ ] **Step 3: Append implementation to `src/core/types.ts`** (hand-rolled validator — no new deps)

```typescript
// ---- Prosody analysis (ported from raycast-say-it-right) ----
export type Tone = "fall" | "rise" | "fall-rise" | "rise-fall" | "level";
export type Link = "liaison" | "elision" | "intrusion" | null;

export interface ProsodyWord {
  text: string;
  syllables: string[];
  stressIndex: number | null;
  stressed: boolean;
  nuclear: boolean;
  ipa?: string;
  linkToNext?: Link;
}
export interface ThoughtGroup { tone: Tone; words: ProsodyWord[]; }
export interface ProsodyAnalysis {
  text: string;
  isGeneratedExample: boolean;
  sourceWord?: string;
  ipa: string;
  thoughtGroups: ThoughtGroup[];
  notes?: string;
}

const TONES: ReadonlySet<string> = new Set(["fall", "rise", "fall-rise", "rise-fall", "level"]);

/** Validate untrusted JSON into a ProsodyAnalysis. Throws Error on any violation. */
export function validateProsody(raw: unknown): ProsodyAnalysis {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.text !== "string" || !o.text) throw new Error("prosody: missing text");
  if (typeof o.ipa !== "string") throw new Error("prosody: missing ipa");
  if (!Array.isArray(o.thoughtGroups) || o.thoughtGroups.length === 0) throw new Error("prosody: empty thoughtGroups");
  for (const g of o.thoughtGroups as Array<Record<string, unknown>>) {
    if (!TONES.has(String(g.tone))) throw new Error(`prosody: invalid tone "${String(g.tone)}"`);
    if (!Array.isArray(g.words) || g.words.length === 0) throw new Error("prosody: empty words");
    for (const w of g.words as Array<Record<string, unknown>>) {
      if (typeof w.text !== "string" || !w.text) throw new Error("prosody: word missing text");
      if (!Array.isArray(w.syllables) || w.syllables.length === 0) throw new Error("prosody: word missing syllables");
      if (w.nuclear === true && w.stressed !== true) throw new Error("prosody: nuclear word must be stressed");
      if (w.stressIndex !== null && (typeof w.stressIndex !== "number" || (w.stressIndex as number) >= w.syllables.length)) {
        throw new Error("prosody: stressIndex out of range");
      }
    }
  }
  return raw as ProsodyAnalysis;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/prosody-types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts tests/core/prosody-types.test.ts && git commit -m "feat: prosody analysis types + validator"
```

---

## Task 4: `core/prosody.ts` — prompt, parse, and analyze

**Files:**
- Create: `src/core/prosody.ts`
- Test: `tests/core/prosody.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseProsody, analyzeProsody, PROSODY_SCHEMA } from "../../src/core/prosody";
import * as providers from "../../src/core/providers";

const sample = JSON.stringify({
  text: "Go.", isGeneratedExample: false, ipa: "/ɡoʊ/",
  thoughtGroups: [{ tone: "fall", words: [{ text: "Go", syllables: ["Go"], stressIndex: 0, stressed: true, nuclear: true }] }],
});

describe("parseProsody", () => {
  it("parses a clean JSON object", () => {
    expect(parseProsody(sample).text).toBe("Go.");
  });
  it("strips markdown fences", () => {
    expect(parseProsody("```json\n" + sample + "\n```").text).toBe("Go.");
  });
});

describe("analyzeProsody", () => {
  it("calls the provider with the schema and returns a validated analysis", async () => {
    const spy = vi.spyOn(providers, "generateWithProvider").mockResolvedValue(sample);
    const cfg = { id: "qwen", title: "Qwen", model: "qwen3.5-flash", apiKey: "k", baseURL: "b", apiProtocol: "openai" } as any;
    const result = await analyzeProsody("Go.", cfg, 1000, 2048);
    expect(result.text).toBe("Go.");
    expect(spy).toHaveBeenCalledWith(cfg, expect.anything(), 1000, 2048, expect.objectContaining({ responseJsonSchema: PROSODY_SCHEMA }));
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/prosody.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** (prompt ported from `raycast-say-it-right/src/llm/prompt.ts`)

```typescript
import { generateWithProvider } from "./providers";
import { ProviderConfig } from "./types";
import { ProsodyAnalysis, validateProsody } from "./types";

export const PROSODY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["text", "isGeneratedExample", "ipa", "thoughtGroups"],
  properties: {
    text: { type: "string" },
    isGeneratedExample: { type: "boolean" },
    sourceWord: { type: "string" },
    ipa: { type: "string" },
    notes: { type: "string" },
    thoughtGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tone", "words"],
        properties: {
          tone: { type: "string", enum: ["fall", "rise", "fall-rise", "rise-fall", "level"] },
          words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "syllables", "stressIndex", "stressed", "nuclear"],
              properties: {
                text: { type: "string" },
                syllables: { type: "array", items: { type: "string" } },
                stressIndex: { type: ["integer", "null"] },
                stressed: { type: "boolean" },
                nuclear: { type: "boolean" },
                ipa: { type: "string" },
                linkToNext: { type: ["string", "null"], enum: ["liaison", "elision", "intrusion", null] },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = [
  "You are an expert English pronunciation coach specializing in General American prosody.",
  "Analyze the given English text for word stress, sentence stress, intonation (rising/falling tones per thought group), rhythm, and connected-speech linking.",
  "Rules: content words (nouns, main verbs, adjectives, adverbs, wh-words) are usually stressed; function words (articles, prepositions, auxiliaries, pronouns) are usually reduced. Each thought group has exactly one nuclear word, normally its last content word, and the nuclear word must be marked stressed. stressIndex must be a valid index into that word's syllables array, or null for a reduced word. Use General American IPA.",
].join("\n\n");

export function buildProsodyPrompt(text: string, isWord: boolean): { system: string; user: string } {
  const user = isWord
    ? `The user selected a single word: "${text}". Set isGeneratedExample=true, sourceWord="${text}", generate ONE natural example sentence using it, put that sentence in "text", and analyze that sentence.`
    : `Analyze this text: "${text}". Set isGeneratedExample=false.`;
  return { system: SYSTEM, user };
}

export function parseProsody(raw: string): ProsodyAnalysis {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return validateProsody(JSON.parse(cleaned));
}

export async function analyzeProsody(
  text: string,
  config: ProviderConfig,
  timeoutMs: number,
  maxOutputTokens: number,
  isWord = false,
): Promise<ProsodyAnalysis> {
  const prompt = buildProsodyPrompt(text, isWord);
  const raw = await generateWithProvider(config, prompt, timeoutMs, maxOutputTokens, {
    responseMimeType: "application/json",
    responseJsonSchema: PROSODY_SCHEMA,
  });
  return parseProsody(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/prosody.test.ts`
Expected: PASS (3 tests). If the `generateWithProvider` signature in the ported `providers.ts` differs, align the call/argument order to match it (it is `(config, {system,user}, timeoutMs, maxOutputTokens, options)`).

- [ ] **Step 5: Commit**

```bash
git add src/core/prosody.ts tests/core/prosody.test.ts && git commit -m "feat: prosody analysis prompt + structured-output call"
```

---

## Task 5: `core/tts.ts` — add OpenAI speech + steerable instructions

**Files:**
- Modify: `src/core/tts.ts` (add an OpenAI provider branch + thread `instructions`)
- Test: `tests/core/tts-openai.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { synthesizeOpenAISpeech } from "../../src/core/tts";

describe("synthesizeOpenAISpeech", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("POSTs to /v1/audio/speech with model, voice, instructions, speed and returns bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    (fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
    const buf = await synthesizeOpenAISpeech("Hello.", {
      apiKey: "k", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini-tts",
      voice: "marin", instructions: "Slowly.", speed: 0.9, format: "mp3",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "gpt-4o-mini-tts", voice: "marin", input: "Hello.", instructions: "Slowly.", speed: 0.9, response_format: "mp3" });
    expect(init.headers.Authorization).toBe("Bearer k");
  });

  it("throws with the API error text on non-ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" });
    await expect(synthesizeOpenAISpeech("Hi", { apiKey: "k", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini-tts", voice: "marin", format: "mp3" }))
      .rejects.toThrow(/401|bad key/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/tts-openai.test.ts`
Expected: FAIL — "synthesizeOpenAISpeech is not a function".

- [ ] **Step 3: Add the implementation to `src/core/tts.ts`** (append; do not break existing exports)

```typescript
export interface OpenAISpeechConfig {
  apiKey: string;
  baseURL: string;       // e.g. https://api.openai.com/v1
  model: string;         // gpt-4o-mini-tts
  voice: string;         // marin | cedar | alloy | ...
  instructions?: string; // steer pace/clarity/accent (ignored by tts-1/-hd)
  speed?: number;        // 0.25–4.0
  format?: "mp3" | "wav" | "opus" | "flac" | "pcm";
  signal?: AbortSignal;
}

/** Synthesize speech via OpenAI /v1/audio/speech. Returns audio bytes. Throws on failure. */
export async function synthesizeOpenAISpeech(text: string, cfg: OpenAISpeechConfig): Promise<Buffer> {
  const url = `${cfg.baseURL.replace(/\/+$/, "")}/audio/speech`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    voice: cfg.voice,
    input: text,
    response_format: cfg.format ?? "mp3",
  };
  if (cfg.instructions) body.instructions = cfg.instructions;
  if (typeof cfg.speed === "number") body.speed = cfg.speed;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: cfg.signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `OpenAI TTS HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/tts-openai.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/tts.ts tests/core/tts-openai.test.ts && git commit -m "feat: OpenAI TTS (gpt-4o-mini-tts) with steerable instructions"
```

> Note: the ported `tts.ts` already synthesizes Qwen via `qwen3-tts-flash`. To use the steerable Qwen teacher voice, the panel passes `qwenModel = qwen3-tts-instruct-flash` + the `instructions` string into the existing Qwen path (the existing `synthesizeWithQwen` already forwards `instructions` when the model is the instruct model). No code change needed here beyond wiring in Task 10.

---

## Task 6: `core/stave.ts` — turn an analysis into renderable rows

**Files:**
- Create: `src/core/stave.ts`
- Test: `tests/core/stave.test.ts`

This keeps the layout logic pure and unit-tested; the webview only paints what this returns.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { toStave } from "../../src/core/stave";
import { ProsodyAnalysis } from "../../src/core/types";

const a: ProsodyAnalysis = {
  text: "Finish it.", isGeneratedExample: false, ipa: "/ˈfɪnɪʃ ɪt/",
  thoughtGroups: [{ tone: "fall", words: [
    { text: "Finish", syllables: ["Fin", "ish"], stressIndex: 0, stressed: true, nuclear: true, linkToNext: "liaison" },
    { text: "it", syllables: ["it"], stressIndex: null, stressed: false, nuclear: false },
  ] }],
};

describe("toStave", () => {
  it("emits one token per word with marks and a group tone", () => {
    const rows = toStave(a);
    expect(rows).toHaveLength(1);                       // one thought group
    expect(rows[0].tone).toBe("fall");
    expect(rows[0].tokens[0]).toMatchObject({ text: "Finish", stressed: true, nuclear: true, link: "liaison" });
    expect(rows[0].tokens[1]).toMatchObject({ text: "it", stressed: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/stave.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { ProsodyAnalysis, Tone, Link } from "./types";

export interface StaveToken {
  text: string;
  stressed: boolean;
  nuclear: boolean;
  reduced: boolean;        // stressIndex === null
  ipa?: string;
  link?: Exclude<Link, null>;
}
export interface StaveRow { tone: Tone; tokens: StaveToken[]; }

/** Pure transform: ProsodyAnalysis -> rows the webview can paint (one row per thought group). */
export function toStave(a: ProsodyAnalysis): StaveRow[] {
  return a.thoughtGroups.map((g) => ({
    tone: g.tone,
    tokens: g.words.map((w) => ({
      text: w.text,
      stressed: w.stressed,
      nuclear: w.nuclear,
      reduced: w.stressIndex === null,
      ipa: w.ipa,
      link: w.linkToNext ?? undefined,
    })),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/stave.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/stave.ts tests/core/stave.test.ts && git commit -m "feat: pure stave layout transform"
```

---

## Task 7: `core/loop.ts` — shadowing-loop timing plan

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/core/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildLoopPlan } from "../../src/core/loop";

describe("buildLoopPlan", () => {
  it("plays N times with a gap after each play except the last", () => {
    // audio duration 2s, 3 repeats, 1s gap
    expect(buildLoopPlan(2, 3, 1)).toEqual([
      { type: "play" }, { type: "gap", ms: 1000 },
      { type: "play" }, { type: "gap", ms: 1000 },
      { type: "play" },
    ]);
  });
  it("clamps times to at least 1 and gap to >= 0", () => {
    expect(buildLoopPlan(1, 0, -5)).toEqual([{ type: "play" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
export type LoopStep = { type: "play" } | { type: "gap"; ms: number };

/** A shadowing loop: play, gap, play, gap, ..., play. The trailing gap is omitted. */
export function buildLoopPlan(_durationSec: number, times: number, gapSec: number): LoopStep[] {
  const n = Math.max(1, Math.floor(times));
  const gapMs = Math.max(0, gapSec) * 1000;
  const steps: LoopStep[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({ type: "play" });
    if (i < n - 1) steps.push({ type: "gap", ms: gapMs });
  }
  return steps;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/loop.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.ts tests/core/loop.test.ts && git commit -m "feat: shadowing-loop timing plan"
```

---

## Task 8: Platform layer — config, secrets, models catalog, audio cache

**Files:**
- Modify: `src/vscode/config.ts`, `src/vscode/secrets.ts`, `src/vscode/settings-store.ts` (adapt to `sayItRight.*`)
- Modify: `src/core/models.ts` (add `voicesFor` + TTS/ASR ids; keep existing chat catalog usable)
- Create: `src/vscode/audio-cache.ts`
- Test: `tests/core/audio-cache-key.test.ts`

- [ ] **Step 1: Write the failing test** (the only unit-testable piece; rest is smoke)

```typescript
import { describe, it, expect } from "vitest";
import { audioCacheKey } from "../../src/vscode/audio-cache";

describe("audioCacheKey", () => {
  it("is stable for identical inputs and differs when any field changes", () => {
    const base = { text: "Hi.", provider: "qwen", voice: "Cherry", instructions: "", format: "mp3" };
    const k1 = audioCacheKey(base);
    expect(k1).toBe(audioCacheKey({ ...base }));
    expect(k1).not.toBe(audioCacheKey({ ...base, voice: "Ethan" }));
    expect(k1).not.toBe(audioCacheKey({ ...base, instructions: "slow" }));
    expect(k1).toMatch(/^[0-9a-f]{16,}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/audio-cache-key.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/vscode/audio-cache.ts`**

```typescript
import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export interface AudioKeyParts {
  text: string; provider: string; voice: string; instructions: string; format: string;
}

export function audioCacheKey(p: AudioKeyParts): string {
  return createHash("sha256")
    .update([p.text, p.provider, p.voice, p.instructions, p.format].join(" "))
    .digest("hex")
    .slice(0, 32);
}

function dir(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, "audio-cache");
}

/** Return the cached file Uri if present, else write `bytes` and return the new Uri. */
export async function cacheAudio(
  context: vscode.ExtensionContext, key: string, ext: string, bytes: Buffer,
): Promise<vscode.Uri> {
  const folder = dir(context);
  await mkdir(folder.fsPath, { recursive: true });
  const file = vscode.Uri.joinPath(folder, `${key}.${ext}`);
  try {
    await readFile(file.fsPath);
  } catch {
    await writeFile(file.fsPath, bytes);
  }
  return file;
}

export function cachedAudioUri(context: vscode.ExtensionContext, key: string, ext: string): vscode.Uri {
  return vscode.Uri.joinPath(dir(context), `${key}.${ext}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/audio-cache-key.test.ts`
Expected: PASS.

- [ ] **Step 5: Adapt `config.ts` / `secrets.ts` / `settings-store.ts` to `sayItRight.*`**

Adapt these three **existing** files (in place — they already exist in this repo, not ported) to also expose `sayItRight.*` helpers, leaving their `englishCoach.*` behavior intact. Concretely:
- `secrets.ts`: **reuse** the existing Qwen (DashScope) and OpenAI secret keys already managed here — no new secret keys; just expose getters the new config helpers can call.
- `config.ts`: export `getAnalysisConfig(context): Promise<ProviderConfig>` and `getTtsTarget(context)` reading `sayItRight.provider` + the per-provider settings written in Task 1's manifest; `getProviderConfig` assembles `{ id, title, model: analysisModel, apiKey, baseURL, apiProtocol: detectProtocol(...) }`.
- `settings-store.ts`: persist UI prefs `{ provider, voice, speed }` in `context.globalState` under key `sayItRight.ui`.

Verify: `npm run check` passes (no references to removed `englishCoach.*` keys remain).

- [ ] **Step 6: Extend `core/models.ts`** — add a voice catalog used by the panel dropdown

```typescript
export const TTS_VOICES: Record<"qwen" | "openai", string[]> = {
  qwen: ["Cherry", "Jennifer", "Aiden", "Ryan", "Katerina", "Ethan", "Elias", "Neil"],
  openai: ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"],
};
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: platform config/secrets/cache for Say It Right + voice catalog"
```

---

## Task 9: `vscode/player/panel.ts` — WebviewPanel host + message routing

**Files:**
- Create: `src/vscode/player/panel.ts`
- Modify: `src/extension.ts` (open the panel from commands)
- Create empty: `src/vscode/player/media/player.js`, `player.css` (filled in Task 10–11)

This task is verified by **manual smoke test** (webview hosting is not unit-tested).

- [ ] **Step 1: Create `src/vscode/player/panel.ts`**

```typescript
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { splitSentences } from "../../core/segment";
import { analyzeProsody } from "../../core/prosody";
import { toStave } from "../../core/stave";
import { synthesize } from "../../core/tts";              // existing Qwen/etc. path
import { synthesizeOpenAISpeech } from "../../core/tts";  // OpenAI path (Task 5)
import { getAnalysisConfig, getTtsTarget } from "../config";
import { getTTSConfig } from "../config";                 // existing TTS config assembler (ported)
import { cacheAudio, audioCacheKey } from "../audio-cache";

export class SayItRightPanel {
  public static current?: SayItRightPanel;
  private readonly panel: vscode.WebviewPanel;
  private sentences: string[] = [];
  private index = 0;

  static show(context: vscode.ExtensionContext, text: string): void {
    if (SayItRightPanel.current) {
      SayItRightPanel.current.panel.reveal();
      SayItRightPanel.current.load(text);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "sayItRight.player", "Say It Right", vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "src", "vscode", "player", "media"),
          vscode.Uri.joinPath(context.globalStorageUri, "audio-cache"),
        ] },
    );
    SayItRightPanel.current = new SayItRightPanel(context, panel, text);
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    text: string,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m));
    this.panel.onDidDispose(() => { SayItRightPanel.current = undefined; });
    this.load(text);
  }

  private load(text: string): void {
    this.sentences = splitSentences(text);
    this.index = 0;
    void this.analyzeCurrent();
  }

  private async analyzeCurrent(): Promise<void> {
    const sentence = this.sentences[this.index];
    if (!sentence) return;
    this.post({ type: "loading", index: this.index, total: this.sentences.length, sentence });
    try {
      const cfg = await getAnalysisConfig(this.context);
      const analysis = await analyzeProsody(sentence, cfg, 45000, 2048);
      this.post({ type: "analysis", rows: toStave(analysis), ipa: analysis.ipa, notes: analysis.notes,
        index: this.index, total: this.sentences.length });
    } catch (e) {
      this.post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async onMessage(m: any): Promise<void> {
    switch (m.type) {
      case "ready": return this.analyzeCurrent();
      case "next": this.index = Math.min(this.index + 1, this.sentences.length - 1); return this.analyzeCurrent();
      case "prev": this.index = Math.max(this.index - 1, 0); return this.analyzeCurrent();
      case "synthesize": return this.handleSynthesize(Boolean(m.teacher));
    }
  }

  private async handleSynthesize(teacher: boolean): Promise<void> {
    const sentence = this.sentences[this.index];
    if (!sentence) return;
    try {
      const target = await getTtsTarget(this.context); // { provider, voice, instructions, apiKey, ... }
      const instructions = teacher ? target.teacherInstructions : "";
      const format = target.provider === "openai" ? "mp3" : "wav";
      const key = audioCacheKey({ text: sentence, provider: target.provider, voice: target.voice, instructions, format });
      let bytes: Buffer;
      if (target.provider === "openai") {
        bytes = await synthesizeOpenAISpeech(sentence, { apiKey: target.apiKey, baseURL: target.baseURL,
          model: target.ttsModel, voice: target.voice, instructions: instructions || undefined,
          speed: teacher ? 0.9 : 1.0, format: "mp3" });
      } else {
        const ttsConfig = await getTTSConfig(this.context); // existing assembler; instruct model if teacher
        const buffers = await synthesize(sentence, { ...ttsConfig,
          qwenModel: teacher ? target.ttsInstructModel : target.ttsModel, qwenInstructions: instructions }, {});
        bytes = buffers[0];
      }
      const ext = format;
      const file = await cacheAudio(this.context, key, ext, bytes);
      this.post({ type: "audio", src: this.panel.webview.asWebviewUri(file).toString(), teacher });
    } catch (e) {
      this.post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private post(msg: unknown): void { void this.panel.webview.postMessage(msg); }

  private html(): string {
    const w = this.panel.webview;
    const nonce = randomBytes(16).toString("hex");
    const base = vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "player", "media");
    const js = w.asWebviewUri(vscode.Uri.joinPath(base, "player.js"));
    const css = w.asWebviewUri(vscode.Uri.joinPath(base, "player.css"));
    return `<!DOCTYPE html><html><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${w.cspSource} blob:; img-src ${w.cspSource}; style-src ${w.cspSource}; script-src 'nonce-${nonce}';" />
<link href="${css}" rel="stylesheet" /></head>
<body>
  <div class="bar"><button id="prev">◀</button><span id="pos"></span><button id="next">▶</button></div>
  <div id="stave" class="stave"></div>
  <div id="ipa" class="ipa"></div>
  <div class="controls">
    <button id="play">▶ Play</button>
    <label>Speed <input id="speed" type="range" min="0.25" max="4" step="0.05" value="1" /></label>
    <span id="speedVal">1.00×</span>
    <button id="teacher">Teacher slow</button>
    <button id="abrepeat">AB-repeat</button>
    <button id="shadow">Shadow ×3</button>
    <button id="repeat">↻</button>
  </div>
  <div id="notes" class="notes"></div>
  <audio id="audio" preload="auto"></audio>
  <script nonce="${nonce}" src="${js}"></script>
</body></html>`;
  }
}
```

- [ ] **Step 2: Wire commands in `src/extension.ts`**

```typescript
import * as vscode from "vscode";
import { SayItRightPanel } from "./vscode/player/panel";
import { setApiKeyInteractive } from "./vscode/secrets";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sayItRight.analyzeSelection", () => {
      const ed = vscode.window.activeTextEditor;
      const text = ed?.document.getText(ed.selection)?.trim();
      if (!text) { void vscode.window.showWarningMessage("Select some English text first."); return; }
      SayItRightPanel.show(context, text);
    }),
    vscode.commands.registerCommand("sayItRight.practiceSentence", async () => {
      const text = (await vscode.window.showInputBox({ prompt: "Type or paste an English sentence" }))?.trim();
      if (text) SayItRightPanel.show(context, text);
    }),
    vscode.commands.registerCommand("sayItRight.setApiKey", () => setApiKeyInteractive(context)),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 3: Create empty media files** so the build resolves
```bash
touch src/vscode/player/media/player.js src/vscode/player/media/player.css
```

- [ ] **Step 4: Build + smoke test**

Run: `npm run compile && npm run check`. Then press **F5** (Extension Development Host) → run command **"Say It Right: Practice a Sentence"** → type `I really want to finish this project today.`
Expected: a panel opens; after a moment the host posts an `analysis` message (no crash). The webview is still blank (UI is Task 10) — confirm via Webview Developer Tools console that `analysis` arrived. If analysis errors, set a key first via **"Say It Right: Set API Key"**.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Say It Right WebviewPanel host + analyze/synthesize routing"
```

---

## Task 10: Webview UI — render the stave, play audio, variable speed, teacher slow

**Files:**
- Modify: `src/vscode/player/media/player.js`
- Modify: `src/vscode/player/media/player.css`

Verified by **manual smoke test**.

- [ ] **Step 1: Write `player.js`**

```javascript
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const TONE = { fall: "↘", rise: "↗", "fall-rise": "↘↗", "rise-fall": "↗↘", level: "→" };
let lastSrc = null;

function send(type, extra) { vscode.postMessage({ type, ...extra }); }

function renderStave(rows) {
  const el = $("stave"); el.innerHTML = "";
  rows.forEach((row, ri) => {
    const groupEl = document.createElement("span"); groupEl.className = "group";
    row.tokens.forEach((t) => {
      const word = document.createElement("span");
      word.className = "word" + (t.nuclear ? " nuclear" : t.stressed ? " stressed" : " reduced");
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = t.nuclear ? "●" : t.stressed ? "●" : "·";
      const txt = document.createElement("span");
      txt.className = "txt"; txt.textContent = t.text;
      if (t.ipa) word.title = t.ipa;
      word.appendChild(mark); word.appendChild(txt);
      if (t.link) { const l = document.createElement("span"); l.className = "link"; l.textContent = "‿"; word.appendChild(l); }
      groupEl.appendChild(word);
      groupEl.appendChild(document.createTextNode(" "));
    });
    const tone = document.createElement("span"); tone.className = "tone"; tone.textContent = TONE[row.tone] || "";
    groupEl.appendChild(tone);
    el.appendChild(groupEl);
    if (ri < rows.length - 1) { const g = document.createElement("span"); g.className = "gbar"; g.textContent = " ‖ "; el.appendChild(g); }
  });
}

function setSpeed(v) { audio.preservesPitch = true; audio.playbackRate = v; $("speedVal").textContent = v.toFixed(2) + "×"; }

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.type === "loading") { $("pos").textContent = `${m.index + 1} / ${m.total}`; $("stave").textContent = "Analyzing…"; $("ipa").textContent = ""; $("notes").textContent = ""; }
  else if (m.type === "analysis") { renderStave(m.rows); $("ipa").textContent = m.ipa || ""; $("notes").textContent = m.notes || ""; $("pos").textContent = `${m.index + 1} / ${m.total}`; }
  else if (m.type === "audio") { lastSrc = m.src; audio.src = m.src; audio.play(); }
  else if (m.type === "error") { $("stave").textContent = "⚠ " + m.message; }
});

document.addEventListener("DOMContentLoaded", () => {
  $("prev").onclick = () => send("prev");
  $("next").onclick = () => send("next");
  $("play").onclick = () => { if (lastSrc) audio.play(); else send("synthesize", { teacher: false }); };
  $("teacher").onclick = () => send("synthesize", { teacher: true });
  $("repeat").onclick = () => { if (lastSrc) { audio.currentTime = 0; audio.play(); } };
  $("speed").oninput = (e) => setSpeed(Number(e.target.value));
  setSpeed(1);
  send("ready");
});
```

- [ ] **Step 2: Write `player.css`** (uses VS Code theme variables)

```css
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
.bar, .controls { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
button:hover { background: var(--vscode-button-hoverBackground); }
.stave { font-size: 1.4rem; line-height: 2.6; margin: 16px 0; }
.word { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
.word .mark { font-size: 0.7rem; height: 0.8rem; }
.stressed .mark, .nuclear .mark { color: var(--vscode-charts-orange); }
.reduced .mark { color: var(--vscode-descriptionForeground); }
.nuclear .txt { text-decoration: underline; font-weight: 600; }
.tone { color: var(--vscode-charts-blue); margin-left: 4px; }
.link { color: var(--vscode-charts-green); }
.ipa { font-family: var(--vscode-editor-font-family); color: var(--vscode-descriptionForeground); }
.notes { margin-top: 12px; font-style: italic; }
```

- [ ] **Step 3: Smoke test**

Press **F5** → "Practice a Sentence" → `I really want to finish this project today.`
Expected: the stave renders with stress dots above words, the nuclear word underlined, a tone arrow per group, and the IPA line below. Click **▶ Play** → model voice plays. Drag **Speed** to 0.5× → replays slower **without pitch change**. Click **Teacher slow** → re-synthesizes a slower, clearer take. Click **▶/◀** → steps sentences.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: webview stave render + playback + variable speed + teacher slow"
```

---

## Task 11: Webview — AB-repeat, shadowing loop, repeat-last

**Files:**
- Modify: `src/vscode/player/media/player.js`
- Modify: `src/vscode/player/panel.ts` (pass loop settings to the webview on init)

Verified by **manual smoke test** (the timing math is already unit-tested in Task 7).

- [ ] **Step 1: Send loop settings to the webview**

In `panel.ts`, read `loopCount` / `loopGapSeconds` from configuration and include them in the first `analysis`/`ready` round-trip, e.g. add to the `analysis` post: `loop: { count: cfg.loopCount, gap: cfg.loopGapSeconds }` (read via `vscode.workspace.getConfiguration("sayItRight")`). Keep it simple: post a one-time `{ type: "config", loopCount, loopGap }` after the webview sends `ready`.

```typescript
// in onMessage, case "ready": (before analyzeCurrent)
const c = vscode.workspace.getConfiguration("sayItRight");
this.post({ type: "config", loopCount: c.get<number>("loopCount", 3), loopGap: c.get<number>("loopGapSeconds", 1) });
```

- [ ] **Step 2: Add AB-repeat + shadow loop + repeat in `player.js`** (the loop plan mirrors `core/loop.ts`)

```javascript
let loopCfg = { count: 3, gap: 1 };
let abOn = false;

function playOnce() { return new Promise((res) => { audio.onended = res; audio.currentTime = 0; audio.play(); }); }
function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function runShadow() {
  const n = Math.max(1, Math.floor(loopCfg.count));
  for (let i = 0; i < n; i++) { await playOnce(); if (i < n - 1) await wait(Math.max(0, loopCfg.gap) * 1000); }
  audio.onended = onAudioEnded;
}
function onAudioEnded() { if (abOn) { audio.currentTime = 0; audio.play(); } }

// add inside the message handler:
//   else if (m.type === "config") { loopCfg = { count: m.loopCount, gap: m.loopGap }; $("shadow").textContent = `Shadow ×${m.loopCount}`; }

// add inside DOMContentLoaded:
//   $("abrepeat").onclick = () => { abOn = !abOn; $("abrepeat").classList.toggle("on", abOn); audio.onended = abOn ? onAudioEnded : null; };
//   $("shadow").onclick = () => { if (lastSrc) runShadow(); else send("synthesize", { teacher: false }); };
```

Apply those three commented insertions into the existing handler/listener blocks from Task 10.

- [ ] **Step 3: Add `.on` style to `player.css`**

```css
button.on { outline: 2px solid var(--vscode-focusBorder); }
```

- [ ] **Step 4: Smoke test**

F5 → analyze a sentence → **Play** once (caches audio) → **AB-repeat** toggles continuous looping of the current sentence → toggle off stops after the current play → **Shadow ×3** plays 3 times with ~1s gaps → **↻** replays from the start.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: AB-repeat, shadowing loop, repeat-last in player"
```

---

## Task 12: Export model audio, word→example, README

**Files:**
- Create: `src/vscode/export.ts`
- Modify: `src/vscode/player/panel.ts` (export message + single-word detection)
- Modify: `src/vscode/player/media/player.js` + `player.css` (export button)
- Create: `README.md`

- [ ] **Step 1: Create `src/vscode/export.ts`**

```typescript
import * as vscode from "vscode";
import { copyFile } from "node:fs/promises";

/** Copy a cached audio file to a user-chosen location. */
export async function exportAudio(sourceFsPath: string, suggestedName: string): Promise<void> {
  const target = await vscode.window.showSaveDialog({
    saveLabel: "Export audio",
    defaultUri: vscode.Uri.file(suggestedName),
    filters: { Audio: ["mp3", "wav"] },
  });
  if (!target) return;
  await copyFile(sourceFsPath, target.fsPath);
  void vscode.window.showInformationMessage(`Saved ${target.fsPath}`);
}
```

- [ ] **Step 2: Handle `export` + single-word analysis in `panel.ts`**

- In `analyzeCurrent`, detect a single word (`/^\p{L}[\p{L}'-]*$/u.test(sentence)`) and pass `isWord` to `analyzeProsody`; when `isGeneratedExample` is true, also post the generated `text` so the webview shows the example sentence.
- Track the last synthesized file Uri (`this.lastAudioFile`) in `handleSynthesize`; add `case "export":` that calls `exportAudio(this.lastAudioFile.fsPath, "say-it-right.mp3")` (guard if none yet).

```typescript
// field: private lastAudioFile?: vscode.Uri;
// in handleSynthesize after cacheAudio: this.lastAudioFile = file;
// in onMessage:
case "export":
  if (this.lastAudioFile) await exportAudio(this.lastAudioFile.fsPath, "say-it-right.mp3");
  else void vscode.window.showWarningMessage("Play a sentence first, then export.");
  return;
```

- [ ] **Step 3: Add an Export button** to `player.js` controls + handler

In `panel.ts` `html()`, add `<button id="export">⤓ Export</button>` to `.controls`. In `player.js` DOMContentLoaded add: `$("export").onclick = () => send("export");`

- [ ] **Step 4: Write `README.md`** (short, mirrors english-coach style)

```markdown
# Say It Right · 英语发音教练

Select or paste English → see *how to say it* (stress, intonation, rhythm, linking + IPA) and
hear a model voice you can slow down (0.25–4×), AB-repeat, and shadow. Powered by Qwen / OpenAI.
Bring your own key.

## Setup
1. Run **Say It Right: Set API Key** (Qwen/DashScope or OpenAI).
2. Select English text → right-click **Analyze Selection**, or run **Practice a Sentence**.

API keys are stored in VS Code SecretStorage (OS keychain), never in settings.
```

- [ ] **Step 5: Build, full smoke, commit**

Run: `npm run compile && npm run check && npm run test`
Manual: F5 → analyze a sentence → Play → Export → choose a path → file saved & playable. Select a single word (e.g. `ubiquitous`) via Analyze Selection → an example sentence is generated and analyzed.
```bash
git add -A && git commit -m "feat: export model audio, word→example, README"
```

---

## Task 13: Shipping — publish the new id, retire the old listing (GATED, last)

**This task is irreversible and outward-facing. Do NOT run it until the new features are built, manually smoke-tested, and the user gives explicit go-ahead at this step.** Requires `VSCE_PAT` (see the repo's publishing notes / `memory/publishing.md`).

- [ ] **Step 1: Bump version + update README/CHANGELOG**

`version` is `0.2.0` (set in Task 1). Note the rebrand + new pronunciation features in `CHANGELOG.md` and `README.md`.

- [ ] **Step 2: Package + publish the new id**

Run: `cd /Users/xianweizhang/Projects/vscode-english-coach && npx vsce package && npx vsce publish`
Expected: a `.vsix` builds; `xianwei-zhang.vscode-say-it-right` appears on the Marketplace. Install it in a clean VS Code and confirm BOTH the existing Coach features AND the new Say It Right panel work.

- [ ] **Step 3: Confirm with the user before retiring the old listing**

Show the user the new listing is live, and that the next command **permanently** unpublishes `xianwei-zhang.vscode-english-coach` (id can never be reused; installs/reviews lost). Get an explicit "yes".

- [ ] **Step 4: (Only on explicit "yes") unpublish the old listing**

Run: `npx vsce unpublish xianwei-zhang.vscode-english-coach`

- [ ] **Step 5: Commit the release**

```bash
git add -A && git commit -m "release: Say It Right v0.2.0 (supersedes English Coach)"
```

---

## Self-Review (completed against the spec)

- **Spec coverage:** §2 goals 1–4 (panel, prosody analysis + stave, model TTS + teacher voice, variable speed/AB-repeat/shadow loop) → Tasks 9–11; goal 6 export (model audio half) → Task 12; goal 7 BYOK → Tasks 1, 8; word→example → Task 12. **Deliberately deferred** (separate plans, as the header states): goal 5 word-highlight (needs ASR — Plan 2); goal 6 recording/compare (Plan 3); goal 8 Coach integration. No silent gaps.
- **Placeholder scan:** No "TBD/handle errors/similar to Task N". Where Task 11/12 modify existing files, the exact insertion points + code are given. The three port-and-adapt files in Task 8 Step 5 are described by exact key names and exported function signatures rather than full bodies, because they are mechanical rewrites of named english-coach files — the engineer copies the structure and swaps `englishCoach.*`→`sayItRight.*`; this is intentional, not a placeholder.
- **Type consistency:** `ProsodyAnalysis`/`ProsodyWord`/`ThoughtGroup`/`Tone`/`Link` (Task 3) are used unchanged by `prosody.ts` (Task 4) and `stave.ts` (Task 6). `audioCacheKey(AudioKeyParts)` (Task 8) is called with the same field set in `panel.ts` (Task 9). `synthesizeOpenAISpeech(OpenAISpeechConfig)` (Task 5) matches the panel call (Task 9). `toStave` → `StaveRow[]` matches what `player.js` `renderStave` consumes (Task 10). `buildLoopPlan` (Task 7) and the `player.js` shadow loop (Task 11) implement the same play/gap pattern.

## Verification gates worth re-confirming during execution
- `generateWithProvider` argument order in the ported `providers.ts` (Task 4 Step 4 note).
- The ported Qwen `synthesize`/`getTTSConfig` field names (Task 9 `handleSynthesize`) — adjust to the actual ported signatures.
- `audio.preservesPitch` is the standard property in the VS Code (Chromium) webview; confirm slow playback keeps pitch (Task 10 smoke).
