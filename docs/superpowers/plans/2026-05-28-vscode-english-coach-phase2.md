# VS Code English Coach (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recent-history TreeView in the English Coach sidebar (auto-recorded) and a `@coach` chat participant (with `/translate`) in Copilot Chat, both reusing the Phase 1 core.

**Architecture:** Keep the Phase 1 `core/` (platform-agnostic) vs `vscode/` (platform) split. History gets a pure `core/history.ts` (dedup/cap logic, unit-tested) wrapped by a `vscode/history.ts` `HistoryStore` over `context.globalState`, surfaced by a `vscode/history-view.ts` `TreeDataProvider`. The sidebar provider and the chat participant both record successful results into the store. The chat participant streams the rewrite (or translation) using our BYOK providers — it does NOT use `vscode.lm`.

**Tech Stack:** TypeScript, esbuild, vitest. VS Code Chat Participant API (`vscode.chat.createChatParticipant` + `contributes.chatParticipants`), finalized at engine `^1.90.0`. TreeView API (`window.registerTreeDataProvider`).

**Reference:** `docs/superpowers/specs/2026-05-28-vscode-english-coach-design.md` (§5, §11 cover Phase 2 at a stub level; this plan is the detailed design and supersedes that stub).

**Prerequisite:** Phase 1 is complete and committed on `main` (sidebar webview, core layer, provider/config/secrets/audio/clipboard-watch).

**Commit policy:** Each task commits locally (no push). Executing this plan authorizes its local commits.

**Verified API facts (from official docs, 2026-05-28):**
- `vscode.chat.createChatParticipant(id, handler)`; `handler: (request, context, stream, token) => ProviderResult<ChatResult>`.
- `request.prompt` is the user's text; `request.command` is the slash-command name (e.g. `translate`).
- `stream.markdown(text)`, `stream.progress(msg)` for output.
- Manifest `contributes.chatParticipants[]`: `id`, `name` (the `@name` handle), `fullName`, `description`, `isSticky`, `commands: [{name, description}]`.
- `participant.iconPath = Uri`.
- The chat *panel* is provided by Copilot Chat (the user has it); we do NOT declare a Copilot dependency, so the sidebar keeps working without it.

---

## File Structure (Phase 2 additions)

```
src/
  core/
    history.ts            NEW — pure: HistoryEntry type, mergeHistory(), isHistoryEntry()
  vscode/
    history.ts            NEW — HistoryStore over globalState (+ onDidChange)
    history-view.ts       NEW — HistoryTreeProvider (TreeDataProvider<HistoryEntry>)
    chat-participant.ts   NEW — registerCoachParticipant()
    sidebar/provider.ts   MODIFY — inject HistoryStore, record on success, restoreEntry()
  extension.ts            MODIFY — construct store, register tree + history commands + participant
media/
  sidebar.js              MODIFY — handle "restore" message
package.json              MODIFY — second view, history commands, menus, chatParticipants
test/
  core/
    history.test.ts       NEW — mergeHistory / isHistoryEntry
```

---

## Task 1: History core (pure) + HistoryStore

**Files:**
- Create: `src/core/history.ts`
- Create: `src/vscode/history.ts`
- Test: `test/core/history.test.ts`

- [ ] **Step 1: Write the failing test `test/core/history.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mergeHistory, isHistoryEntry, HistoryEntry } from "../../src/core/history";

function entry(p: Partial<HistoryEntry>): HistoryEntry {
  return { id: "x", kind: "coach", source: "s", output: "o", provider: "DeepSeek", model: "m", createdAt: 1, ...p };
}

describe("mergeHistory", () => {
  it("prepends the new entry", () => {
    const out = mergeHistory([entry({ id: "a" })], entry({ id: "b", source: "s2" }));
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("drops an exact duplicate (same kind+source+output)", () => {
    const out = mergeHistory([entry({ id: "a", source: "hi", output: "Hi." })], entry({ id: "b", source: "hi", output: "Hi." }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });
  it("keeps entries that differ in kind", () => {
    const out = mergeHistory([entry({ id: "a", kind: "coach" })], entry({ id: "b", kind: "translate" }));
    expect(out).toHaveLength(2);
  });
  it("caps the list at max", () => {
    const existing = Array.from({ length: 3 }, (_, i) => entry({ id: `e${i}`, source: `s${i}` }));
    const out = mergeHistory(existing, entry({ id: "new", source: "new" }), 3);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("new");
    expect(out.map((e) => e.id)).not.toContain("e2");
  });
});

describe("isHistoryEntry", () => {
  it("accepts a valid entry and rejects junk", () => {
    expect(isHistoryEntry(entry({}))).toBe(true);
    expect(isHistoryEntry({ id: "x" })).toBe(false);
    expect(isHistoryEntry(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx vitest run test/core/history.test.ts`
