import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { splitSentences } from "../../core/segment";
import { analyzeProsody } from "../../core/prosody";
import { toStave, StaveRow } from "../../core/stave";
import { synthesize, synthesizeOpenAISpeech, TTSConfig } from "../../core/tts";
import { alignTimings, flattenStaveTokenTexts } from "../../core/align";
import { transcribeOpenAI } from "../../core/transcribe";
import { buildFeedbackTip, compareWords } from "../../core/feedback";
import { generateWithProvider } from "../../core/providers";
import {
  DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS,
  DEFAULT_SAY_IT_RIGHT_TTS_MODELS,
  DEFAULT_TTS_VOICES,
  SAY_IT_RIGHT_ANALYSIS_MODELS,
  SAY_IT_RIGHT_PROVIDER_IDS,
  SAY_IT_RIGHT_TTS_MODELS,
  TTS_VOICES,
  SayItRightProviderId,
} from "../../core/models";
import { getAnalysisConfig, getProviderConfig, getTtsTarget, getTTSConfig, PROVIDER_TITLES, TtsTarget } from "../config";
import { cacheAudio, audioCacheKey } from "../audio-cache";
import { audioExtension } from "../audio";
import { getCachedTimings, putTimings } from "../asr-cache";
import { Recorder } from "../recorder";
import { ProviderConfig } from "../../core/types";

type ConfigKey = "provider" | "analysisModel" | "ttsModel" | "voice";

interface PlayerMessage {
  type: string;
  teacher?: boolean;
  key?: ConfigKey;
  provider?: string;
  value?: string;
  index?: number;
}

interface FeedbackTipJson {
  tip?: string;
}

interface CachedAnalysis {
  text: string;
  rows: StaveRow[];
  ipa: string;
  notes?: string;
  tokenTexts: string[];
}

export class SayItRightPanel {
  public static current?: SayItRightPanel;
  private readonly panel: vscode.WebviewPanel;
  private sentences: string[] = [];
  private pageStart = 0;
  private activeIndex = 0;
  private lastAudioFile?: vscode.Uri;
  private lastRecordingFile?: vscode.Uri;
  private currentSentence = "";
  private currentTokenTexts: string[] = [];
  private readonly analysisCache = new Map<number, CachedAnalysis>();
  private analysisStamp = "";
  private analyzeGeneration = 0;
  private readonly recorder = new Recorder();

