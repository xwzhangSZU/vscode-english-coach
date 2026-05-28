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
