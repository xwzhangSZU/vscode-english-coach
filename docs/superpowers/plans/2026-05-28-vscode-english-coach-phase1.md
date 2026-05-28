# VS Code English Coach (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose this Raycast extension into a VS Code left-sidebar "English Coach" that rewrites English (or Chinese) into idiomatic native English with a Chinese explanation of why, using BYOK multi-LLM, with manual/clipboard-watch input and read-aloud.

**Architecture:** Two layers with a hard boundary. `src/core/` is platform-agnostic TypeScript over `fetch` + Node built-ins (ported from the Raycast code, never imports `vscode`). `src/vscode/` adapts the platform: configuration, SecretStorage keys, globalState, a webview sidebar, macOS `afplay` audio, commands, and clipboard polling. The webview never holds secrets — all LLM/TTS calls run in the extension host.

**Tech Stack:** TypeScript, esbuild (bundling), vitest (core unit tests), `@vscode/vsce` (packaging). VS Code engine `^1.90.0`. No webview framework (vanilla HTML/CSS/JS). macOS-only read-aloud via `afplay`.

**Reference:** `docs/superpowers/specs/2026-05-28-vscode-english-coach-design.md`.

**Commit policy:** Each task ends with a local commit (no push). The user's standing rule is "commit only when asked" — executing this plan authorizes the local commits it specifies; do not `git push`.

---

## File Structure (Phase 1)

```
package.json              VS Code manifest (rewritten from the Raycast one)
esbuild.js                bundles src/extension.ts -> out/extension.js (cjs, external: vscode)
tsconfig.json             (modified) TS config for the extension
vitest.config.ts          core unit tests
.vscodeignore             trims the published VSIX
.gitignore                (modified) drop Swift .build; add out/
media/
  icon.svg                activity-bar icon
  sidebar.css             webview styles (VS Code theme variables)
  sidebar.js              webview UI logic (vanilla)
src/
  extension.ts            activate()/deactivate(); registers view, commands, watch
  core/                   platform-agnostic — NEVER imports vscode
    types.ts              ProviderConfig, TranslationRequest, RuntimeSettings, ids/enums
    text.ts               normalizeInputText, quoted
    languages.ts          translation target languages + resolveTargetLanguage
    models.ts             model catalog + resolveModel(tier)
    prompt.ts             buildRewriteCoachPrompt + buildTranslationPrompt
    providers.ts          multi-protocol LLM client + detectProtocol
    rewrite.ts            runRewrite -> { rewritten, why }
    tts.ts                synthesize(text, cfg, opts) -> Buffer[]  (no playback)
  vscode/                 platform layer
    secrets.ts            API-key get/set via context.secrets
    config.ts             assemble ProviderConfig from settings + secrets
    settings-store.ts     runtime UI state (mode/tone/provider/watch) in globalState
    audio.ts              play Buffer[] via macOS afplay
    commands.ts           command handlers
    clipboard-watch.ts    visibility-gated clipboard polling
    sidebar/
      provider.ts         WebviewViewProvider: hosts webview, routes messages
test/
  core/
    text.test.ts
    languages.test.ts
    models.test.ts
    providers.test.ts
    rewrite.test.ts
    tts.test.ts
```

Out of scope for this plan (Phase 2, separate plan): `vscode/chat-participant.ts` (`@coach`) and `vscode/history.ts`.

---

## Task 1: Cleanup + VS Code tooling skeleton

**Files:**
- Delete: Raycast UI, OCR, Swift, research, store assets (see Step 1)
- Create: `package.json` (rewrite), `esbuild.js`, `vitest.config.ts`, `.vscodeignore`, `media/icon.svg`, `src/extension.ts`
- Modify: `tsconfig.json`, `.gitignore`

- [ ] **Step 1: Delete dead Raycast/OCR/Swift/research files**

```bash
cd /Users/xianweizhang/Projects/vscode-english-coach
git rm -r \
  src/translate.tsx src/translate-paste.tsx src/rewrite-coach.tsx src/rewrite-replace.tsx \
  src/screenshot-translate.tsx src/screenshot-ocr.tsx src/screenshot-ocr-copy.tsx \
  src/translation-settings.tsx src/history.tsx \
  src/ocr-engines.ts src/recognize-text.ts src/ocr-errors.ts \
  src/preferences.ts src/runtime-settings.ts src/history-store.ts \
  Sources Package.swift scripts/build-swift.sh scripts/generate-icons.mjs \
  raycast-env.d.ts eslint.config.ts \
  assets metadata
git rm -r --ignore-unmatch .build .firecrawl
```

Note: `src/providers.ts`, `prompt.ts`, `rewrite.ts`, `models.ts`, `languages.ts`, `types.ts`, `ui-constants.ts`, `tts.ts` are intentionally kept (ported in later tasks). `CHANGELOG.md`, `README.md`, `.prettierrc`, `Package.swift` removal does not touch them.

- [ ] **Step 2: Write the VS Code manifest `package.json`**

Replace the entire file with:

```json
{
  "name": "vscode-english-coach",
  "displayName": "English Coach",
  "description": "Rewrite your English (or Chinese) into idiomatic native English with a Chinese explanation of why — for learning while you vibe-code.",
  "version": "0.1.0",
  "publisher": "xianwei-zhang",
  "license": "MIT",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Education", "Other"],
  "main": "./out/extension.js",
  "activationEvents": [],
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        { "id": "englishCoach", "title": "English Coach", "icon": "media/icon.svg" }
      ]
    },
    "views": {
      "englishCoach": [
        { "id": "englishCoach.sidebar", "name": "Coach", "type": "webview" }
      ]
    },
    "commands": [
      { "command": "englishCoach.setApiKey", "title": "English Coach: Set API Key" },
      { "command": "englishCoach.coachClipboard", "title": "English Coach: Coach Clipboard Now" },
      { "command": "englishCoach.focus", "title": "English Coach: Open Sidebar" }
    ]
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

- [ ] **Step 3: Write `esbuild.js`**

```js
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "out/extension.js",
    external: ["vscode"],
    sourcemap: !production,
    minify: production,
    logLevel: "info",
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Overwrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "out", "test"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 6: Write `.vscodeignore`**

```
.vscode/**
.vscode-test/**
src/**
test/**
docs/**
node_modules/**
esbuild.js
vitest.config.ts
tsconfig.json
**/*.map
**/*.ts
.gitignore
.prettierrc
package-lock.json
```

- [ ] **Step 7: Overwrite `.gitignore`**

```
node_modules
out
*.vsix
.DS_Store
```

- [ ] **Step 8: Write `media/icon.svg`**

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3.2 4L5 13h1.4l.5-1.3h2.2L9.6 13H11L8.8 8H7.2Zm.8 1.4.6 1.5H7.4l.6-1.5ZM13 8v5h3.2a1.6 1.6 0 0 0 .6-3.1A1.5 1.5 0 0 0 16 8h-3Zm1.3 1.1h1.4a.5.5 0 0 1 0 .9h-1.4v-.9Zm0 1.9h1.6a.55.55 0 0 1 0 1h-1.6v-1Z"/>
</svg>
```

- [ ] **Step 9: Write minimal `src/extension.ts`**

```ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
  );
  console.log("English Coach activated");
}