Expected: FAIL — cannot resolve `../../src/core/history`.

- [ ] **Step 3: Write `src/core/history.ts`**

```ts
export type HistoryKind = "coach" | "translate";

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  source: string;
  output: string;
  why?: string;
  provider: string;
  model: string;
  createdAt: number;
}

export const MAX_HISTORY_ENTRIES = 50;

/** Prepend the new entry, drop any exact duplicate (same kind+source+output), cap the list. */
export function mergeHistory(
  existing: HistoryEntry[],
  entry: HistoryEntry,
  max: number = MAX_HISTORY_ENTRIES,
): HistoryEntry[] {
  const deduped = existing.filter(
    (e) => !(e.kind === entry.kind && e.source === entry.source && e.output === entry.output),
  );
  return [entry, ...deduped].slice(0, max);
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    (e.kind === "coach" || e.kind === "translate") &&
    typeof e.source === "string" &&
    typeof e.output === "string" &&
    typeof e.provider === "string" &&
    typeof e.model === "string" &&
    typeof e.createdAt === "number"
  );
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `npx vitest run test/core/history.test.ts`
Expected: PASS (6 assertions across 5 tests).

- [ ] **Step 5: Write `src/vscode/history.ts`**

```ts
import * as vscode from "vscode";
import { HistoryEntry, isHistoryEntry, mergeHistory } from "../core/history";

const KEY = "englishCoach.history.v1";

export type NewHistoryEntry = Omit<HistoryEntry, "id" | "createdAt">;

