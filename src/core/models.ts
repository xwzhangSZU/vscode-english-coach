import { ProviderId } from "./types";

export interface ModelEntry {
  id: string;
  title: string;
}

interface ProviderModels {
  fast: ModelEntry;
  pro: ModelEntry;
  all: ModelEntry[];
}

const MODEL_CATALOG: Record<ProviderId, ProviderModels> = {
  qwen: {
    fast: { id: "qwen-plus", title: "Qwen Plus" },
    pro: { id: "qwen-max", title: "Qwen Max" },
    all: [
      { id: "qwen-max", title: "Qwen Max" },
      { id: "qwen-plus", title: "Qwen Plus" },
      { id: "qwen-turbo", title: "Qwen Turbo" },
    ],
  },
  deepseek: {
    fast: { id: "deepseek-v4-flash", title: "V4 Flash" },
    pro: { id: "deepseek-v4-pro", title: "V4 Pro" },
    all: [
      { id: "deepseek-v4-flash", title: "V4 Flash" },
      { id: "deepseek-v4-pro", title: "V4 Pro" },
    ],
  },
  mimo: {
    fast: { id: "mimo-v2.5", title: "V2.5" },
    pro: { id: "mimo-v2.5-pro", title: "V2.5 Pro" },
    all: [
      { id: "mimo-v2.5-pro", title: "V2.5 Pro" },
      { id: "mimo-v2.5", title: "V2.5" },
    ],
  },
  gemini: {
    fast: { id: "gemini-3.5-flash", title: "3.5 Flash" },
    pro: { id: "gemini-3.1-pro-preview", title: "3.1 Pro (Preview)" },
    all: [
      { id: "gemini-3.5-flash", title: "3.5 Flash" },
      { id: "gemini-3.1-flash-lite", title: "3.1 Flash Lite" },
      { id: "gemini-3.1-flash-lite-preview", title: "3.1 Flash Lite (Preview)" },
      { id: "gemini-3.1-pro-preview", title: "3.1 Pro (Preview)" },
      { id: "gemini-2.5-flash", title: "2.5 Flash" },
      { id: "gemini-2.5-flash-lite", title: "2.5 Flash Lite" },
      { id: "gemini-2.5-pro", title: "2.5 Pro" },
    ],
  },
  minimax: {
    fast: { id: "MiniMax-M2.7-highspeed", title: "M2.7 High-Speed" },
    pro: { id: "MiniMax-M2.7-highspeed", title: "M2.7 High-Speed" },
    all: [
      { id: "MiniMax-M2.7-highspeed", title: "M2.7 High-Speed" },
      { id: "MiniMax-M2.7", title: "M2.7" },
      { id: "MiniMax-M2.5", title: "M2.5" },
    ],
  },
  openai: {
    fast: { id: "gpt-4.1-mini", title: "GPT-4.1 Mini" },
    pro: { id: "gpt-4.1", title: "GPT-4.1" },
    all: [
      { id: "gpt-5.5", title: "GPT-5.5" },
      { id: "gpt-5.5-pro", title: "GPT-5.5 Pro" },
      { id: "gpt-5.4", title: "GPT-5.4" },
      { id: "gpt-5.4-mini", title: "GPT-5.4 Mini" },
      { id: "gpt-5.4-nano", title: "GPT-5.4 Nano" },
      { id: "gpt-4.1", title: "GPT-4.1" },
      { id: "gpt-4.1-mini", title: "GPT-4.1 Mini" },
      { id: "gpt-4.1-nano", title: "GPT-4.1 Nano" },
      { id: "o4-mini", title: "o4 Mini" },
      { id: "gpt-4o", title: "GPT-4o" },
      { id: "gpt-4o-mini", title: "GPT-4o Mini" },
    ],
  },
};

export function getTierLabel(tier: string): string {
  switch (tier) {
    case "fast":
      return "Fast";
    case "pro":
      return "Pro";
    case "custom":
      return "Custom";
    default:
      return tier;
  }
}

export function resolveModel(providerId: ProviderId, tier: string, customModel: string): string {
  if (tier === "custom") return customModel;
  if (tier === "fast" || tier === "pro") return MODEL_CATALOG[providerId][tier].id;
  return customModel;
}