export function deactivate(): void {}
```

- [ ] **Step 10: Install dependencies and remove Raycast deps**

```bash
npm pkg delete dependencies
npm install
```

Run: `npm install`
Expected: installs devDependencies; no `@raycast/api`/`react` in the tree.

- [ ] **Step 11: Verify build**

Run: `npm run compile`
Expected: esbuild prints a success line; `out/extension.js` exists.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: remove Raycast/OCR/Swift cruft and scaffold VS Code extension"
```

---

## Task 2: Port `core/text.ts`

**Files:**
- Create: `src/core/text.ts`
- Delete: `src/ui-constants.ts`
- Test: `test/core/text.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeInputText, quoted } from "../../src/core/text";

describe("normalizeInputText", () => {
  it("trims, normalizes CRLF, and caps length", () => {
    expect(normalizeInputText("  hi\r\nthere  ")).toBe("hi\nthere");
    expect(normalizeInputText(undefined)).toBe("");
    expect(normalizeInputText("a".repeat(13000)).length).toBe(12000);
  });
});

describe("quoted", () => {
  it("prefixes every line with '> '", () => {
    expect(quoted("a\nb")).toBe("> a\n> b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/text.test.ts`
Expected: FAIL — cannot resolve `../../src/core/text`.

- [ ] **Step 3: Write `src/core/text.ts`**

```ts
export function quoted(text: string): string {
  return text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

export function normalizeInputText(text: string | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim().slice(0, 12000);
}
```

- [ ] **Step 4: Delete the old Raycast file**

```bash
git rm src/ui-constants.ts
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/text.test.ts`
Expected: PASS (3 assertions in 2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): port text utilities, drop Raycast ui-constants"
```

---

## Task 3: Port `core/languages.ts`

**Files:**
- Move: `src/languages.ts` -> `src/core/languages.ts`
- Test: `test/core/languages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveTargetLanguage, getLanguageTitle } from "../../src/core/languages";

describe("resolveTargetLanguage", () => {
  it("honors an explicit non-auto language", () => {
    expect(resolveTargetLanguage("ja", "anything")).toBe("ja");
  });
  it("auto: Chinese text -> en", () => {
    expect(resolveTargetLanguage("auto", "你好世界")).toBe("en");
  });
  it("auto: non-Chinese text -> zh-Hans", () => {
    expect(resolveTargetLanguage("auto", "hello world")).toBe("zh-Hans");
  });
  it("auto: Japanese kana is not treated as Chinese", () => {
    expect(resolveTargetLanguage("auto", "こんにちは")).toBe("zh-Hans");
  });
});

