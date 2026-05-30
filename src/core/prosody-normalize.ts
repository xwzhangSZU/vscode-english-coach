import { ProsodyAnalysis, ProsodyWord, ThoughtGroup, Tone } from "./types";

const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "as",
  "than",
  "that",
  "to",
  "of",
  "for",
  "from",
  "in",
  "on",
  "at",
  "by",
  "with",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "through",
  "during",
  "without",
  "under",
  "i",
  "me",
  "my",
  "we",
  "us",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "them",
  "their",
  "this",
  "that",
  "these",
  "those",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "can",
  "could",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "must",
  "have",
  "has",
  "had",
  "there",
  "there's",
  "i'm",
  "you're",
  "we're",
  "they're",
  "he's",
  "she's",
  "it's",
  "i've",
  "you've",
  "we've",
  "they've",
  "i'll",
  "you'll",
  "we'll",
  "they'll",
  "he'll",
  "she'll",
  "it'll",
  "i'd",
  "you'd",
  "we'd",
  "they'd",
  "he'd",
  "she'd",
  "it'd",
  "that's",
  "what's",
  "who's",
  "where's",
  "when's",
  "how's",
  "gonna",
  "wanna",
  "gotta",
]);

const WH_OPENERS = new Set(["what", "when", "where", "which", "who", "whom", "whose", "why", "how"]);

const LINKABLE_END = /[bcdfghjklmnpqrstvwxyz]$/i;
const VOWEL_START = /^[aeiou]/i;

export function normalizeProsodyForEverydayEnglish(input: ProsodyAnalysis): ProsodyAnalysis {
  const text = input.text.trim();
  const mergedGroups = mergeShortThoughtGroups(mergeWeakThoughtGroups(input.thoughtGroups));
  const groups = mergedGroups.map((group, index, all) =>
    normalizeThoughtGroup(group, index, all.length, text),
  );

  return {
    ...input,
    text,
    thoughtGroups: groups,
    notes: appendNormalizationNote(input.notes),
  };
}

function mergeWeakThoughtGroups(groups: ThoughtGroup[]): ThoughtGroup[] {
  const pending = groups.map((group) => ({ ...group, words: group.words.map(cleanWord) }));
  const merged: ThoughtGroup[] = [];

  for (let index = 0; index < pending.length; index++) {
    const group = pending[index];
    if (isWeakGroup(group) && pending[index + 1]) {
      pending[index + 1] = {
        ...pending[index + 1],
        words: [...group.words, ...pending[index + 1].words],
      };
      continue;
    }

    if (isWeakGroup(group) && merged.length > 0) {
      const previous = merged[merged.length - 1];
      merged[merged.length - 1] = { ...previous, words: [...previous.words, ...group.words] };
      continue;
    }

    merged.push(group);
  }

  return merged.length > 0 ? merged : pending;
}

function isWeakGroup(group: ThoughtGroup): boolean {
  return group.words.length > 0 && group.words.every(isFunctionWord);
}

function mergeShortThoughtGroups(groups: ThoughtGroup[]): ThoughtGroup[] {
  if (groups.length <= 1) return groups;

  const pending = groups.map((group) => ({ ...group, words: [...group.words] }));
  const merged: ThoughtGroup[] = [];
  for (let index = 0; index < pending.length; index++) {
    const group = pending[index];
    if (isFunctionLedShortGroup(group) && pending[index + 1]) {
      pending[index + 1] = {
        ...pending[index + 1],
        words: [...group.words, ...pending[index + 1].words],
      };
      continue;
    }

    if (group.words.length === 1 && merged.length > 0) {
      const previous = merged[merged.length - 1];
      merged[merged.length - 1] = { ...previous, words: [...previous.words, ...group.words] };
      continue;
    }
    merged.push(group);
  }

  if (merged.length > 1 && merged[0].words.length === 1) {
    const [first, second, ...rest] = merged;
    return [{ ...second, words: [...first.words, ...second.words] }, ...rest];
  }

  return merged;
}

