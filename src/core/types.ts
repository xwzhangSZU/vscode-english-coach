export const PROVIDER_IDS = ["qwen", "minimax", "deepseek", "mimo", "gemini", "openai"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type TranslationStyle = "balanced" | "faithful" | "polished" | "academic";

export type PromptProfile = "screenshot" | "general" | "technical" | "academic" | "legal" | "subtitle" | "custom";

export type ModelTier = "fast" | "pro" | "custom";

export type RewriteTone = "natural" | "casual" | "formal" | "concise";

export type OCREngine = "local" | "tesseract" | "baidu" | "gemini" | "openai";

export type OCRTextLayout = "formatted" | "compact";

export type ProviderAPIProtocol = "openai" | "anthropic";

export type TTSProvider = "qwen" | "gemini" | "mimo" | "minimax";

export interface RuntimeSettings {
  modelTier: ModelTier;
  promptProfile: PromptProfile;
  translationStyle: TranslationStyle;
  customPromptInstructions: string;
  ttsProvider: TTSProvider;
}


export interface ProviderConfig {
  id: ProviderId;
  title: string;
  apiKey: string;
  baseURL: string;
  model: string;
  apiProtocol?: ProviderAPIProtocol;
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  targetLanguageTitle: string;
  style: TranslationStyle;
  promptProfile: PromptProfile;
  customPromptInstructions?: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export type TranslationStatus = "pending" | "success" | "error" | "missing-key";

export interface TranslationResult {
  providerId: ProviderId;
  providerTitle: string;
  modelName?: string;
  status: TranslationStatus;
  translation?: string;
  error?: string;
  durationMs?: number;
}

// ---- Prosody analysis (ported from raycast-say-it-right) ----
export type Tone = "fall" | "rise" | "fall-rise" | "rise-fall" | "level";
export type Link = "liaison" | "elision" | "intrusion" | null;

export interface ProsodyWord {
  text: string;
  syllables: string[];
  stressIndex: number | null;
  stressed: boolean;
  nuclear: boolean;
  ipa?: string;
  linkToNext?: Link;
}
export interface ThoughtGroup { tone: Tone; words: ProsodyWord[]; }
export interface ProsodyAnalysis {
  text: string;
  isGeneratedExample: boolean;
  sourceWord?: string;
  ipa: string;
  thoughtGroups: ThoughtGroup[];
  notes?: string;
}

const TONES: ReadonlySet<string> = new Set(["fall", "rise", "fall-rise", "rise-fall", "level"]);

/** Validate untrusted JSON into a ProsodyAnalysis. Throws Error on any violation. */
export function validateProsody(raw: unknown): ProsodyAnalysis {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.text !== "string" || !o.text) throw new Error("prosody: missing text");
  if (typeof o.ipa !== "string") throw new Error("prosody: missing ipa");
  if (!Array.isArray(o.thoughtGroups) || o.thoughtGroups.length === 0) throw new Error("prosody: empty thoughtGroups");
  for (const g of o.thoughtGroups as Array<Record<string, unknown>>) {
    if (!TONES.has(String(g.tone))) throw new Error(`prosody: invalid tone "${String(g.tone)}"`);
    if (!Array.isArray(g.words) || g.words.length === 0) throw new Error("prosody: empty words");
    for (const w of g.words as Array<Record<string, unknown>>) {
      if (typeof w.text !== "string" || !w.text) throw new Error("prosody: word missing text");
      if (!Array.isArray(w.syllables) || w.syllables.length === 0) throw new Error("prosody: word missing syllables");
      if (w.nuclear === true && w.stressed !== true) throw new Error("prosody: nuclear word must be stressed");
      if (w.stressIndex !== null && (typeof w.stressIndex !== "number" || (w.stressIndex as number) >= w.syllables.length)) {
        throw new Error("prosody: stressIndex out of range");
      }
    }
  }
  return raw as ProsodyAnalysis;
}
