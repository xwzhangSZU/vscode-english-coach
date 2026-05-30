import { generateWithProvider } from "./providers";
import { ProviderConfig, ProsodyAnalysis, validateProsody } from "./types";

export const PROSODY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["text", "isGeneratedExample", "ipa", "thoughtGroups"],
  properties: {
    text: { type: "string" },
    isGeneratedExample: { type: "boolean" },
    sourceWord: { type: "string" },
    ipa: { type: "string" },
    notes: { type: "string" },
    thoughtGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tone", "words"],
        properties: {
          tone: { type: "string", enum: ["fall", "rise", "fall-rise", "rise-fall", "level"] },
          words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "syllables", "stressIndex", "stressed", "nuclear"],
              properties: {
                text: { type: "string" },
                syllables: { type: "array", items: { type: "string" } },
                stressIndex: { type: ["integer", "null"] },
                stressed: { type: "boolean" },
                nuclear: { type: "boolean" },
                ipa: { type: "string" },
                linkToNext: { type: ["string", "null"], enum: ["liaison", "elision", "intrusion", null] },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = [
  "You are an expert English pronunciation coach specializing in General American prosody.",
  "Analyze the given English text for word stress, sentence stress, intonation (rising/falling tones per thought group), rhythm, and connected-speech linking.",
  "Rules: content words (nouns, main verbs, adjectives, adverbs, wh-words) are usually stressed; function words (articles, prepositions, auxiliaries, pronouns) are usually reduced. Each thought group has exactly one nuclear word, normally its last content word, and the nuclear word must be marked stressed. stressIndex must be a valid index into that word's syllables array, or null for a reduced word. Use General American IPA.",
].join("\n\n");

export function buildProsodyPrompt(text: string, isWord: boolean): { system: string; user: string } {
  const user = isWord
    ? `The user selected a single word: "${text}". Set isGeneratedExample=true, sourceWord="${text}", generate ONE natural example sentence using it, put that sentence in "text", and analyze that sentence.`
    : `Analyze this text: "${text}". Set isGeneratedExample=false.`;
  return { system: SYSTEM, user };
}

export function parseProsody(raw: string): ProsodyAnalysis {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return validateProsody(JSON.parse(cleaned));
}

export async function analyzeProsody(
  text: string,
  config: ProviderConfig,
  timeoutMs: number,
  maxOutputTokens: number,
  isWord = false,
): Promise<ProsodyAnalysis> {
  const prompt = buildProsodyPrompt(text, isWord);
  const raw = await generateWithProvider(config, prompt, timeoutMs, maxOutputTokens, {
    responseMimeType: "application/json",
    responseJsonSchema: PROSODY_SCHEMA,
  });
  return parseProsody(raw);
}