function isFunctionLedShortGroup(group: ThoughtGroup): boolean {
  return group.words.length > 0 && group.words.length <= 2 && isFunctionWord(group.words[0]);
}

function normalizeThoughtGroup(group: ThoughtGroup, index: number, total: number, sentenceText: string): ThoughtGroup {
  const cleanedWords = group.words.map(cleanWord);
  const nuclearIndex = chooseNuclearIndex(cleanedWords);
  const words = cleanedWords.map((word, wordIndex) => normalizeStress(word, wordIndex === nuclearIndex, wordIndex, cleanedWords));
  return {
    tone: chooseTone(index, total, sentenceText, words),
    words: inferLinks(words),
  };
}

function cleanWord(word: ProsodyWord): ProsodyWord {
  const text = word.text.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  const syllables = word.syllables.length > 0 ? word.syllables : [text || word.text];
  return { ...word, text: text || word.text.trim(), syllables };
}

function normalizeStress(word: ProsodyWord, nuclear: boolean, index: number, words: ProsodyWord[]): ProsodyWord {
  const functionWord = isFunctionWord(word);
  const contrastiveFinalFunctionWord = functionWord && nuclear && index === words.length - 1;
  const stressed = nuclear || !functionWord || contrastiveFinalFunctionWord;
  const stressIndex = stressed ? safeStressIndex(word) : null;
  return { ...word, stressed, nuclear, stressIndex };
}

function chooseNuclearIndex(words: ProsodyWord[]): number {
  for (let index = words.length - 1; index >= 0; index--) {
    if (!isFunctionWord(words[index])) return index;
  }

  return Math.max(words.length - 1, 0);
}

// Keep the learner-facing tone set to the three most universal contours: ↘ fall, ↗ rise, → level.
// Non-final groups are always sustained (level); the final group falls for statements/commands/wh-questions
// and rises for yes/no questions and polite requests. No fall-rise / rise-fall noise.
function chooseTone(index: number, total: number, sentenceText: string, words: ProsodyWord[]): Tone {
  if (index < total - 1) return "level";

  const normalized = sentenceText.trim();
  const first = wordKey(words[0]?.text ?? "");
  if (normalized.endsWith("?")) {
    if (WH_OPENERS.has(first)) return "fall";
    return "rise";
  }

  return "fall";
}

// Authoritative: ignore any model-provided links (they tend to over-mark) and keep only the single
// clearest case — a consonant-final word followed by a vowel-initial word (liaison). Everything else
// is cleared to null so the stave is not cluttered with marks a beginner does not need.
function inferLinks(words: ProsodyWord[]): ProsodyWord[] {
  return words.map((word, index) => {
    const next = words[index + 1];
    if (!next) return { ...word, linkToNext: null };
    const currentKey = wordKey(word.text);
    const nextKey = wordKey(next.text);
    if (LINKABLE_END.test(currentKey) && VOWEL_START.test(nextKey)) {
      return { ...word, linkToNext: "liaison" };
    }
    return { ...word, linkToNext: null };
  });
}

function isFunctionWord(word: ProsodyWord): boolean {
  return FUNCTION_WORDS.has(wordKey(word.text));
}

function wordKey(text: string): string {
  return text.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
}

function safeStressIndex(word: ProsodyWord): number {
  const index = typeof word.stressIndex === "number" ? word.stressIndex : 0;
  return Math.min(Math.max(index, 0), Math.max(word.syllables.length - 1, 0));
}

function appendNormalizationNote(notes: string | undefined): string {
  const suffix = "Everyday English prosody normalized: function words reduced unless contrastive; nuclear stress placed on the last natural content focus; final tone follows statement/question habit.";
  if (!notes?.trim()) return suffix;
  return notes.includes("Everyday English prosody normalized") ? notes : `${notes.trim()} ${suffix}`;
}
