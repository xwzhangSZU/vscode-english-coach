import * as vscode from "vscode";
import { spawn, ChildProcess } from "node:child_process";
import { stat } from "node:fs/promises";
import { buildAvfoundationArgs } from "../core/ffmpeg-args";

export class Recorder {
  private proc?: ChildProcess;
  private outPath?: string;
  private stderr = "";

  static ffmpegPath(): string {
    return (
      vscode.workspace.getConfiguration("sayItRight").get<string>("ffmpegPath")?.trim() ||
      "/opt/homebrew/bin/ffmpeg"
    );
  }

  static async ffmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(Recorder.ffmpegPath(), ["-version"], { stdio: ["ignore", "ignore", "ignore"] });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  }

  async start(outPath: string): Promise<void> {
    if (process.platform !== "darwin") throw new Error("Recording is macOS-only in this version.");
    if (this.proc) throw new Error("Already recording.");
    if (!(await Recorder.ffmpegAvailable())) {
      throw new Error("ffmpeg not found. Install it with: brew install ffmpeg");
    }

    this.outPath = outPath;
    this.stderr = "";
    const proc = spawn(Recorder.ffmpegPath(), buildAvfoundationArgs(":default", outPath), {
      stdio: ["pipe", "ignore", "pipe"],
    });
    this.proc = proc;
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.stderr += text;
      if (/permission|not authorized|denied/i.test(text)) {
        void vscode.window.showWarningMessage(
          "Grant VS Code microphone access in System Settings > Privacy & Security > Microphone.",
        );
      }
    });
    proc.on("error", (error) => {
      this.proc = undefined;
      void vscode.window.showWarningMessage(error.message);
    });
  }

  async stop(): Promise<string> {
    const proc = this.proc;
    const outPath = this.outPath;
    if (!proc || !outPath) throw new Error("Not recording.");

    this.proc = undefined;
    this.outPath = undefined;
    const stderr = this.stderr;
    await new Promise<void>((resolve, reject) => {
      proc.on("close", () => resolve());
      proc.on("error", reject);
      proc.stdin?.write("q");
      proc.stdin?.end();
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGINT");
      }, 1500);
    });

    const info = await stat(outPath).catch(() => undefined);
    if (!info || info.size === 0) {
      const hint = /permission|not authorized|denied/i.test(stderr)
        ? "Grant VS Code microphone access in System Settings > Privacy & Security > Microphone."
        : "No recording was captured.";
      throw new Error(hint);
    }
    return outPath;
  }

  dispose(): void {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGINT");
    }
    this.proc = undefined;
    this.outPath = undefined;
  }
}
