import { generateWithProvider } from "./providers";
import { normalizeProsodyForEverydayEnglish } from "./prosody-normalize";
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
  "Analyze the text for word stress (which syllable), sentence stress, and intonation per thought group. Mark ONLY what a learner needs to practice — do not over-annotate.",
  "Thought groups: use as FEW as the sentence naturally needs (a short sentence is usually a single group). Each thought group has exactly ONE nuclear word — its main focus, normally the last content word — and that nuclear word must be marked stressed.",
  "Tones: use ONLY 'fall', 'rise', or 'level'. Use 'fall' for statements, commands, and wh-questions; 'rise' for yes/no questions and polite requests; 'level' for any non-final thought group. Do NOT use 'fall-rise' or 'rise-fall'.",
  "Stress: content words (nouns, main verbs, adjectives, adverbs, wh-words, phrasal-verb particles such as off/out/up) carry stress; function words (articles, prepositions, auxiliaries, pronouns, conjunctions) are reduced — set their stressIndex to null and stressed to false — unless genuinely contrastive. Do not stress a word just to fill space.",
  "stressIndex must point to the one syllable that carries primary stress within that word's syllables array, or null for a reduced word. Split each word into real syllables. Use General American IPA. Do not put punctuation inside word.text.",
  "Connected speech: leave linkToNext null for every word. The app adds the clear liaisons itself — do not add linking marks yourself.",
  'Respond with ONLY a single JSON object matching the required schema — no markdown code fences, no commentary, and do not return the schema itself. (Some providers\' JSON mode requires the literal word "json" to appear in the prompt.)',
].join("\n\n");

export function buildProsodyPrompt(text: string, isWord: boolean): { system: string; user: string } {
  const user = isWord
    ? `The user selected a single word: "${text}". Set isGeneratedExample=true, sourceWord="${text}", generate ONE natural example sentence using it, put that sentence in "text", and analyze that sentence.`
    : `Analyze this text: "${text}". Set isGeneratedExample=false.`;
  return { system: SYSTEM, user };
}

export function parseProsody(raw: string): ProsodyAnalysis {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const validated = validateProsody(repairProsodyShape(JSON.parse(cleaned)));
  return validateProsody(normalizeProsodyForEverydayEnglish(validated));
}

export async function analyzeProsody(
  text: string,
  config: ProviderConfig,
  timeoutMs: number,
  maxOutputTokens: number,
  isWord = false,
): Promise<ProsodyAnalysis> {
  const prompt = buildProsodyPrompt(text, isWord);
  const firstOptions =
    config.apiProtocol === "anthropic"
      ? { responseMimeType: "application/json" }
      : {
          responseMimeType: "application/json",
          responseJsonSchema: PROSODY_SCHEMA,
        };
  const raw = await generateWithProvider(config, prompt, timeoutMs, maxOutputTokens, {
    ...firstOptions,
  });
  try {
    return parseProsody(raw);
  } catch (firstError) {
    const retryPrompt = buildProsodyRetryPrompt(text, isWord, raw, firstError);
    const retryRaw = await generateWithProvider(config, retryPrompt, timeoutMs, maxOutputTokens, {
      responseMimeType: "application/json",
    });
    try {
      return parseProsody(retryRaw);
    } catch (retryError) {
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
      throw new Error(`Could not parse pronunciation analysis. First attempt: ${firstMessage}. Retry: ${retryMessage}.`);
    }
  }
}

function repairProsodyShape(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const loose = repairLooseWordAnalysis(record);
  if (loose) return loose;
  repairCanonicalThoughtGroups(record);
  if (typeof record.ipa !== "string" && Array.isArray(record.thoughtGroups)) {
    const wordIpa = collectWordIpa(record.thoughtGroups);
    if (wordIpa.length > 0) {
      record.ipa = `/${wordIpa.join(" ").replace(/\/+/g, "").trim()}/`;
    }
  }
  return record;
}

function repairCanonicalThoughtGroups(record: Record<string, unknown>): void {
  if (!Array.isArray(record.thoughtGroups)) return;
  for (const group of record.thoughtGroups) {
    if (!group || typeof group !== "object") continue;
    const currentGroup = group as Record<string, unknown>;
    currentGroup.tone = normalizeLooseTone(currentGroup.tone ?? currentGroup.intonation ?? currentGroup.pitch);
    const words = currentGroup.words;
    if (!Array.isArray(words)) continue;
    for (const word of words) {
      if (!word || typeof word !== "object") continue;
      const current = word as Record<string, unknown>;
      const text = typeof current.text === "string" && current.text.trim() ? current.text.trim() : "";
      if (!Array.isArray(current.syllables) || current.syllables.length === 0) {
        current.syllables = [text || "word"];
      }
      if (typeof current.stressed !== "boolean") {
        current.stressed = current.stressIndex !== null && current.stressIndex !== undefined;
      }
      if (typeof current.nuclear !== "boolean") {
        current.nuclear = false;
      }
      if (typeof current.stressIndex !== "number" && current.stressIndex !== null) {
        current.stressIndex = current.stressed ? 0 : null;
      } else if (typeof current.stressIndex === "number") {
        current.stressIndex = Math.min(
          Math.max(current.stressIndex, 0),
          Math.max((current.syllables as unknown[]).length - 1, 0),
        );
      }
      if (typeof current.ipa !== "string" || !current.ipa.trim()) {
        const syllables = current.syllables as unknown[];
        const ipa = syllables.map((syllable) => String(syllable)).join("");
        if (ipa.trim()) current.ipa = `/${ipa.replace(/\/+/g, "").trim()}/`;
      }
    }
  }
}

