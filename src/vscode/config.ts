import * as vscode from "vscode";
import { resolveModel } from "../core/models";
import { detectProtocol } from "../core/providers";
import { TTSConfig } from "../core/tts";
import { ModelTier, PROVIDER_IDS, ProviderConfig, ProviderId } from "../core/types";
import { getSecret } from "./secrets";

export const PROVIDER_TITLES: Record<ProviderId, string> = {
  qwen: "Qwen (DashScope)",
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
    dashscopeApiKey: (await getSecret(context, "qwen")) ?? "",
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
