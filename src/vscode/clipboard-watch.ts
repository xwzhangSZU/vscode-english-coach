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
  return /\s/.test(t);
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
    try {
      this.last = (await vscode.env.clipboard.readText()) ?? "";
    } catch {
      this.last = "";
    }
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