function repairLooseWordAnalysis(record: Record<string, unknown>): unknown | undefined {
  if (!Array.isArray(record.words) || !record.text || typeof record.text !== "string") {
    return undefined;
  }

  const looseWords = record.words as Array<Record<string, unknown>>;
  if (looseWords.length === 0) return undefined;
  const looseThoughtGroups = Array.isArray(record.thoughtGroups)
    ? (record.thoughtGroups as Array<Record<string, unknown>>)
    : [];
  const nuclearIndices = new Set(
    looseThoughtGroups
      .map((group) => group.nuclearStress)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const fallbackNuclearIndex = looseWords.length - 1;
  const words = looseWords.map((word, index) => {
    const syllables = normalizeLooseSyllables(word.syllables);
    const stress = typeof word.stress === "number" ? word.stress : undefined;
    const nuclear = nuclearIndices.size > 0 ? nuclearIndices.has(index) : index === fallbackNuclearIndex;
    const stressed = nuclear || Boolean(stress && stress > 0);
    const stressIndex = stressed ? Math.min(Math.max(stress ?? 0, 0), Math.max(syllables.length - 1, 0)) : null;
    return {
      text: String(word.text ?? ""),
      syllables: syllables.map((syllable) => syllable.text),
      stressIndex,
      stressed,
      nuclear,
      ipa: syllables.map((syllable) => syllable.ipa).filter(Boolean).join(" ") || undefined,
      linkToNext: null,
    };
  });
  return {
    text: record.text,
    isGeneratedExample: typeof record.isGeneratedExample === "boolean" ? record.isGeneratedExample : false,
    ipa:
      typeof record.ipa === "string"
        ? record.ipa
        : typeof record.transcription === "string"
          ? record.transcription
          : `/${words.map((word) => word.ipa).filter(Boolean).join(" ").replace(/\/+/g, "").trim()}/`,
    notes:
      typeof record.notes === "string"
        ? record.notes
        : typeof record.connectedSpeech === "string"
          ? record.connectedSpeech
          : undefined,
    thoughtGroups: [
      {
        tone: normalizeLooseTone(looseThoughtGroups[looseThoughtGroups.length - 1]?.tone),
        words,
      },
    ],
  };
}

function normalizeLooseSyllables(value: unknown): Array<{ text: string; ipa: string }> {
  if (!Array.isArray(value) || value.length === 0) return [{ text: "", ipa: "" }];
  return value.map((item) => {
    if (typeof item === "string") return { text: item, ipa: "" };
    if (!item || typeof item !== "object") return { text: "", ipa: "" };
    const record = item as Record<string, unknown>;
    return {
      text: String(record.text ?? ""),
      ipa: typeof record.ipa === "string" ? record.ipa : "",
    };
  });
}

function normalizeLooseTone(value: unknown): string {
  return value === "fall" || value === "rise" || value === "fall-rise" || value === "rise-fall" || value === "level"
    ? value
    : "fall";
}

function collectWordIpa(groups: unknown[]): string[] {
  const out: string[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const words = (group as Record<string, unknown>).words;
    if (!Array.isArray(words)) continue;
    for (const word of words) {
      if (!word || typeof word !== "object") continue;
      const ipa = (word as Record<string, unknown>).ipa;
      if (typeof ipa === "string" && ipa.trim()) out.push(ipa.trim());
    }
  }
  return out;
}

function buildProsodyRetryPrompt(
  text: string,
  isWord: boolean,
  previousRaw: string,
  error: unknown,
): { system: string; user: string } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const target = isWord
    ? `The user selected one word: "${text}". Generate one natural example sentence using it and analyze that sentence.`
    : `Analyze this text: "${text}".`;
  return {
    system: [
      SYSTEM,
      "Your previous answer was not a valid analysis object. Return an INSTANCE of the analysis data, not the JSON schema.",
      "The top-level keys must be exactly: text, isGeneratedExample, ipa, thoughtGroups, and optional sourceWord/notes.",
      "Never return schema keywords such as type, properties, required, items, or additionalProperties as top-level keys.",
    ].join("\n\n"),
    user: [
      target,
      `Set isGeneratedExample=${isWord ? "true" : "false"}.`,
      "For normal everyday English, reduce function words unless they are contrastive; put nuclear stress on the last natural content focus; use fall for statements/wh-questions and rise for yes/no questions or polite requests.",
      "Return only the JSON analysis object.",
      `Previous parse error: ${errorMessage}`,
      `Previous output excerpt: ${previousRaw.slice(0, 800)}`,
    ].join("\n"),
  };
}