export const SAY_IT_RIGHT_PROVIDER_IDS = ["qwen", "minimax", "mimo", "gemini", "openai"] as const;

export type SayItRightProviderId = (typeof SAY_IT_RIGHT_PROVIDER_IDS)[number];

export const DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS: Record<SayItRightProviderId, string> = {
  qwen: "qwen3.6-flash",
  minimax: "MiniMax-M2.7-highspeed",
  mimo: "mimo-v2.5",
  gemini: "gemini-3.5-flash",
  openai: "gpt-5.4-nano",
};

export const SAY_IT_RIGHT_ANALYSIS_MODELS: Record<SayItRightProviderId, ModelEntry[]> = {
  qwen: [
    { id: "qwen3.6-flash", title: "Qwen 3.6 Flash" },
    { id: "qwen3.7-max", title: "Qwen 3.7 Max" },
    { id: "qwen3.5-flash", title: "Qwen 3.5 Flash" },
    { id: "qwen-plus", title: "Qwen Plus" },
  ],
  minimax: [
    { id: "MiniMax-M2.7-highspeed", title: "M2.7 High-Speed" },
    { id: "MiniMax-M2.7", title: "M2.7" },
  ],
  mimo: [
    { id: "mimo-v2.5-pro", title: "V2.5 Pro" },
    { id: "mimo-v2.5", title: "V2.5" },
  ],
  gemini: [
    { id: "gemini-3.5-flash", title: "3.5 Flash" },
    { id: "gemini-2.5-flash", title: "2.5 Flash" },
  ],
  openai: [
    { id: "gpt-5.4-nano", title: "GPT-5.4 Nano" },
    { id: "gpt-5.4-mini", title: "GPT-5.4 Mini" },
    { id: "gpt-5.5", title: "GPT-5.5" },
  ],
};

export const DEFAULT_SAY_IT_RIGHT_TTS_MODELS: Record<SayItRightProviderId, string> = {
  qwen: "qwen3-tts-flash",
  minimax: "speech-2.8-turbo",
  mimo: "mimo-v2.5-tts",
  gemini: "gemini-3.1-flash-tts-preview",
  openai: "gpt-4o-mini-tts",
};

export const SAY_IT_RIGHT_TTS_MODELS: Record<SayItRightProviderId, ModelEntry[]> = {
  qwen: [
    { id: "qwen3-tts-flash", title: "Qwen3 TTS Flash" },
    { id: "qwen3-tts-instruct-flash", title: "Qwen3 TTS Instruct Flash" },
  ],
  minimax: [
    { id: "speech-2.8-turbo", title: "Speech 2.8 Turbo" },
    { id: "speech-2.8-hd", title: "Speech 2.8 HD" },
  ],
  mimo: [{ id: "mimo-v2.5-tts", title: "MiMo V2.5 TTS" }],
  gemini: [
    { id: "gemini-3.1-flash-tts-preview", title: "Gemini 3.1 Flash TTS Preview" },
    { id: "gemini-2.5-flash-preview-tts", title: "Gemini 2.5 Flash Preview TTS" },
  ],
  openai: [{ id: "gpt-4o-mini-tts", title: "GPT-4o Mini TTS" }],
};

export const DEFAULT_TTS_VOICES: Record<SayItRightProviderId, string> = {
  qwen: "Jennifer",
  minimax: "English_expressive_narrator",
  mimo: "Chloe",
  gemini: "Charon",
  openai: "marin",
};

export const TTS_VOICES: Record<SayItRightProviderId, string[]> = {
  qwen: ["Jennifer", "Aiden", "Neil", "Elias", "Cherry", "Katerina"],
  minimax: [
    "English_expressive_narrator",
    "English_CaptivatingStoryteller",
    "English_Trustworth_Man",
    "English_SereneWoman",
    "English_WiseScholar",
  ],
  mimo: ["Chloe", "Mia", "Milo", "Dean"],
  gemini: ["Charon", "Iapetus", "Sulafat", "Puck"],
  openai: [
    "marin",
    "cedar",
    "coral",
    "alloy",
    "ash",
    "ballad",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
  ],
};