describe("getLanguageTitle", () => {
  it("maps known codes and falls back to the code", () => {
    expect(getLanguageTitle("en")).toBe("English");
    expect(getLanguageTitle("xx")).toBe("xx");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/languages.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Move the file unchanged**

```bash
git mv src/languages.ts src/core/languages.ts
```

(The file is pure and needs no edits.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/languages.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): port languages module"
```

---

## Task 4: Port `core/models.ts`

**Files:**
- Move: `src/models.ts` -> `src/core/models.ts`
- Test: `test/core/models.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveModel, getTierLabel } from "../../src/core/models";

describe("resolveModel", () => {
  it("returns the catalog id for fast/pro", () => {
    expect(resolveModel("deepseek", "fast", "")).toBe("deepseek-v4-flash");
    expect(resolveModel("deepseek", "pro", "")).toBe("deepseek-v4-pro");
  });
  it("returns the custom model for custom tier", () => {
    expect(resolveModel("openai", "custom", "my-model")).toBe("my-model");
  });
});

describe("getTierLabel", () => {
  it("labels known tiers", () => {
    expect(getTierLabel("fast")).toBe("Fast");
    expect(getTierLabel("pro")).toBe("Pro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/models.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Move the file and fix its import**

```bash
git mv src/models.ts src/core/models.ts
```

`models.ts` imports `ProviderId` from `./types`. Since `types.ts` is moved into `core/` in Task 5, this relative import stays correct. No edit needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/models.test.ts`
Expected: PASS (4 assertions). (Requires `core/types.ts` to exist — do Task 5 first if vitest reports a missing `./types`; tasks 4 and 5 may be committed together.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): port models catalog"
```

---

## Task 5: Port `core/types.ts` (strip Raycast Preferences)

**Files:**
- Move + edit: `src/types.ts` -> `src/core/types.ts`

- [ ] **Step 1: Move the file**

```bash
git mv src/types.ts src/core/types.ts
```

- [ ] **Step 2: Remove the Raycast `Preferences` alias**

In `src/core/types.ts`, delete this block (the comment + the alias on what was lines 29-36):

```ts
/**
 * Single source of truth for preferences is Raycast's generated `Preferences`
 * type (from `package.json`, emitted into `raycast-env.d.ts`). We re-export it
 * under the existing name so the rest of the codebase keeps importing
 * `ExtensionPreferences` from here, without hand-maintaining a duplicate that
 * can drift from the manifest.
 */
export type ExtensionPreferences = Preferences;
```

Leave everything else (the `PROVIDER_IDS`, `ProviderId`, `TranslationStyle`, `PromptProfile`, `ModelTier`, `RewriteTone`, `ProviderAPIProtocol`, `TTSProvider`, `RuntimeSettings`, `ProviderConfig`, `TranslationRequest`, `TranslationResult`, `TranslationStatus`) intact.

- [ ] **Step 3: Verify nothing references the removed alias**

Run: `grep -rn "ExtensionPreferences" src/`
Expected: no matches (the only consumers were Raycast files already deleted).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(core): port types, drop Raycast Preferences alias"
```

---

## Task 6: Port `core/prompt.ts`

**Files:**
- Move: `src/prompt.ts` -> `src/core/prompt.ts`
- Test: `test/core/text.test.ts` is unaffected; add a light prompt test below.
- Test: `test/core/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildRewriteCoachPrompt } from "../../src/core/prompt";

describe("buildRewriteCoachPrompt", () => {
  it("includes the selected text and asks for JSON output", () => {
    const { system, user } = buildRewriteCoachPrompt("I has a apple", "casual");
    expect(user).toContain("I has a apple");
    expect(system).toContain("rewritten");
    expect(system).toContain("why");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/prompt.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Move the file unchanged**

```bash
git mv src/prompt.ts src/core/prompt.ts
```

`prompt.ts` imports `RewriteTone, TranslationRequest` from `./types` — valid after Task 5. No edit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): port prompt builders"
```

---

## Task 7: Port `core/providers.ts` + move `detectProtocol`

**Files:**
- Move + edit: `src/providers.ts` -> `src/core/providers.ts`
- Test: `test/core/providers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectProtocol, generateWithProvider } from "../../src/core/providers";
import type { ProviderConfig } from "../../src/core/types";

afterEach(() => vi.restoreAllMocks());

describe("detectProtocol", () => {
  it("gemini and openai are always openai", () => {
    expect(detectProtocol("gemini", "https://x")).toBe("openai");
    expect(detectProtocol("openai", "https://x")).toBe("openai");
  });
  it("anthropic-shaped paths -> anthropic", () => {
    expect(detectProtocol("deepseek", "https://api.deepseek.com/anthropic")).toBe("anthropic");
    expect(detectProtocol("kimi", "https://api.kimi.com/coding")).toBe("anthropic");
  });
  it("moonshot host and /v1 endpoints -> openai", () => {
    expect(detectProtocol("kimi", "https://api.moonshot.ai/v1")).toBe("openai");
  });
  it("falls back to anthropic", () => {
    expect(detectProtocol("mimo", "https://example.com/foo")).toBe("anthropic");
  });
});

describe("generateWithProvider (OpenAI protocol)", () => {
  it("posts to /chat/completions and returns content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 }),
    );
    const config: ProviderConfig = {
      id: "openai",
      title: "OpenAI",
      apiKey: "sk-test",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiProtocol: "openai",
    };
    const out = await generateWithProvider(config, { system: "s", user: "u" }, 5000, 256);
    expect(out).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/providers.test.ts`
Expected: FAIL — cannot resolve module / `detectProtocol` not exported.

- [ ] **Step 3: Move the file**

```bash
git mv src/providers.ts src/core/providers.ts
```

- [ ] **Step 4: Extend the types import and add `detectProtocol`**

In `src/core/providers.ts`, change the second import line from:

```ts
import { ProviderConfig, TranslationRequest } from "./types";
```

to:

```ts
import { ProviderAPIProtocol, ProviderConfig, ProviderId, TranslationRequest } from "./types";
```

Then append this exported function at the end of the file (moved verbatim from the deleted `preferences.ts`):

```ts
/**
 * Pick the wire protocol from the configured base URL so users can flip
 * providers between Anthropic-compatible and OpenAI-compatible endpoints
 * without a separate setting.
 */
export function detectProtocol(id: ProviderId, baseURL: string): ProviderAPIProtocol {
  if (id === "gemini" || id === "openai") return "openai";
  const lower = baseURL.toLowerCase();
  if (lower.includes("/anthropic") || lower.includes("/coding")) return "anthropic";
  if (lower.includes("moonshot.") || /\/v1(\/chat\/completions)?\/?$/.test(lower)) return "openai";
  return "anthropic";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/providers.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): port LLM provider client and detectProtocol"
```

---

## Task 8: Port `core/rewrite.ts`

**Files:**
- Move: `src/rewrite.ts` -> `src/core/rewrite.ts`
- Test: `test/core/rewrite.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseRewriteResult } from "../../src/core/rewrite";

describe("parseRewriteResult", () => {
  it("parses a plain JSON object", () => {
    const r = parseRewriteResult('{"rewritten":"Good.","why":"- clearer"}');
    expect(r.rewritten).toBe("Good.");
    expect(r.why).toBe("- clearer");
  });
  it("parses JSON wrapped in a code fence", () => {
    const r = parseRewriteResult('```json\n{"rewritten":"Hi","why":"- x"}\n```');
    expect(r.rewritten).toBe("Hi");
  });
  it("parses JSON with surrounding prose", () => {
    const r = parseRewriteResult('Here you go: {"rewritten":"Yes","why":"- y"} done');
    expect(r.rewritten).toBe("Yes");
  });
  it("throws on a response with no rewritten text", () => {
    expect(() => parseRewriteResult("not json at all")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/rewrite.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Move the file unchanged**

```bash
git mv src/rewrite.ts src/core/rewrite.ts
```

Imports (`./prompt`, `./providers`, `./types`) remain valid in `core/`. No edit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/rewrite.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): port rewrite/coach logic"
```

---

## Task 9: Rewrite `core/tts.ts` as synthesis-only

**Files:**
- Create: `src/core/tts.ts` (new synthesis-only module)
- Delete: `src/tts.ts` (Raycast version, after extracting)
- Test: `test/core/tts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { splitTextForQwen, wrapPCMInWAV } from "../../src/core/tts";

describe("splitTextForQwen", () => {
  it("returns one chunk for short text", () => {
    expect(splitTextForQwen("Hello there.")).toEqual(["Hello there."]);
  });
  it("splits long text on sentence boundaries", () => {
    const long = ("This is a sentence. ".repeat(40)).trim();
    const chunks = splitTextForQwen(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("This is a sentence.");
  });
});

describe("wrapPCMInWAV", () => {
  it("prepends a 44-byte RIFF/WAVE header", () => {
    const pcm = Buffer.from([0, 1, 2, 3]);
    const wav = wrapPCMInWAV(pcm, 24000);
    expect(wav.length).toBe(44 + 4);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/tts.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write `src/core/tts.ts`**

```ts
import { TTSProvider } from "./types";

export interface TTSConfig {
  provider: TTSProvider;
  geminiApiKey: string;
  geminiVoice: string;
  dashscopeApiKey: string;
  qwenModel: string;
  qwenVoice: string;
  qwenLanguageType: string;
  qwenBaseURL: string;
  qwenInstructions: string;
}

export interface SynthesizeOptions {
  slow?: boolean;
  signal?: AbortSignal;
}

const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_TTS_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_DEFAULT_VOICE = "Kore";
const GEMINI_SAMPLE_RATE = 24000;

const QWEN_TTS_INSTRUCT_MODEL = "qwen3-tts-instruct-flash";
const QWEN_TTS_DEFAULT_MODEL = "qwen3-tts-flash";
const QWEN_TTS_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const QWEN_TTS_DEFAULT_VOICE = "Cherry";
const QWEN_TTS_MAX_CHARS = 550;
const QWEN_TTS_SOFT_CHARS = 420;

const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;

interface GeminiTTSResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  error?: { message?: string };
}

interface QwenTTSResponse {
  output?: { audio?: { data?: string; url?: string } };
  code?: string | number;
  message?: string;
}

/** Synthesize speech and return one playable audio buffer per chunk. Throws on failure. */
export async function synthesize(
  text: string,
  config: TTSConfig,
  options: SynthesizeOptions = {},
): Promise<Buffer[]> {
  const trimmed = text.trim().slice(0, 5000);
  if (!trimmed) return [];

  const slow = Boolean(options.slow);
  const chunks = config.provider === "qwen" ? splitTextForQwen(trimmed) : [trimmed];
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    if (options.signal?.aborted) break;
    const buf =
      config.provider === "qwen"
        ? await synthesizeWithQwen(chunk, slow, config, options.signal)
        : await synthesizeWithGemini(chunk, slow, config, options.signal);
    buffers.push(buf);
  }
  return buffers;
}

async function synthesizeWithGemini(
  text: string,
  slow: boolean,
  config: TTSConfig,
  signal?: AbortSignal,
): Promise<Buffer> {
  const apiKey = config.geminiApiKey.trim();
  if (!apiKey) throw new Error("Add a Gemini API key to use Gemini read-aloud.");
  const voiceName = config.geminiVoice.trim() || GEMINI_DEFAULT_VOICE;
  const spokenText = slow
    ? `Read the following slowly and clearly, enunciating each word like a language teacher helping a learner: ${text}`
    : text;

  const response = await fetch(`${GEMINI_TTS_BASE_URL}/models/${GEMINI_TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: spokenText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
    signal,
  });

  const responseText = await response.text();
  const data = parseJson<GeminiTTSResponse>(responseText);
  if (!response.ok || data.error?.message) {
    throw new Error(data.error?.message ?? `Gemini TTS HTTP ${response.status}`);
  }
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) throw new Error("Gemini TTS returned no audio.");
  return wrapPCMInWAV(Buffer.from(audioBase64, "base64"), GEMINI_SAMPLE_RATE);
}

async function synthesizeWithQwen(
  text: string,
  slow: boolean,
  config: TTSConfig,
  signal?: AbortSignal,
): Promise<Buffer> {
  const apiKey = config.dashscopeApiKey.trim();
  if (!apiKey) throw new Error("Add a DashScope API key to use Qwen read-aloud.");
  const model = config.qwenModel === QWEN_TTS_INSTRUCT_MODEL ? QWEN_TTS_INSTRUCT_MODEL : QWEN_TTS_DEFAULT_MODEL;
  const voice = config.qwenVoice.trim() || QWEN_TTS_DEFAULT_VOICE;
  const languageType = config.qwenLanguageType.trim() || "Auto";
  const instructions =
    model === QWEN_TTS_INSTRUCT_MODEL
      ? [config.qwenInstructions.trim(), slow ? "Read slowly and clearly, enunciating each word." : ""]
          .filter(Boolean)
          .join(" ")
      : "";

  const response = await fetch(qwenGenerationUrl(config.qwenBaseURL), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: { text, voice, language_type: languageType, ...(instructions ? { instructions } : {}) },
    }),
    signal,
  });

  const responseText = await response.text();
  const data = parseJson<QwenTTSResponse>(responseText);
  if (!response.ok || data.message || data.code) {
    throw new Error(data.message ?? `Qwen TTS HTTP ${response.status}`);
  }
  const base64 = data.output?.audio?.data ?? (await fetchUrlAsBase64(data.output?.audio?.url, signal));
  if (!base64) throw new Error("Qwen TTS returned no audio.");
  return Buffer.from(base64, "base64");
}

async function fetchUrlAsBase64(url: string | undefined, signal?: AbortSignal): Promise<string | undefined> {
  if (!url) return undefined;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Qwen TTS audio download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

function qwenGenerationUrl(baseURL: string): string {
  const trimmed = (baseURL.trim() || QWEN_TTS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const suffix = "/services/aigc/multimodal-generation/generation";
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

export function splitTextForQwen(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let count = 0;
  for (const char of text) {
    current += char;
    count += 1;
    if (count >= QWEN_TTS_MAX_CHARS || (count >= QWEN_TTS_SOFT_CHARS && "。！？.!?；;".includes(char))) {
      const chunk = current.trim();
      if (chunk) chunks.push(chunk);
      current = "";
      count = 0;
    }
  }
  const tail = current.trim();
  if (tail) chunks.push(tail);
  return chunks;
}

export function wrapPCMInWAV(pcmData: Buffer, sampleRate: number): Buffer {
  const byteRate = sampleRate * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const blockAlign = PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(PCM_CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

function parseJson<T>(text: string): T & { error?: { message?: string } } {
  try {
    return JSON.parse(text) as T & { error?: { message?: string } };
  } catch {
    return { error: { message: text ? `Invalid response: ${text.slice(0, 100)}` : "Empty response" } } as T & {
      error?: { message?: string };
    };
  }
}
```

- [ ] **Step 4: Delete the Raycast TTS file**

```bash
git rm src/tts.ts
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/tts.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): synthesis-only TTS module (no Raycast, no playback)"
```

---

## Task 10: `vscode/secrets.ts` + Set API Key command

**Files:**
- Create: `src/vscode/secrets.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write `src/vscode/secrets.ts`**

```ts
import * as vscode from "vscode";
import { PROVIDER_IDS, ProviderId } from "../core/types";

export type SecretKeyId = ProviderId | "dashscope";

const SECRET_PREFIX = "englishCoach.secret.";

const SECRET_LABELS: Record<SecretKeyId, string> = {
  deepseek: "DeepSeek",
  mimo: "Xiaomi MiMo",
  gemini: "Gemini",
  kimi: "Kimi",
  openai: "OpenAI / ChatGPT",
  dashscope: "DashScope (Qwen TTS)",
};

export function getSecret(context: vscode.ExtensionContext, id: SecretKeyId): Thenable<string | undefined> {
  return context.secrets.get(`${SECRET_PREFIX}${id}`);
}

export async function setApiKeyInteractive(context: vscode.ExtensionContext): Promise<void> {
  const ids: SecretKeyId[] = [...PROVIDER_IDS, "dashscope"];
  const picked = await vscode.window.showQuickPick(
    ids.map((id) => ({ label: SECRET_LABELS[id], id })),
    { placeHolder: "Which API key do you want to set?" },
  );
  if (!picked) return;
  const value = await vscode.window.showInputBox({
    prompt: `Enter your ${picked.label} API key`,
    password: true,
    ignoreFocusOut: true,
  });
  if (value === undefined) return;
  const key = `${SECRET_PREFIX}${picked.id}`;
  if (value.trim() === "") {
    await context.secrets.delete(key);
    void vscode.window.showInformationMessage(`Cleared ${picked.label} API key.`);
  } else {
    await context.secrets.store(key, value.trim());
    void vscode.window.showInformationMessage(`Saved ${picked.label} API key.`);
  }
}
```

- [ ] **Step 2: Register the command in `src/extension.ts`**

Replace `src/extension.ts` with:

```ts
import * as vscode from "vscode";
import { setApiKeyInteractive } from "./vscode/secrets";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run compile`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Launch the Extension Development Host (press F5 in VS Code, or run the "Run Extension" launch config). In the new window, run "English Coach: Set API Key" from the Command Palette; confirm the provider QuickPick and the password-masked input appear, and that an "Saved … API key" message shows.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(vscode): SecretStorage-backed API keys + Set API Key command"
```

---

## Task 11: package.json configuration + `vscode/config.ts`

**Files:**
- Modify: `package.json` (add `contributes.configuration`)
- Create: `src/vscode/config.ts`

- [ ] **Step 1: Add `contributes.configuration` to `package.json`**

Inside `"contributes"`, add this `"configuration"` block (sibling to `views`/`commands`):

```json
"configuration": {
  "title": "English Coach",
  "properties": {
    "englishCoach.defaultProvider": {
      "type": "string",
      "enum": ["deepseek", "mimo", "gemini", "kimi", "openai"],
      "default": "deepseek",
      "description": "Provider used by default and listed first."
    },
    "englishCoach.providerOrder": {
      "type": "string",
      "default": "deepseek,mimo,gemini,kimi,openai",
      "description": "Comma-separated provider order shown in the switcher."
    },
    "englishCoach.modelTier": {
      "type": "string",
      "enum": ["fast", "pro", "custom"],
      "default": "pro",
      "description": "Which model tier to use. Custom uses each provider's Model setting."
    },
    "englishCoach.requestTimeoutSeconds": { "type": "number", "default": 45 },
    "englishCoach.maxOutputTokens": { "type": "number", "default": 4096 },
    "englishCoach.deepseek.enabled": { "type": "boolean", "default": true },
    "englishCoach.deepseek.baseURL": { "type": "string", "default": "https://api.deepseek.com/anthropic" },
    "englishCoach.deepseek.model": { "type": "string", "default": "deepseek-v4-flash" },
    "englishCoach.mimo.enabled": { "type": "boolean", "default": false },
    "englishCoach.mimo.baseURL": { "type": "string", "default": "https://token-plan-cn.xiaomimimo.com/anthropic" },
    "englishCoach.mimo.model": { "type": "string", "default": "mimo-v2.5-pro" },
    "englishCoach.gemini.enabled": { "type": "boolean", "default": false },
    "englishCoach.gemini.baseURL": { "type": "string", "default": "https://generativelanguage.googleapis.com/v1beta" },
    "englishCoach.gemini.model": { "type": "string", "default": "gemini-3.5-flash" },
    "englishCoach.kimi.enabled": { "type": "boolean", "default": false },
    "englishCoach.kimi.baseURL": { "type": "string", "default": "https://api.kimi.com/coding" },
    "englishCoach.kimi.model": { "type": "string", "default": "kimi-for-coding" },
    "englishCoach.openai.enabled": { "type": "boolean", "default": false },
    "englishCoach.openai.baseURL": { "type": "string", "default": "https://api.openai.com/v1" },
    "englishCoach.openai.model": { "type": "string", "default": "gpt-4.1-mini" },
    "englishCoach.tts.provider": { "type": "string", "enum": ["qwen", "gemini"], "default": "qwen" },
    "englishCoach.tts.qwenModel": { "type": "string", "default": "qwen3-tts-flash" },
    "englishCoach.tts.qwenVoice": { "type": "string", "default": "Cherry" },
    "englishCoach.tts.qwenLanguageType": { "type": "string", "default": "Auto" },
    "englishCoach.tts.qwenBaseURL": { "type": "string", "default": "https://dashscope.aliyuncs.com/api/v1" },
    "englishCoach.tts.qwenInstructions": { "type": "string", "default": "" },
    "englishCoach.tts.geminiVoice": { "type": "string", "default": "Kore" },
    "englishCoach.clipboardWatch.minLength": { "type": "number", "default": 12 }
  }
}
```

- [ ] **Step 2: Write `src/vscode/config.ts`**

```ts
import * as vscode from "vscode";
import { resolveModel } from "../core/models";
import { detectProtocol } from "../core/providers";
import { TTSConfig } from "../core/tts";
import { ModelTier, PROVIDER_IDS, ProviderConfig, ProviderId } from "../core/types";
import { getSecret } from "./secrets";

export const PROVIDER_TITLES: Record<ProviderId, string> = {
  deepseek: "DeepSeek",
  mimo: "Xiaomi MiMo",
  gemini: "Gemini",
  kimi: "Kimi",
  openai: "OpenAI / ChatGPT",
};

function cfg() {
  return vscode.workspace.getConfiguration("englishCoach");
}

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function getOrderedProviderIds(): ProviderId[] {
  const c = cfg();
  const parsed = (c.get<string>("providerOrder") ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(isProviderId);
  const ordered = [...parsed, ...PROVIDER_IDS].filter((id, i, a) => a.indexOf(id) === i);
  const enabled = ordered.filter((id) => c.get<boolean>(`${id}.enabled`) === true);
  const list = enabled.length > 0 ? enabled : [defaultProviderId()];
  const def = defaultProviderId();
  return list.includes(def) ? [def, ...list.filter((id) => id !== def)] : list;
}

export function defaultProviderId(): ProviderId {
  const value = cfg().get<string>("defaultProvider") ?? "deepseek";
  return isProviderId(value) ? value : "deepseek";
}

export function getModelTier(): ModelTier {
  const value = cfg().get<string>("modelTier") ?? "pro";
  return value === "fast" || value === "pro" || value === "custom" ? value : "pro";
}

export function getTimeoutMs(): number {
  const n = cfg().get<number>("requestTimeoutSeconds") ?? 45;
  return Math.min(Math.max(Number.isFinite(n) ? n : 45, 5), 180) * 1000;
}

export function getMaxOutputTokens(): number {
  const n = cfg().get<number>("maxOutputTokens") ?? 4096;
  return Math.min(Math.max(Number.isFinite(n) ? n : 4096, 256), 32768);
}

export async function getProviderConfig(
  context: vscode.ExtensionContext,
  id: ProviderId,
  tier: ModelTier = getModelTier(),
): Promise<ProviderConfig> {
  const c = cfg();
  const baseURL = (c.get<string>(`${id}.baseURL`) ?? "").trim();
  const customModel = (c.get<string>(`${id}.model`) ?? "").trim();
  const apiKey = (await getSecret(context, id)) ?? "";
  return {
    id,
    title: PROVIDER_TITLES[id],
    apiKey,
    baseURL,
    model: resolveModel(id, tier, customModel),
    apiProtocol: detectProtocol(id, baseURL),
  };
}

export async function getTTSConfig(context: vscode.ExtensionContext): Promise<TTSConfig> {
  const c = cfg();
  const provider = c.get<string>("tts.provider") === "gemini" ? "gemini" : "qwen";
  return {
    provider,
    geminiApiKey: (await getSecret(context, "gemini")) ?? "",
    geminiVoice: c.get<string>("tts.geminiVoice") ?? "Kore",
    dashscopeApiKey: (await getSecret(context, "dashscope")) ?? "",
    qwenModel: c.get<string>("tts.qwenModel") ?? "qwen3-tts-flash",
    qwenVoice: c.get<string>("tts.qwenVoice") ?? "Cherry",
    qwenLanguageType: c.get<string>("tts.qwenLanguageType") ?? "Auto",
    qwenBaseURL: c.get<string>("tts.qwenBaseURL") ?? "https://dashscope.aliyuncs.com/api/v1",
    qwenInstructions: c.get<string>("tts.qwenInstructions") ?? "",
  };
}

export function getClipboardMinLength(): number {
  const n = cfg().get<number>("clipboardWatch.minLength") ?? 12;
  return Number.isFinite(n) ? n : 12;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run compile && npm run check`
Expected: both succeed (no type errors).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(vscode): settings schema + provider/TTS config assembly"
```

---

## Task 12: `vscode/settings-store.ts` (runtime UI state)

**Files:**
- Create: `src/vscode/settings-store.ts`

- [ ] **Step 1: Write `src/vscode/settings-store.ts`**

```ts
import * as vscode from "vscode";
import { ProviderId, RewriteTone } from "../core/types";

export type CoachMode = "coach" | "translate";
export type WatchMode = "stage" | "auto";

export interface UiState {
  mode: CoachMode;
  tone: RewriteTone;
  providerId: ProviderId | "";
  targetLanguage: string;
  watchEnabled: boolean;
  watchMode: WatchMode;
}

const KEY = "englishCoach.uiState";

const DEFAULT_STATE: UiState = {
  mode: "coach",
  tone: "natural",
  providerId: "",
  targetLanguage: "auto",
  watchEnabled: false,
  watchMode: "stage",
};

export function loadUiState(context: vscode.ExtensionContext): UiState {
  const saved = context.globalState.get<Partial<UiState>>(KEY) ?? {};
  return { ...DEFAULT_STATE, ...saved };
}

export async function saveUiState(context: vscode.ExtensionContext, patch: Partial<UiState>): Promise<UiState> {
  const next = { ...loadUiState(context), ...patch };
  await context.globalState.update(KEY, next);
  return next;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(vscode): persist runtime UI state in globalState"
```

---

## Task 13: `vscode/audio.ts` (afplay playback)

**Files:**
- Create: `src/vscode/audio.ts`

- [ ] **Step 1: Write `src/vscode/audio.ts`**

```ts
import * as vscode from "vscode";
import { ChildProcess, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { synthesize, TTSConfig } from "../core/tts";

let activePlayback: ChildProcess | undefined;
let activeController: AbortController | undefined;

export function stopSpeaking(): void {
  activeController?.abort();
  activeController = undefined;
  activePlayback?.kill();
  activePlayback = undefined;
}

export async function readAloud(
  context: vscode.ExtensionContext,
  text: string,
  config: TTSConfig,
  options: { slow?: boolean } = {},
): Promise<void> {
  if (process.platform !== "darwin") {
    void vscode.window.showWarningMessage("Read-aloud currently works on macOS only.");
    return;
  }
  stopSpeaking();
  const controller = new AbortController();
  activeController = controller;

  const buffers = await synthesize(text, config, { slow: options.slow, signal: controller.signal });
  for (const buffer of buffers) {
    if (controller.signal.aborted || activeController !== controller) return;
    await play(context, buffer, controller.signal);
  }
  if (activeController === controller) activeController = undefined;
}

async function play(context: vscode.ExtensionContext, data: Buffer, signal: AbortSignal): Promise<void> {
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `tts-${Date.now()}-${randomBytes(4).toString("hex")}.wav`);
  await writeFile(fileUri.fsPath, data);

  await new Promise<void>((resolve, reject) => {
    const child = execFile("/usr/bin/afplay", [fileUri.fsPath], (error) => {
      signal.removeEventListener("abort", abort);
      void unlink(fileUri.fsPath).catch(() => undefined);
      if (activePlayback === child) activePlayback = undefined;
      if (error && !error.killed) {
        reject(error);
        return;
      }
      resolve();
    });
    function abort() {
      child.kill();
    }
    activePlayback = child;
    signal.addEventListener("abort", abort, { once: true });
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(vscode): macOS afplay read-aloud playback"
```

---

## Task 14: Sidebar webview (provider + media)

**Files:**
- Create: `src/vscode/sidebar/provider.ts`
- Create: `media/sidebar.css`
- Create: `media/sidebar.js`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write `media/sidebar.css`**

```css
body { padding: 8px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); font-size: var(--vscode-font-size); }
.row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.row label { font-size: 11px; opacity: 0.8; }
select, textarea, button { font-family: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; }
select { flex: 1; padding: 2px; }
textarea { width: 100%; box-sizing: border-box; min-height: 76px; padding: 6px; resize: vertical; }
.actions { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
button { padding: 4px 8px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; }
button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.watch { display: flex; gap: 6px; align-items: center; font-size: 11px; opacity: 0.9; margin-bottom: 8px; }
hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 8px 0; }
.section-title { font-weight: 600; margin: 4px 0; }
.native { white-space: pre-wrap; padding: 6px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); }
.why { white-space: pre-wrap; }
.muted { opacity: 0.7; font-style: italic; }
.error { color: var(--vscode-errorForeground); }
.error button { margin-top: 6px; }
.hidden { display: none; }
```

- [ ] **Step 2: Write `media/sidebar.js`**

```js
const vscode = acquireVsCodeApi();
let state = { mode: "coach", tone: "natural", providerId: "", targetLanguage: "auto", watchEnabled: false, watchMode: "stage" };
let lastNative = "";

const $ = (id) => document.getElementById(id);

function send(type, payload) { vscode.postMessage({ type, ...payload }); }

function applyState() {
  $("mode").value = state.mode;
  $("tone").value = state.tone;
  $("provider").value = state.providerId;
  $("targetLanguage").value = state.targetLanguage;
  $("watchEnabled").checked = state.watchEnabled;
  $("watchMode").value = state.watchMode;
  const translate = state.mode === "translate";
  $("toneRow").classList.toggle("hidden", translate);
  $("langRow").classList.toggle("hidden", !translate);
  $("whyWrap").classList.toggle("hidden", translate);
}

function setLoading() {
  $("native").textContent = "Coaching…";
  $("native").className = "native muted";
  $("why").textContent = "";
  $("resultActions").classList.add("hidden");
}

function showResult(msg) {
  if (msg.mode === "translate") {
    lastNative = msg.translation || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = "";
  } else {
    lastNative = msg.rewritten || "";
    $("native").textContent = lastNative;
    $("native").className = "native";
    $("why").textContent = msg.why || "";
  }
  $("resultActions").classList.toggle("hidden", !lastNative);
}

function showError(msg) {
  $("native").className = "native error";
  $("native").textContent = msg.message || "Something went wrong.";
  $("why").textContent = "";
  $("resultActions").classList.add("hidden");
  if (msg.action) {
    const btn = document.createElement("button");
    btn.textContent = "Set API key";
    btn.onclick = () => send("setApiKey", {});
    $("native").appendChild(document.createElement("br"));
    $("native").appendChild(btn);
  }
}

function run() {
  const text = $("input").value;
  if (!text.trim()) return;
  if (state.mode === "translate") {
    send("translate", { text, targetLang: state.targetLanguage, providerId: state.providerId });
  } else {
    send("coach", { text, tone: state.tone, providerId: state.providerId });
  }
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    state = msg.state;
    const sel = $("provider");
    sel.innerHTML = "";
    for (const p of msg.providers) {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.title;
      sel.appendChild(opt);
    }
    if (!state.providerId && msg.providers[0]) state.providerId = msg.providers[0].id;
    applyState();
  } else if (msg.type === "loading") setLoading();
  else if (msg.type === "result") showResult(msg);
  else if (msg.type === "error") showError(msg);
  else if (msg.type === "setText" || msg.type === "stage") { $("input").value = msg.text; if (msg.type === "stage") $("input").focus(); }
});

document.addEventListener("DOMContentLoaded", () => {
  $("coach").onclick = run;
  $("fromClipboard").onclick = () => send("fromClipboard", {});
  $("copy").onclick = () => send("copy", { text: lastNative });
  $("read").onclick = () => send("readAloud", { text: lastNative, slow: false });
  $("readSlow").onclick = () => send("readAloud", { text: lastNative, slow: true });
  $("input").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); });
  $("mode").onchange = (e) => { state.mode = e.target.value; applyState(); send("setState", { key: "mode", value: state.mode }); };
  $("tone").onchange = (e) => { state.tone = e.target.value; send("setState", { key: "tone", value: state.tone }); };
  $("provider").onchange = (e) => { state.providerId = e.target.value; send("setState", { key: "providerId", value: state.providerId }); };
  $("targetLanguage").onchange = (e) => { state.targetLanguage = e.target.value; send("setState", { key: "targetLanguage", value: state.targetLanguage }); };
  $("watchEnabled").onchange = (e) => { state.watchEnabled = e.target.checked; send("toggleWatch", { enabled: state.watchEnabled }); };
  $("watchMode").onchange = (e) => { state.watchMode = e.target.value; send("setState", { key: "watchMode", value: state.watchMode }); };
  send("ready", {});
});
```

- [ ] **Step 3: Write `src/vscode/sidebar/provider.ts`**

```ts
import * as vscode from "vscode";
import { LANGUAGE_CHOICES, resolveTargetLanguage, getLanguageTitle } from "../../core/languages";
import { translateWithProvider, MissingAPIKeyError } from "../../core/providers";
import { runRewrite } from "../../core/rewrite";
import { normalizeInputText } from "../../core/text";
import { ProviderId, RewriteTone, TranslationRequest } from "../../core/types";
import {
  PROVIDER_TITLES,
  getMaxOutputTokens,
  getOrderedProviderIds,
  getProviderConfig,
  getTTSConfig,
  getTimeoutMs,
} from "../config";
import { readAloud } from "../audio";
import { loadUiState, saveUiState } from "../settings-store";

const TONE_OPTIONS: RewriteTone[] = ["natural", "casual", "formal", "concise"];

export class CoachViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "englishCoach.sidebar";
  private view?: vscode.WebviewView;
  public onWatchToggle?: (enabled: boolean) => void;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.postInit();
    });
  }

  public get webviewView(): vscode.WebviewView | undefined {
    return this.view;
  }

  public reveal(): void {
    this.view?.show?.(true);
  }

  public post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private postInit(): void {
    const state = loadUiState(this.context);
    const providers = getOrderedProviderIds().map((id) => ({ id, title: PROVIDER_TITLES[id] }));
    if (!state.providerId && providers[0]) state.providerId = providers[0].id;
    this.post({ type: "init", state, providers });
  }

  private async onMessage(msg: any): Promise<void> {
    switch (msg.type) {
      case "ready":
        this.postInit();
        return;
      case "setState":
        await saveUiState(this.context, { [msg.key]: msg.value } as any);
        return;
      case "toggleWatch":
        await saveUiState(this.context, { watchEnabled: Boolean(msg.enabled) });
        this.onWatchToggle?.(Boolean(msg.enabled));
        return;
      case "setApiKey":
        await vscode.commands.executeCommand("englishCoach.setApiKey");
        return;
      case "fromClipboard": {
        const text = normalizeInputText(await vscode.env.clipboard.readText());
        this.post({ type: "setText", text });
        return;
      }
      case "copy":
        if (msg.text) {
          await vscode.env.clipboard.writeText(msg.text);
          void vscode.window.showInformationMessage("Copied the native version.");
        }
        return;
      case "readAloud":
        await this.handleReadAloud(msg.text, Boolean(msg.slow));
        return;
      case "coach":
        await this.handleCoach(msg.text, msg.tone, msg.providerId);
        return;
      case "translate":
        await this.handleTranslate(msg.text, msg.targetLang, msg.providerId);
        return;
    }
  }

  /** Used by clipboard-watch to push staged or auto-coached text. */
  public stageText(text: string): void {
    this.post({ type: "stage", text });
  }

  public async coachText(text: string): Promise<void> {
    const state = loadUiState(this.context);
    const providerId = (state.providerId || getOrderedProviderIds()[0]) as ProviderId;
    await this.handleCoach(text, state.tone, providerId);
  }

  private resolveProvider(providerId: string): ProviderId {
    return getOrderedProviderIds().includes(providerId as ProviderId)
      ? (providerId as ProviderId)
      : getOrderedProviderIds()[0];
  }

  private async handleCoach(text: string, tone: RewriteTone, providerId: string): Promise<void> {
    const clean = normalizeInputText(text);
    if (!clean) return;
    this.post({ type: "loading" });
    const id = this.resolveProvider(providerId);
    try {
      const config = await getProviderConfig(this.context, id);
      const result = await runRewrite(config, clean, tone, getTimeoutMs(), getMaxOutputTokens());
      this.post({ type: "result", mode: "coach", rewritten: result.rewritten, why: result.why });
    } catch (e) {
      this.postError(e, id);
    }
  }

  private async handleTranslate(text: string, targetLang: string, providerId: string): Promise<void> {
    const clean = normalizeInputText(text);
    if (!clean) return;
    this.post({ type: "loading" });
    const id = this.resolveProvider(providerId);
    try {
      const config = await getProviderConfig(this.context, id);
      const resolved = resolveTargetLanguage(targetLang, clean);
      const request: TranslationRequest = {
        text: clean,
        targetLanguage: resolved,
        targetLanguageTitle: getLanguageTitle(resolved),
        style: "balanced",
        promptProfile: "general",
        timeoutMs: getTimeoutMs(),
        maxOutputTokens: getMaxOutputTokens(),
      };
      const translation = await translateWithProvider(config, request);
      this.post({ type: "result", mode: "translate", translation });
    } catch (e) {
      this.postError(e, id);
    }
  }

  private async handleReadAloud(text: string, slow: boolean): Promise<void> {
    const clean = normalizeInputText(text);
    if (!clean) return;
    try {
      const ttsConfig = await getTTSConfig(this.context);
      await readAloud(this.context, clean, ttsConfig, { slow });
    } catch (e) {
      void vscode.window.showErrorMessage(`Read-aloud failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private postError(error: unknown, id: ProviderId): void {
    const title = PROVIDER_TITLES[id];
    if (error instanceof MissingAPIKeyError) {
      this.post({ type: "error", message: `Add a ${title} API key.`, action: "setApiKey" });
      return;
    }
    this.post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }

  private html(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "sidebar.css"));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "sidebar.js"));
    const tones = TONE_OPTIONS.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("");
    const langs = LANGUAGE_CHOICES.map((l) => `<option value="${l.value}">${l.title}</option>`).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
<link href="${cssUri}" rel="stylesheet" />
</head>
<body>
  <div class="row">
    <label>Mode</label>
    <select id="mode"><option value="coach">Coach</option><option value="translate">Translate</option></select>
    <label>Provider</label>
    <select id="provider"></select>
  </div>
  <div class="row" id="toneRow"><label>Tone</label><select id="tone">${tones}</select></div>
  <div class="row hidden" id="langRow"><label>Target</label><select id="targetLanguage">${langs}</select></div>
  <textarea id="input" placeholder="Type or paste your English here…"></textarea>
  <div class="actions">
    <button id="coach">Coach (⌘↵)</button>
    <button id="fromClipboard" class="secondary">From clipboard</button>
  </div>
  <div class="watch">
    <input type="checkbox" id="watchEnabled" /><label for="watchEnabled">Watch clipboard</label>
    <select id="watchMode"><option value="stage">Stage</option><option value="auto">Auto</option></select>
  </div>
  <hr />
  <div class="section-title">✨ Native version</div>
  <div id="native" class="native muted">Your idiomatic version will appear here.</div>
  <div class="actions hidden" id="resultActions">
    <button id="copy" class="secondary">Copy</button>
    <button id="read" class="secondary">🔊 Read</button>
    <button id="readSlow" class="secondary">🔊 Slow</button>
  </div>
  <div id="whyWrap"><div class="section-title">💡 为什么更自然</div><div id="why" class="why"></div></div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
```

- [ ] **Step 4: Register the view provider in `src/extension.ts`**

Replace `src/extension.ts` with:

```ts
import * as vscode from "vscode";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CoachViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run compile && npm run check`
Expected: both succeed.

- [ ] **Step 6: Manual smoke test**

F5 to launch the dev host. Set a DeepSeek API key (Set API Key command). Open the English Coach sidebar (activity-bar icon). Type "I has a apple", press ⌘↵. Expect: the native version replaces the placeholder and a Chinese 为什么更自然 bullet list appears. Switch Mode to Translate, type Chinese, confirm a translation appears and the why-section hides. Click Copy and confirm the clipboard holds the native version.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(vscode): coach sidebar webview (coach + translate + read aloud + copy)"
```

---

## Task 15: `vscode/clipboard-watch.ts`

**Files:**
- Create: `src/vscode/clipboard-watch.ts`
- Modify: `src/extension.ts`, `src/vscode/sidebar/provider.ts`

- [ ] **Step 1: Write `src/vscode/clipboard-watch.ts`**

```ts
import * as vscode from "vscode";
import { getClipboardMinLength } from "./config";
import { loadUiState } from "./settings-store";
import { CoachViewProvider } from "./sidebar/provider";

const POLL_MS = 1000;

/** Reject text that looks like code, a path, or a URL — not worth coaching. */
function looksLikeProse(text: string, minLength: number): boolean {
  const t = text.trim();
  if (t.length < minLength) return false;
  if (/^(https?:\/\/|\/|~\/|[A-Za-z]:\\)/.test(t)) return false;
  if (/[{};]|=>|\bfunction\b|\bconst\b|\bimport\b/.test(t)) return false;
  return /\s/.test(t); // at least a couple of words
}

export class ClipboardWatcher {
  private timer?: NodeJS.Timeout;
  private last = "";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly provider: CoachViewProvider,
  ) {}

  /** Start/stop polling based on the saved toggle and whether the view is visible. */
  sync(): void {
    const state = loadUiState(this.context);
    const visible = this.provider.webviewView?.visible ?? false;
    if (state.watchEnabled && visible) this.start();
    else this.stop();
  }

  private start(): void {
    if (this.timer) return;
    void this.captureBaseline();
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async captureBaseline(): Promise<void> {
    this.last = (await vscode.env.clipboard.readText()) ?? "";
  }

  private async tick(): Promise<void> {
    let text = "";
    try {
      text = (await vscode.env.clipboard.readText()) ?? "";
    } catch {
      return;
    }
    if (text === this.last) return;
    this.last = text;
    if (!looksLikeProse(text, getClipboardMinLength())) return;

    const state = loadUiState(this.context);
    if (state.watchMode === "auto") await this.provider.coachText(text);
    else this.provider.stageText(text);
  }

  dispose(): void {
    this.stop();
  }
}
```

- [ ] **Step 2: Wire the watcher into the provider's visibility + toggle**

In `src/vscode/sidebar/provider.ts`, the `onWatchToggle` hook and `onDidChangeVisibility` already exist. Confirm `resolveWebviewView` calls back on visibility by editing the visibility handler to also notify a watcher callback. Add a public hook and call it:

Add a field and call near the top of the class (after `public onWatchToggle?...`):

```ts
  public onVisibilityChange?: () => void;
```

Then in `resolveWebviewView`, change the visibility handler to:

```ts
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.postInit();
      this.onVisibilityChange?.();
    });
```

- [ ] **Step 3: Construct and sync the watcher in `src/extension.ts`**

Replace `src/extension.ts` with:

```ts
import * as vscode from "vscode";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";
import { ClipboardWatcher } from "./vscode/clipboard-watch";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CoachViewProvider(context);
  const watcher = new ClipboardWatcher(context, provider);

  provider.onWatchToggle = () => watcher.sync();
  provider.onVisibilityChange = () => watcher.sync();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    watcher,
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
    vscode.commands.registerCommand("englishCoach.coachClipboard", async () => {
      const text = (await vscode.env.clipboard.readText()) ?? "";
      provider.reveal();
      await provider.coachText(text);
    }),
  );
}

export function deactivate(): void {}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run compile && npm run check`
Expected: both succeed.

- [ ] **Step 5: Manual smoke test**

F5. Open the sidebar, tick "Watch clipboard" (Stage). Copy a sentence elsewhere ("I wanna ask you something"). Confirm it appears in the input box. Switch watch mode to Auto, copy another sentence, confirm it auto-coaches. Hide the sidebar (switch activity-bar view) and confirm polling stops (no surprise coaching); re-show and confirm it resumes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(vscode): visibility-gated clipboard watch (stage/auto)"
```

---

## Task 16: Final typecheck, README, packaging check

**Files:**
- Create: `README.md` (overwrite the Raycast one)
- Verify: full build + package

- [ ] **Step 1: Overwrite `README.md`**

```markdown
# English Coach (VS Code)

Rewrite your English (or Chinese) into idiomatic, native-sounding English while you code,
with a Simplified-Chinese explanation of *why* the new version is more natural.

## Features
- **Coach mode** — paste/type English → idiomatic rewrite + 中文讲解 (word choice, collocations, idioms, register).
- **Translate mode** — Chinese (or any source) → target language, no coaching.
- **Bring your own keys** — DeepSeek, Xiaomi MiMo, Gemini, Kimi, OpenAI. One provider at a time, switchable.
- **Clipboard watch** — stage or auto-coach whatever you copy (off by default).
- **Read aloud** — hear the native version (macOS).

## Setup
1. Run **English Coach: Set API Key** and add at least one provider key.
2. Enable providers and tune models/base URLs in Settings (`englishCoach.*`).
3. Open the **English Coach** sidebar from the activity bar.

API keys are stored in VS Code SecretStorage (OS keychain), never in settings.json.

## Develop
- `npm install`
- `npm run watch` then press F5 to launch the Extension Development Host
- `npm test` runs the core unit tests
```

- [ ] **Step 2: Full typecheck and tests**

Run: `npm run check && npm test`
Expected: typecheck clean; all core tests pass.

- [ ] **Step 3: Production build + package dry run**

Run: `npm run compile -- --production && npx @vscode/vsce package --no-dependencies`
Expected: produces `vscode-english-coach-0.1.0.vsix` with no fatal errors. (If `vsce` complains about a missing `repository` field, add `"repository": { "type": "git", "url": "" }` to `package.json` or pass `--allow-missing-repository`.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: VS Code README; chore: verify production build + package"
```

---

## Self-Review

**1. Spec coverage:**
- Sidebar webview → Task 14. ✓
- Coach mode (English→idiomatic + 中文 why; Chinese→native English folded in via the coach prompt) → Tasks 8, 14. ✓
- Translate toggle → Task 14 (`translateWithProvider`). ✓ (Note: the spec's `core/translate.ts` is intentionally collapsed into reusing `providers.translateWithProvider`; documented in Task 14.)
- 5-provider BYOK, one-at-a-time switchable → Tasks 7, 11, 14. ✓
- Manual input + From clipboard → Task 14. ✓
- Clipboard watch (stage/auto, off by default, visibility-gated) → Task 15. ✓
- Read aloud (Qwen/Gemini via afplay, macOS) → Tasks 9, 13, 14. ✓
- Keys in SecretStorage, non-secret in configuration → Tasks 10, 11. ✓
- Webview never holds secrets (all calls in host) → Task 14 (host-side handlers). ✓
- Cleanup of Raycast/OCR/Swift → Task 1. ✓
- `@coach` participant + history → deferred to Phase 2 (out of scope, stated up front). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The one `as any` casts in the provider message handler are deliberate (untyped webview messages) and bounded. Error handling is concrete (`MissingAPIKeyError` → set-key action; try/catch posts error). ✓

**3. Type consistency:** `getProviderConfig(context, id, tier?)` signature matches its callers in Task 14. `synthesize(text, TTSConfig, opts) -> Buffer[]` (Task 9) matches `readAloud` consumer (Task 13). `TTSConfig` fields produced by `getTTSConfig` (Task 11) match the interface (Task 9). `loadUiState/saveUiState` shape (Task 12) matches webview `init`/`setState` usage (Task 14). `CoachViewProvider` public methods (`coachText`, `stageText`, `reveal`, `webviewView`, `onWatchToggle`, `onVisibilityChange`) match `ClipboardWatcher` + `extension.ts` usage (Tasks 15). ✓

**4. Resolved spec open items:** test runner = vitest; `engines.vscode` = `^1.90.0`; extension id = `vscode-english-coach`, display "English Coach". Read-aloud non-macOS fallback remains deferred (warns and returns).

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Note: each task commits locally (no push), per the commit policy in the header.
