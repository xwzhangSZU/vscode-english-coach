import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { splitSentences } from "../../core/segment";
import { analyzeProsody } from "../../core/prosody";
import { toStave } from "../../core/stave";
import { synthesize, synthesizeOpenAISpeech } from "../../core/tts";
import { getAnalysisConfig, getTtsTarget, getTTSConfig } from "../config";
import { cacheAudio, audioCacheKey } from "../audio-cache";

export class SayItRightPanel {
  public static current?: SayItRightPanel;
  private readonly panel: vscode.WebviewPanel;
  private sentences: string[] = [];
  private index = 0;
  private lastAudioFile?: vscode.Uri;

  static show(context: vscode.ExtensionContext, text: string): void {
    if (SayItRightPanel.current) {
      SayItRightPanel.current.panel.reveal();
      SayItRightPanel.current.load(text);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "sayItRight.player",
      "Say It Right",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "src", "vscode", "player", "media"),
          vscode.Uri.joinPath(context.globalStorageUri, "audio-cache"),
        ],
      },
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
    this.panel.onDidDispose(() => {
      SayItRightPanel.current = undefined;
    });
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
      const isWord = /\b\w+\b/.test(sentence) && sentence.trim().split(/\s+/).length === 1;
      const analysis = await analyzeProsody(sentence, cfg, 45000, 2048, isWord);
      this.post({
        type: "analysis",
        rows: toStave(analysis),
        ipa: analysis.ipa,
        notes: analysis.notes,
        sentence: analysis.text,
        index: this.index,
        total: this.sentences.length,
      });
    } catch (e) {
      this.post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async onMessage(m: { type: string; teacher?: boolean }): Promise<void> {
    switch (m.type) {
      case "ready": {
        const c = vscode.workspace.getConfiguration("sayItRight");
        this.post({ type: "config", loopCount: c.get<number>("loopCount", 3), loopGap: c.get<number>("loopGapSeconds", 1) });
        return this.analyzeCurrent();
      }
      case "next":
        this.index = Math.min(this.index + 1, this.sentences.length - 1);
        return this.analyzeCurrent();
      case "prev":
        this.index = Math.max(this.index - 1, 0);
        return this.analyzeCurrent();
      case "synthesize":
        return this.handleSynthesize(Boolean(m.teacher));
      case "export":
        return this.handleExport();
    }
  }

  private async handleSynthesize(teacher: boolean): Promise<void> {
    const sentence = this.sentences[this.index];
    if (!sentence) return;
    try {
      const target = await getTtsTarget(this.context);
      const instructions = teacher ? target.teacherInstructions : "";
      const format = target.provider === "openai" ? "mp3" : "wav";
      const key = audioCacheKey({
        text: sentence,
        provider: target.provider,
        voice: target.voice,
        instructions,
        format,
      });
      let bytes: Buffer;
      if (target.provider === "openai") {
        bytes = await synthesizeOpenAISpeech(sentence, {
          apiKey: target.apiKey,
          baseURL: target.baseURL,
          model: target.ttsModel,
          voice: target.voice,
          instructions: instructions || undefined,
          speed: teacher ? 0.9 : 1.0,
          format: "mp3",
        });
      } else {
        const ttsConfig = await getTTSConfig(this.context);
        const buffers = await synthesize(
          sentence,
          {
            ...ttsConfig,
            qwenModel: teacher ? target.ttsInstructModel : target.ttsModel,
            qwenVoice: target.voice,
            qwenInstructions: instructions,
          },
          {},
        );
        bytes = buffers[0];
      }
      const file = await cacheAudio(this.context, key, format, bytes);
      this.lastAudioFile = file;
      this.post({ type: "audio", src: this.panel.webview.asWebviewUri(file).toString(), teacher });
    } catch (e) {
      this.post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async handleExport(): Promise<void> {
    if (!this.lastAudioFile) {
      void vscode.window.showWarningMessage("Play a sentence first, then export.");
      return;
    }
    const target = await vscode.window.showSaveDialog({
      saveLabel: "Export audio",
      defaultUri: vscode.Uri.file("say-it-right" + (this.lastAudioFile.fsPath.endsWith(".mp3") ? ".mp3" : ".wav")),
      filters: { Audio: ["mp3", "wav"] },
    });
    if (!target) return;
    await vscode.workspace.fs.copy(this.lastAudioFile, target, { overwrite: true });
    void vscode.window.showInformationMessage(`Saved ${target.fsPath}`);
  }

  private post(msg: unknown): void {
    void this.panel.webview.postMessage(msg);
  }

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
    <label>Speed <input id="speed" type="range" min="0.25" max="4" step="0.05" value="1" /></label><span id="speedVal">1.00×</span>
    <button id="teacher">Teacher slow</button><button id="abrepeat">AB-repeat</button><button id="shadow">Shadow ×3</button><button id="repeat">↻</button><button id="export">⤓ Export</button>
  </div>
  <div id="notes" class="notes"></div>
  <audio id="audio" preload="auto"></audio>
  <script nonce="${nonce}" src="${js}"></script>
</body></html>`;
  }
}
