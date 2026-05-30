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
  const ext = audioExtension(data);
  const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `tts-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`);
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

/** Pick a file extension from the audio's magic bytes so afplay reads it correctly. */
export function audioExtension(data: Buffer): string {
  if (data.length >= 4 && data.toString("ascii", 0, 4) === "RIFF") return "wav";
  if (data.length >= 3 && data.toString("ascii", 0, 3) === "ID3") return "mp3";
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "mp3";
  return "wav";
}
