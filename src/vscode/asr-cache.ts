import * as vscode from "vscode";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { TokenTiming } from "../core/align";

function dir(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, "asr-cache");
}

export async function getCachedTimings(
  context: vscode.ExtensionContext,
  key: string,
): Promise<TokenTiming[] | undefined> {
  try {
    const file = vscode.Uri.joinPath(dir(context), `${key}.json`);
    const parsed = JSON.parse(await readFile(file.fsPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const timings = parsed.filter(isTiming);
    return timings.length === parsed.length ? timings : undefined;
  } catch {
    return undefined;
  }
}

export async function putTimings(
  context: vscode.ExtensionContext,
  key: string,
  timings: TokenTiming[],
): Promise<void> {
  const folder = dir(context);
  await mkdir(folder.fsPath, { recursive: true });
  const file = vscode.Uri.joinPath(folder, `${key}.json`);
  await writeFile(file.fsPath, JSON.stringify(timings), "utf8");
}

function isTiming(value: unknown): value is TokenTiming {
  if (!value || typeof value !== "object") return false;
  const timing = value as Record<string, unknown>;
  return typeof timing.start === "number" && typeof timing.end === "number";
}
