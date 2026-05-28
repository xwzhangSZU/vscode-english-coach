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
  public onVisibilityChange?: () => void;

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
      this.onVisibilityChange?.();
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