export class HistoryStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  load(): HistoryEntry[] {
    const raw = this.context.globalState.get<unknown[]>(KEY) ?? [];
    return Array.isArray(raw) ? raw.filter(isHistoryEntry) : [];
  }

  async add(entry: NewHistoryEntry): Promise<void> {
    const source = entry.source.trim();
    const output = entry.output.trim();
    if (!source || !output) return;
    const full: HistoryEntry = {
      ...entry,
      source,
      output,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now(),
    };
    await this.context.globalState.update(KEY, mergeHistory(this.load(), full));
    this._onDidChange.fire();
  }

  async remove(id: string): Promise<void> {
    await this.context.globalState.update(
      KEY,
      this.load().filter((e) => e.id !== id),
    );
    this._onDidChange.fire();
  }

  async clear(): Promise<void> {
    await this.context.globalState.update(KEY, []);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/history.ts src/vscode/history.ts test/core/history.test.ts
git commit -m "feat(history): pure merge/dedup core + globalState-backed HistoryStore"
```

---

## Task 2: History TreeView provider

**Files:**
- Create: `src/vscode/history-view.ts`

- [ ] **Step 1: Write `src/vscode/history-view.ts`**

```ts
import * as vscode from "vscode";
import { HistoryEntry } from "../core/history";
import { HistoryStore } from "./history";

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryEntry> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: HistoryStore) {
    store.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(entry: HistoryEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(oneLine(entry.source), vscode.TreeItemCollapsibleState.None);
    item.description = `${entry.kind === "coach" ? "Coach" : "Translate"} · ${entry.provider}`;
    item.tooltip = new vscode.MarkdownString(
      `**You:** ${entry.source}\n\n**Native:** ${entry.output}${entry.why ? `\n\n${entry.why}` : ""}`,
    );
    item.contextValue = "historyEntry";
    item.iconPath = new vscode.ThemeIcon(entry.kind === "coach" ? "sparkle" : "globe");
    item.command = { command: "englishCoach.history.reload", title: "Reload in Coach", arguments: [entry] };
    return item;
  }

  getChildren(element?: HistoryEntry): HistoryEntry[] {
    return element ? [] : this.store.load();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

function oneLine(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: clean. (The provider is not wired into `extension.ts` yet — that happens in Task 4 — but `tsc` validates it because it is under `src/`.)

- [ ] **Step 3: Commit**

```bash
git add src/vscode/history-view.ts
git commit -m "feat(history): TreeDataProvider for the Recent view"
```

---

## Task 3: @coach chat participant

**Files:**
- Create: `src/vscode/chat-participant.ts`

- [ ] **Step 1: Write `src/vscode/chat-participant.ts`**

```ts
import * as vscode from "vscode";
import { getLanguageTitle, resolveTargetLanguage } from "../core/languages";
import { MissingAPIKeyError, translateWithProvider } from "../core/providers";
import { runRewrite } from "../core/rewrite";
import { TranslationRequest } from "../core/types";
import { PROVIDER_TITLES, defaultProviderId, getMaxOutputTokens, getProviderConfig, getTimeoutMs } from "./config";
import { HistoryStore } from "./history";

export function registerCoachParticipant(
  context: vscode.ExtensionContext,
  history: HistoryStore,
): vscode.ChatParticipant {
  const handler: vscode.ChatRequestHandler = async (request, _ctx, stream) => {
    const text = request.prompt.trim();
    if (!text) {
      stream.markdown("Type some English after `@coach`, or use `/translate` to translate.");
      return {};
    }
    const id = defaultProviderId();
    const title = PROVIDER_TITLES[id];
    try {
      const config = await getProviderConfig(context, id);
      if (request.command === "translate") {
        stream.progress("Translating…");
        const target = resolveTargetLanguage("auto", text);
        const req: TranslationRequest = {
          text,
          targetLanguage: target,
          targetLanguageTitle: getLanguageTitle(target),
          style: "balanced",
          promptProfile: "general",
          timeoutMs: getTimeoutMs(),
          maxOutputTokens: getMaxOutputTokens(),
        };
        const translation = await translateWithProvider(config, req);
        stream.markdown(translation);
        await history.add({ kind: "translate", source: text, output: translation, provider: title, model: config.model });
      } else {
        stream.progress("Coaching…");
        const result = await runRewrite(config, text, "natural", getTimeoutMs(), getMaxOutputTokens());
        stream.markdown(`**✨ Native version**\n\n${result.rewritten}\n\n**💡 为什么更自然**\n\n${result.why}`);
        await history.add({
          kind: "coach",
          source: text,
          output: result.rewritten,
          why: result.why,
          provider: title,
          model: config.model,
        });
      }
    } catch (e) {
      if (e instanceof MissingAPIKeyError) {
        stream.markdown(`Add a **${title}** API key via the **English Coach: Set API Key** command.`);
      } else {
        stream.markdown(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return {};
  };

  const participant = vscode.chat.createChatParticipant("englishCoach.coach", handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.svg");
  return participant;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: clean.

**Contingency:** If `tsc` reports that `vscode.chat`, `ChatRequestHandler`, or `ChatParticipant` do not exist, the chat API needs a newer engine/types floor. Fix by bumping both in `package.json`:
```json
"engines": { "vscode": "^1.92.0" },
"devDependencies": { "@types/vscode": "^1.92.0", ... }
```
then `npm install` and re-run `npm run check`. (Per the verified docs the API is available at 1.90; this is only a fallback.)

- [ ] **Step 3: Commit**

```bash
git add src/vscode/chat-participant.ts
git commit -m "feat(chat): @coach participant (coaching + /translate) over BYOK providers"
```

---

## Task 4: Wire everything — recording, restore, manifest, registration

**Files:**
- Modify: `src/vscode/sidebar/provider.ts`
- Modify: `media/sidebar.js`
- Modify: `package.json`
- Modify: `src/extension.ts`

- [ ] **Step 1: Inject `HistoryStore` into the sidebar provider**

In `src/vscode/sidebar/provider.ts`, add these imports near the other local imports:
```ts
import { HistoryEntry } from "../../core/history";
import { HistoryStore } from "../history";
```

Change the constructor from:
```ts
  constructor(private readonly context: vscode.ExtensionContext) {}
```
to:
```ts
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly history: HistoryStore,
  ) {}
```

- [ ] **Step 2: Record successful results + add `restoreEntry`**

In `handleCoach`, replace the success line:
```ts
      const result = await runRewrite(config, clean, tone, getTimeoutMs(), getMaxOutputTokens());
      this.post({ type: "result", mode: "coach", rewritten: result.rewritten, why: result.why });
```
with:
```ts
      const result = await runRewrite(config, clean, tone, getTimeoutMs(), getMaxOutputTokens());
      this.post({ type: "result", mode: "coach", rewritten: result.rewritten, why: result.why });
      await this.history.add({
        kind: "coach",
        source: clean,
        output: result.rewritten,
        why: result.why,
        provider: PROVIDER_TITLES[id],
        model: config.model,
      });
```

In `handleTranslate`, replace:
```ts
      const translation = await translateWithProvider(config, request);
      this.post({ type: "result", mode: "translate", translation });
```
with:
```ts
      const translation = await translateWithProvider(config, request);
      this.post({ type: "result", mode: "translate", translation });
      await this.history.add({
        kind: "translate",
        source: clean,
        output: translation,
        provider: PROVIDER_TITLES[id],
        model: config.model,
      });
```

Add this public method (next to `coachText`):
```ts
  public restoreEntry(entry: HistoryEntry): void {
    this.reveal();
    this.post({ type: "restore", entry });
  }
```

- [ ] **Step 3: Handle the `restore` message in `media/sidebar.js`**

In the `window.addEventListener("message", ...)` handler, add a branch before the final `setText`/`stage` branch:
```js
  else if (msg.type === "restore") {
    const e = msg.entry;
    state.mode = e.kind === "translate" ? "translate" : "coach";
    applyState();
    send("setState", { key: "mode", value: state.mode });
    $("input").value = e.source;
    if (state.mode === "translate") showResult({ mode: "translate", translation: e.output });
    else showResult({ mode: "coach", rewritten: e.output, why: e.why });
  }
```

- [ ] **Step 4: Update `package.json` contributions**

(a) In `contributes.views.englishCoach`, add a second view AFTER the existing sidebar view so the array reads:
```json
"englishCoach": [
  { "id": "englishCoach.sidebar", "name": "Coach", "type": "webview" },
  { "id": "englishCoach.history", "name": "Recent", "type": "tree" }
]
```

(b) In `contributes.commands`, add these four:
```json
{ "command": "englishCoach.history.reload", "title": "English Coach: Reload History Entry" },
{ "command": "englishCoach.history.copyOutput", "title": "Copy Native Version", "icon": "$(copy)" },
{ "command": "englishCoach.history.delete", "title": "Delete", "icon": "$(trash)" },
{ "command": "englishCoach.history.clear", "title": "English Coach: Clear History", "icon": "$(clear-all)" }
```

(c) Add a `contributes.menus` block (sibling to `views`/`commands`/`configuration`):
```json
"menus": {
  "commandPalette": [
    { "command": "englishCoach.history.reload", "when": "false" },
    { "command": "englishCoach.history.copyOutput", "when": "false" },
    { "command": "englishCoach.history.delete", "when": "false" }
  ],
  "view/title": [
    { "command": "englishCoach.history.clear", "when": "view == englishCoach.history", "group": "navigation" }
  ],
  "view/item/context": [
    { "command": "englishCoach.history.copyOutput", "when": "view == englishCoach.history && viewItem == historyEntry", "group": "inline" },
    { "command": "englishCoach.history.delete", "when": "view == englishCoach.history && viewItem == historyEntry", "group": "inline" }
  ]
}
```

(d) Add a `contributes.chatParticipants` block (sibling to the above):
```json
"chatParticipants": [
  {
    "id": "englishCoach.coach",
    "name": "coach",
    "fullName": "English Coach",
    "description": "Rewrite into idiomatic English — or use /translate",
    "isSticky": true,
    "commands": [
      { "name": "translate", "description": "Translate to idiomatic English (or another language)" }
    ]
  }
]
```

- [ ] **Step 5: Replace `src/extension.ts` ENTIRELY**

```ts
import * as vscode from "vscode";
import { HistoryEntry } from "./core/history";
import { stopSpeaking } from "./vscode/audio";
import { registerCoachParticipant } from "./vscode/chat-participant";
import { ClipboardWatcher } from "./vscode/clipboard-watch";
import { HistoryStore } from "./vscode/history";
import { HistoryTreeProvider } from "./vscode/history-view";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";

export function activate(context: vscode.ExtensionContext): void {
  const history = new HistoryStore(context);
  const provider = new CoachViewProvider(context, history);
  const watcher = new ClipboardWatcher(context, provider);
  const historyTree = new HistoryTreeProvider(history);

  provider.onWatchToggle = () => watcher.sync();
  provider.onVisibilityChange = () => watcher.sync();

  context.subscriptions.push(
    history,
    historyTree,
    watcher,
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    vscode.window.registerTreeDataProvider("englishCoach.history", historyTree),
    registerCoachParticipant(context, history),
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
    vscode.commands.registerCommand("englishCoach.coachClipboard", async () => {
      const text = (await vscode.env.clipboard.readText()) ?? "";
      provider.reveal();
      await provider.coachText(text);
    }),
    vscode.commands.registerCommand("englishCoach.history.reload", (entry: HistoryEntry) => provider.restoreEntry(entry)),
    vscode.commands.registerCommand("englishCoach.history.copyOutput", async (entry: HistoryEntry) => {
      await vscode.env.clipboard.writeText(entry.output);
      void vscode.window.showInformationMessage("Copied the native version.");
    }),
    vscode.commands.registerCommand("englishCoach.history.delete", (entry: HistoryEntry) => history.remove(entry.id)),
    vscode.commands.registerCommand("englishCoach.history.clear", async () => {
      const ok = await vscode.window.showWarningMessage("Clear all English Coach history?", { modal: true }, "Clear");
      if (ok === "Clear") await history.clear();
    }),
  );
}

export function deactivate(): void {
  stopSpeaking();
}
```

- [ ] **Step 6: Verify**

Run: `npm run check && npm run compile`
Expected: both clean. (`compile` now bundles history-view, chat-participant, and history into `out/extension.js` because `extension.ts` imports them.)

Also confirm the manifest is valid JSON:
Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add src/vscode/sidebar/provider.ts media/sidebar.js package.json src/extension.ts
git commit -m "feat(history,chat): record results, Recent view + restore, register @coach"
```

---

## Task 5: README + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Features and (optionally) usage in `README.md`**

Replace the `## Features` section with:
```markdown
## Features
- **Coach mode** — paste/type English → idiomatic rewrite + 中文讲解 (word choice, collocations, idioms, register).
- **Translate mode** — Chinese (or any source) → target language, no coaching.
- **Bring your own keys** — DeepSeek, Xiaomi MiMo, Gemini, Kimi, OpenAI. One provider at a time, switchable.
- **Clipboard watch** — stage or auto-coach whatever you copy (off by default).
- **Read aloud** — hear the native version (macOS).
- **Recent history** — every coach/translate is saved to the "Recent" view in the sidebar; click to restore, or copy/delete inline.
- **@coach in Copilot Chat** — type `@coach <your English>` for a rewrite + explanation inline, or `@coach /translate <text>`.
```

- [ ] **Step 2: Full verification**

Run: `npm run check && npm test`
Expected: tsc clean; all tests pass (Phase 1's 23 + Phase 2's new history tests).

Run: `npm run compile -- --production`
Expected: succeeds; `out/extension.js` exists.

Run: `npx @vscode/vsce package --no-dependencies`
Expected: produces `vscode-english-coach-0.1.0.vsix` (the `repository`/LICENSE warnings remain non-fatal).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Recent history and @coach chat participant"
```

---

## Self-Review

**1. Spec/decision coverage:**
- History UI = sidebar TreeView → Task 2 (`HistoryTreeProvider`) + Task 4 (manifest `englishCoach.history` view, registration). ✓
- Auto-record every successful result → Task 4 (`history.add` in both `handleCoach`/`handleTranslate`) + chat participant (Task 3). ✓
- `@coach` + `/translate` → Task 3 (handler branches on `request.command === "translate"`) + Task 4 (manifest `chatParticipants` with the `translate` command). ✓
- Reuses BYOK providers, not `vscode.lm` → Task 3 (`getProviderConfig` + `runRewrite`/`translateWithProvider`). ✓
- Restore an entry into the coach (incl. the why) → Task 1 (store `why`), Task 4 (`restoreEntry` + `restore` webview message). ✓
- Dedup + cap 50 → Task 1 (`mergeHistory`, unit-tested). ✓
- Inline copy/delete + clear-all (with confirm) → Task 4 (menus + commands). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to". The chat handler has concrete error handling (MissingAPIKeyError → set-key hint; else error text). The engine-version contingency in Task 3 is a concrete fallback with exact edits, not a placeholder. ✓

**3. Type consistency:**
- `HistoryEntry` (Task 1) is the single shape used by `HistoryStore` (Task 1), `HistoryTreeProvider` (Task 2), the chat participant (Task 3), `restoreEntry`/recording (Task 4), and the `englishCoach.history.*` command args (Task 4). ✓
- `HistoryStore` public surface (`load`, `add(NewHistoryEntry)`, `remove(id)`, `clear`, `onDidChange`, `dispose`) matches all callers. ✓
- `CoachViewProvider` constructor changes to `(context, history)` in Task 4 and `extension.ts` (Task 4) constructs it that way — consistent. ✓
- `restore` message produced by `restoreEntry` (Task 4) is consumed by the `sidebar.js` handler added in the same task. ✓

**4. Ordering safety:** Tasks 2 and 3 add standalone files that `tsc` validates but `extension.ts` does not import yet (so they're inert until Task 4 wires them). The provider constructor change and all registrations land together in Task 4, so there is no broken intermediate `extension.ts`. ✓

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here with checkpoints.

After implementation, the un-CLI-testable surfaces (TreeView interactions, `@coach` in Copilot Chat, the restore round-trip) need a manual F5 smoke test, same as Phase 1. Each task commits locally (no push).
