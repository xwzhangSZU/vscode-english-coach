import * as vscode from "vscode";
import {
  DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS,
  DEFAULT_SAY_IT_RIGHT_TTS_MODELS,
  DEFAULT_TTS_VOICES,
  SAY_IT_RIGHT_PROVIDER_IDS,
  SayItRightProviderId,
  resolveModel,
} from "../core/models";
import { detectProtocol } from "../core/providers";
import { TTSConfig } from "../core/tts";
import { ModelTier, PROVIDER_IDS, ProviderConfig, ProviderId } from "../core/types";
import { getSecret } from "./secrets";

export interface TtsTarget {
  provider: SayItRightProviderId;
  voice: string;
  teacherInstructions: string;
  ttsModel: string;
  ttsInstructModel: string;
  baseURL: string;
  apiKey: string;
}

export const PROVIDER_TITLES: Record<ProviderId, string> = {
  qwen: "Qwen (DashScope)",
  minimax: "MiniMax",
  deepseek: "DeepSeek",
  mimo: "Xiaomi MiMo",
  gemini: "Gemini",
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

function isSayItRightProviderId(value: string): value is SayItRightProviderId {
  return (SAY_IT_RIGHT_PROVIDER_IDS as readonly string[]).includes(value);
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
  const raw = c.get<string>("tts.provider") ?? "qwen";
  const provider = (["qwen", "gemini", "mimo", "minimax"].includes(raw) ? raw : "qwen") as TTSConfig["provider"];
  return {
    provider,
    geminiApiKey: (await getSecret(context, "gemini")) ?? "",
    geminiModel: c.get<string>("tts.geminiModel") ?? "gemini-3.1-flash-tts-preview",
    geminiVoice: c.get<string>("tts.geminiVoice") ?? "Charon",
    dashscopeApiKey: (await getSecret(context, "qwen")) ?? "",
    qwenModel: c.get<string>("tts.qwenModel") ?? "qwen3-tts-flash",
    qwenVoice: c.get<string>("tts.qwenVoice") ?? "Jennifer",
    qwenLanguageType: c.get<string>("tts.qwenLanguageType") ?? "Auto",
    qwenBaseURL: c.get<string>("tts.qwenBaseURL") ?? "https://dashscope.aliyuncs.com/api/v1",
    qwenInstructions: c.get<string>("tts.qwenInstructions") ?? "",
    mimoApiKey: (await getSecret(context, "mimo")) ?? "",
    mimoBaseURL: c.get<string>("mimo.baseURL") ?? "https://token-plan-cn.xiaomimimo.com/v1",
    mimoModel: c.get<string>("tts.mimoModel") ?? "mimo-v2.5-tts",
    mimoVoice: c.get<string>("tts.mimoVoice") ?? "Chloe",
    minimaxApiKey: (await getSecret(context, "minimax")) ?? "",
    minimaxBaseURL: c.get<string>("tts.minimaxBaseURL") ?? "https://api.minimaxi.com/v1",
    minimaxModel: c.get<string>("tts.minimaxModel") ?? "speech-2.8-turbo",
    minimaxVoiceId: c.get<string>("tts.minimaxVoiceId") ?? "English_expressive_narrator",
  };
}

function sirCfg() {
  return vscode.workspace.getConfiguration("sayItRight");
}

export async function getAnalysisConfig(context: vscode.ExtensionContext): Promise<ProviderConfig> {
  const c = sirCfg();
  const rawProvider = c.get<string>("provider") ?? "qwen";
  const provider = isSayItRightProviderId(rawProvider) ? rawProvider : "qwen";
  const base = await getProviderConfig(context, provider);
  const overrideModel = (c.get<string>(`analysisModel.${provider}`) ?? "").trim();
  return { ...base, model: overrideModel || DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS[provider] || base.model };
}

export async function getTtsTarget(context: vscode.ExtensionContext): Promise<TtsTarget> {
  const c = sirCfg();
  const rawProvider = c.get<string>("provider") ?? "qwen";
  const provider = isSayItRightProviderId(rawProvider) ? rawProvider : "qwen";
  const base = await getProviderConfig(context, provider);
  return {
    provider,
    voice: (c.get<string>(`voice.${provider}`) ?? "").trim() || DEFAULT_TTS_VOICES[provider],
    teacherInstructions: (c.get<string>("teacherInstructions") ?? "").trim(),
    ttsModel: (c.get<string>(`ttsModel.${provider}`) ?? "").trim() || DEFAULT_SAY_IT_RIGHT_TTS_MODELS[provider],
    ttsInstructModel: (c.get<string>("ttsInstructModel.qwen") ?? "").trim() || "qwen3-tts-instruct-flash",
    baseURL: base.baseURL,
    apiKey: base.apiKey,
  };
}