  static show(context: vscode.ExtensionContext, text: string): void {
    if (SayItRightPanel.current) {
      SayItRightPanel.current.panel.reveal();
      SayItRightPanel.current.load(text);
      return;
    }
    const panel = vscode.window.createWebviewPanel("sayItRight.player", "Say It Right", vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
        vscode.Uri.joinPath(context.globalStorageUri, "audio-cache"),
        vscode.Uri.joinPath(context.globalStorageUri, "recordings"),
      ],
    });
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
      this.recorder.dispose();
      SayItRightPanel.current = undefined;
    });
    this.sentences = splitSentences(text);
    this.resetPaging();
  }

  private load(text: string): void {
    this.sentences = splitSentences(text);
    this.resetPaging();
    void this.renderPage();
  }

  private resetPaging(): void {
    this.pageStart = 0;
    this.activeIndex = 0;
    this.analysisCache.clear();
    this.clearAudio();
  }

  private getPageSize(): number {
    const n = vscode.workspace.getConfiguration("sayItRight").get<number>("sentencesPerPage", 5);
    return Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 5, 1), 12);
  }

  /** Stamp that invalidates cached analyses when the analysis provider/model changes. */
  private currentStamp(): string {
    const c = vscode.workspace.getConfiguration("sayItRight");
    const provider = this.readSelectedProvider();
    const model = (c.get<string>(`analysisModel.${provider}`) ?? "").trim() || DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS[provider];
    return `${provider}::${model}`;
  }

  /** Post one page of sentences (placeholders), then stream each sentence's analysis (cached). */
  private async renderPage(): Promise<void> {
    if (this.sentences.length === 0) return;
    const stamp = this.currentStamp();
    if (stamp !== this.analysisStamp) {
      this.analysisCache.clear();
      this.analysisStamp = stamp;
    }
    const size = this.getPageSize();
    if (this.pageStart < 0 || this.pageStart >= this.sentences.length) this.pageStart = 0;
    const end = Math.min(this.pageStart + size, this.sentences.length);
    if (this.activeIndex < this.pageStart || this.activeIndex >= end) this.activeIndex = this.pageStart;

    const pageIndexes: number[] = [];
    for (let i = this.pageStart; i < end; i++) pageIndexes.push(i);

    this.clearAudio();
    this.post({
      type: "page",
      startIndex: this.pageStart,
      total: this.sentences.length,
      pageSize: size,
      activeIndex: this.activeIndex,
      sentences: pageIndexes.map((i) => ({ index: i, text: this.sentences[i] })),
    });
    this.syncActiveFromCache();

    const generation = ++this.analyzeGeneration;
    for (const i of pageIndexes) {
      if (generation !== this.analyzeGeneration) return;
      await this.ensureAnalysis(i, generation);
    }
  }

  /** Analyze one sentence (or return its cached result) and post the stave for it. */
  private async ensureAnalysis(index: number, generation: number): Promise<void> {
    let cached = this.analysisCache.get(index);
    if (!cached) {
      const sentence = this.sentences[index];
      if (!sentence) return;
      try {
        const cfg = await getAnalysisConfig(this.context);
        const isWord = /\b\w+\b/.test(sentence) && sentence.trim().split(/\s+/).length === 1;
        const analysis = await analyzeProsody(sentence, cfg, 45000, 2048, isWord);
        const rows = toStave(analysis);
        cached = {
          text: analysis.text,
          rows,
          ipa: analysis.ipa,
          notes: analysis.notes,
          tokenTexts: flattenStaveTokenTexts(rows),
        };
        this.analysisCache.set(index, cached);
      } catch (e) {
        if (generation === this.analyzeGeneration) {
          this.post({ type: "error", index, message: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
    }
    if (generation !== this.analyzeGeneration) return;
    this.post({ type: "analysis", index, rows: cached.rows, ipa: cached.ipa, notes: cached.notes });
    if (index === this.activeIndex) this.syncActiveFromCache();
  }

  /** Point the audio/recording helpers at whatever the active sentence currently is. */
  private syncActiveFromCache(): void {
    const cached = this.analysisCache.get(this.activeIndex);
    if (cached) {
      this.currentSentence = cached.text;
      this.currentTokenTexts = cached.tokenTexts;
    } else {
      this.currentSentence = this.sentences[this.activeIndex] ?? "";
      this.currentTokenTexts = [];
    }
  }

  /** User clicked a sentence in the current page — make it the active practice target. */
  private handleSelectSentence(index?: number): void {
    if (typeof index !== "number" || index < this.pageStart || index >= this.pageStart + this.getPageSize()) return;
    if (index >= this.sentences.length || index === this.activeIndex) return;
    this.activeIndex = index;
    this.clearAudio();
    this.syncActiveFromCache();
  }

  private async onMessage(m: PlayerMessage): Promise<void> {
    switch (m.type) {
      case "ready": {
        this.postPlayerConfig();
        return this.renderPage();
      }
      case "pageNext": {
        const size = this.getPageSize();
        if (this.pageStart + size < this.sentences.length) this.pageStart += size;
        this.activeIndex = this.pageStart;
        return this.renderPage();
      }
      case "pagePrev": {
        const size = this.getPageSize();
        this.pageStart = Math.max(0, this.pageStart - size);
        this.activeIndex = this.pageStart;
        return this.renderPage();
      }
      case "selectSentence":
        return this.handleSelectSentence(m.index);
      case "synthesize":
        return this.handleSynthesize(Boolean(m.teacher));
      case "export":
        return this.handleExport();
      case "record":
        return this.handleRecord();
      case "stopRecord":
        return this.handleStopRecord();
      case "compare":
        return this.handleCompare();
      case "exportMine":
        return this.handleExportMine();
      case "setConfig":
        return this.handleConfigChange(m);
      case "setApiKey":
        await vscode.commands.executeCommand("englishCoach.setApiKey");
        return;
    }
  }

  private async handleConfigChange(m: PlayerMessage): Promise<void> {
    const key = m.key;
    const value = typeof m.value === "string" ? m.value.trim() : "";
    if (!key || !value) return;
    const c = vscode.workspace.getConfiguration("sayItRight");
    const target = vscode.ConfigurationTarget.Global;
    const provider = this.parseProvider(m.provider) ?? this.readSelectedProvider();

    switch (key) {
      case "provider":
        if (!this.parseProvider(value)) return;
        await c.update("provider", value, target);
        this.clearAudio();
        this.postPlayerConfig();
        return this.renderPage();
      case "analysisModel":
        if (!SAY_IT_RIGHT_ANALYSIS_MODELS[provider].some((model) => model.id === value)) return;
        await c.update(`analysisModel.${provider}`, value, target);
        this.clearAudio();
        this.postPlayerConfig();
        return this.renderPage();
      case "ttsModel":
        if (!SAY_IT_RIGHT_TTS_MODELS[provider].some((model) => model.id === value)) return;
        await c.update(`ttsModel.${provider}`, value, target);
        this.clearAudio();
        this.postPlayerConfig();
        return;
      case "voice":
        if (!TTS_VOICES[provider].includes(value)) return;
        await c.update(`voice.${provider}`, value, target);
        this.clearAudio();
        this.postPlayerConfig();
        return;
    }
  }

  private clearAudio(): void {
    this.lastAudioFile = undefined;
    this.post({ type: "audioCleared" });
  }

  private postPlayerConfig(): void {
    const c = vscode.workspace.getConfiguration("sayItRight");
    const provider = this.readSelectedProvider();
    this.post({
      type: "config",
      loopCount: c.get<number>("loopCount", 3),
      loopGap: c.get<number>("loopGapSeconds", 1),
      providers: SAY_IT_RIGHT_PROVIDER_IDS.map((id) => ({ id, title: PROVIDER_TITLES[id] })),
      analysisModels: Object.fromEntries(
        SAY_IT_RIGHT_PROVIDER_IDS.map((id) => [id, SAY_IT_RIGHT_ANALYSIS_MODELS[id]]),
      ),
      ttsModels: Object.fromEntries(SAY_IT_RIGHT_PROVIDER_IDS.map((id) => [id, SAY_IT_RIGHT_TTS_MODELS[id]])),
      voices: Object.fromEntries(SAY_IT_RIGHT_PROVIDER_IDS.map((id) => [id, TTS_VOICES[id].map((v) => ({ id: v, title: v }))])),
      selection: {
        provider,
        analysisModel:
          (c.get<string>(`analysisModel.${provider}`) ?? "").trim() ||
          DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS[provider],
        ttsModel:
          (c.get<string>(`ttsModel.${provider}`) ?? "").trim() || DEFAULT_SAY_IT_RIGHT_TTS_MODELS[provider],
        voice: (c.get<string>(`voice.${provider}`) ?? "").trim() || DEFAULT_TTS_VOICES[provider],
      },
    });
  }

  private readSelectedProvider(): SayItRightProviderId {
    return this.parseProvider(vscode.workspace.getConfiguration("sayItRight").get<string>("provider")) ?? "qwen";
  }

  private parseProvider(value: unknown): SayItRightProviderId | undefined {
    return typeof value === "string" && (SAY_IT_RIGHT_PROVIDER_IDS as readonly string[]).includes(value)
      ? (value as SayItRightProviderId)
      : undefined;
  }

  private async handleSynthesize(teacher: boolean): Promise<void> {
    const sentence = this.currentSentence || this.sentences[this.activeIndex];
    if (!sentence) return;
    try {
      const target = await getTtsTarget(this.context);
      const instructions = teacher ? target.teacherInstructions : "";
      const actualTtsModel = target.provider === "qwen" && teacher ? target.ttsInstructModel : target.ttsModel;
      let bytes: Buffer;
      let ext: string;
      if (target.provider === "openai") {
        bytes = await synthesizeOpenAISpeech(sentence, {
          apiKey: target.apiKey,
          baseURL: target.baseURL,
          model: actualTtsModel,
          voice: target.voice,
          instructions: instructions || undefined,
          speed: teacher ? 0.9 : 1.0,
          format: "mp3",
        });
        ext = "mp3";
      } else {
        const ttsConfig = await getTTSConfig(this.context);
        const providerConfig = this.ttsConfigForTarget(ttsConfig, target, instructions, teacher);
        const buffers = await synthesize(sentence, providerConfig, { slow: teacher });
        if (!buffers[0]) throw new Error("TTS returned no audio.");
        bytes = buffers[0];
        ext = audioExtension(bytes);
      }
      const key = audioCacheKey({
        text: sentence,
        provider: target.provider,
        model: actualTtsModel,
        voice: target.voice,
        instructions,
        format: ext,
      });
      const file = await cacheAudio(this.context, key, ext, bytes);
      this.lastAudioFile = file;
      this.post({ type: "audio", src: this.panel.webview.asWebviewUri(file).toString(), teacher });
      void this.postTimings(key, bytes, ext, target);
    } catch (e) {
      this.post({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async postTimings(key: string, bytes: Buffer, ext: string, target: TtsTarget): Promise<void> {
    if (this.currentTokenTexts.length === 0) return;
    const cached = await getCachedTimings(this.context, key);
    if (cached) {
      this.post({ type: "timings", timings: cached, estimated: false });
      return;
    }

    try {
      const asrConfig = await this.openAIAsrConfig(target);
      if (!asrConfig) {
        this.postEstimatedTimings();
        return;
      }
      const asr = await transcribeOpenAI(bytes, ext, {
        apiKey: asrConfig.apiKey,
        baseURL: asrConfig.baseURL,
        model: "whisper-1",
      });
      const duration = asr.words.reduce((max, word) => Math.max(max, word.end), 0);
      const timings = alignTimings(this.currentTokenTexts, asr.words, duration);
      await putTimings(this.context, key, timings);
      this.post({ type: "timings", timings, estimated: false });
    } catch {
      this.postEstimatedTimings();
    }
  }

  private postEstimatedTimings(): void {
    this.post({ type: "timings", timings: alignTimings(this.currentTokenTexts, [], 0), estimated: true });
  }

  private async openAIAsrConfig(target?: TtsTarget): Promise<ProviderConfig | undefined> {
    if (target?.provider === "openai" && target.apiKey) {
      return {
        id: "openai",
        title: PROVIDER_TITLES.openai,
        apiKey: target.apiKey,
        baseURL: target.baseURL,
        model: "whisper-1",
        apiProtocol: "openai",
      };
    }
    const cfg = await getProviderConfig(this.context, "openai");
    return cfg.apiKey ? cfg : undefined;
  }

  private ttsConfigForTarget(base: TTSConfig, target: TtsTarget, instructions: string, teacher: boolean): TTSConfig {
    switch (target.provider) {
      case "qwen":
        return {
          ...base,
          provider: target.provider,
          qwenModel: teacher ? target.ttsInstructModel : target.ttsModel,
          qwenVoice: target.voice,
          qwenInstructions: instructions,
        };
      case "gemini":
        return { ...base, provider: target.provider, geminiModel: target.ttsModel, geminiVoice: target.voice };
      case "mimo":
        return { ...base, provider: target.provider, mimoModel: target.ttsModel, mimoVoice: target.voice };
      case "minimax":
        return { ...base, provider: target.provider, minimaxModel: target.ttsModel, minimaxVoiceId: target.voice };
      case "openai":
        throw new Error("OpenAI speech is handled separately.");
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

  private async handleRecord(): Promise<void> {
    try {
      const folder = vscode.Uri.joinPath(this.context.globalStorageUri, "recordings");
      await mkdir(folder.fsPath, { recursive: true });
      const file = vscode.Uri.joinPath(folder, `${Date.now()}.wav`);
      await this.recorder.start(file.fsPath);
      this.post({ type: "recording-started" });
    } catch (e) {
      this.post({ type: "recording-error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async handleStopRecord(): Promise<void> {
    try {
      const file = await this.recorder.stop();
      this.lastRecordingFile = vscode.Uri.file(file);
      this.post({ type: "recording", src: this.panel.webview.asWebviewUri(this.lastRecordingFile).toString() });
    } catch (e) {
      this.post({ type: "recording-error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async handleCompare(): Promise<void> {
    if (!this.lastRecordingFile) {
      this.post({ type: "recording-error", message: "Record your take first." });
      return;
    }
    try {
      const cfg = await this.openAIAsrConfig();
      if (!cfg) throw new Error("Set an OpenAI API key to transcribe and compare your recording.");
      const audio = await readFile(this.lastRecordingFile.fsPath);
      const asr = await transcribeOpenAI(audio, "wav", {
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
        model: "whisper-1",
      });
      const feedback = compareWords(this.currentSentence, asr.text);
      const tip = await this.generateFeedbackTip(asr.text, feedback);
      this.post({ type: "feedback", transcript: asr.text, ...feedback, tip });
    } catch (e) {
      this.post({ type: "recording-error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async generateFeedbackTip(transcript: string, feedback: ReturnType<typeof compareWords>): Promise<string> {
    try {
      const cfg = await getAnalysisConfig(this.context);
      if (!cfg.apiKey) return buildFeedbackTip(feedback);
      const raw = await generateWithProvider(
        cfg,
        {
          system:
            'You are a practical English pronunciation coach. Return only json: {"tip":"..."} with one concise Simplified Chinese coaching tip about stress, weak forms, rhythm, or intonation.',
          user: [
            `Target: ${this.currentSentence}`,
            `Learner transcript: ${transcript}`,
            `Matched: ${feedback.matched}/${feedback.total}`,
            `Missed: ${feedback.missed.join(", ") || "none"}`,
            `Extra: ${feedback.extra.join(", ") || "none"}`,
          ].join("\n"),
        },
        20000,
        512,
        { responseMimeType: "application/json" },
      );
      const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()) as FeedbackTipJson;
      return parsed.tip?.trim() || buildFeedbackTip(feedback);
    } catch {
      return buildFeedbackTip(feedback);
    }
  }

  private async handleExportMine(): Promise<void> {
    if (!this.lastRecordingFile) {
      this.post({ type: "recording-error", message: "Record your take first." });
      return;
    }
    const target = await vscode.window.showSaveDialog({
      saveLabel: "Export your take",
      defaultUri: vscode.Uri.file("say-it-right-my-take.wav"),
      filters: { Audio: ["wav"] },
    });
    if (!target) return;
    await vscode.workspace.fs.copy(this.lastRecordingFile, target, { overwrite: true });
    void vscode.window.showInformationMessage(`Saved ${target.fsPath}`);
  }

  private post(msg: unknown): void {
    void this.panel.webview.postMessage(msg);
  }

  private html(): string {
    const w = this.panel.webview;
    const nonce = randomBytes(16).toString("hex");
    const base = vscode.Uri.joinPath(this.context.extensionUri, "media", "player");
    const js = w.asWebviewUri(vscode.Uri.joinPath(base, "player.js"));
    const css = w.asWebviewUri(vscode.Uri.joinPath(base, "player.css"));
    const canRecord = process.platform === "darwin";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${w.cspSource} blob:; img-src ${w.cspSource}; style-src ${w.cspSource}; script-src 'nonce-${nonce}';" />
<link href="${css}" rel="stylesheet" /></head>
<body>
  <div class="bar"><button id="prev">◀</button><span id="pos"></span><button id="next">▶</button></div>
  <div class="settings">
    <label>Provider <select id="provider"></select></label>
    <label>Analysis <select id="analysisModel"></select></label>
    <label>Speech <select id="ttsModel"></select></label>
    <label>Voice <select id="voice"></select></label>
    <button id="setKey">API Key</button>
  </div>
  <div class="legend" aria-label="Pronunciation marks">
    <span><b class="sample stress">ˈ</b> stressed syllable</span>
    <span><b class="sample nuclear">●</b> nuclear (sentence focus)</span>
    <span><b class="sample reduced">·</b> reduced</span>
    <span><b class="sample tone">↗ ↘ →</b> tone</span>
    <span><b class="link-sample">‿</b> link</span>
    <span class="legend-hint">click a sentence to practice it</span>
  </div>
  <div id="stave" class="stave"></div>
  <div class="controls">
    <button id="play">▶ Play</button>
    <label>Speed <input id="speed" type="range" min="0.25" max="4" step="0.05" value="1" /></label><span id="speedVal">1.00×</span>
    <button id="teacher">Teacher slow</button><button id="abrepeat">AB-repeat</button><button id="shadow">Shadow ×3</button><button id="repeat">↻</button><button id="export">⤓ Export</button>
  </div>
  <div class="controls record-controls" data-recording="${canRecord ? "on" : "off"}">
    ${
      canRecord
        ? '<button id="record">● Record</button><button id="playMine" disabled>▶ Your take</button><button id="compare" disabled>Compare</button><button id="exportMine" disabled>⤓ Export mine</button>'
        : '<span class="record-note">Recording is macOS-only in this version.</span>'
    }
  </div>
  <div id="feedback" class="feedback" aria-live="polite"></div>
  <div id="notes" class="notes"></div>
  <audio id="audio" preload="auto"></audio>
  <audio id="myaudio" preload="auto"></audio>
  <script nonce="${nonce}" src="${js}"></script>
</body></html>`;
  }
}
