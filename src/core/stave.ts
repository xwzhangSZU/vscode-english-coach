import { ProsodyAnalysis, Tone, Link } from "./types";

export interface StaveToken {
  text: string;
  syllables: string[];     // per-syllable spelling, so the webview can mark the exact stressed syllable
  stressIndex: number | null; // which syllable carries primary stress (null = reduced word)
  stressed: boolean;
  nuclear: boolean;
  reduced: boolean;        // stressIndex === null
  ipa?: string;
  link?: Exclude<Link, null>;
}
export type StavePointKind = "nuclear" | "stressed" | "reduced" | "plain";

export interface StavePoint {
  x: number;
  y: number;
  kind: StavePointKind;
}

export interface StaveRow {
  tone: Tone;
  toneMark: string;
  toneLabel: string;
  tokens: StaveToken[];
  points: StavePoint[];
}

const TONE_MARKS: Record<Tone, string> = {
  fall: "↘",
  rise: "↗",
  "fall-rise": "↘↗",
  "rise-fall": "↗↘",
  level: "→",
};

const TONE_LABELS: Record<Tone, string> = {
  fall: "fall",
  rise: "rise",
  "fall-rise": "fall-rise",
  "rise-fall": "rise-fall",
  level: "level",
};

/** Pure transform: ProsodyAnalysis -> rows the webview can paint (one row per thought group). */
export function toStave(a: ProsodyAnalysis): StaveRow[] {
  return a.thoughtGroups.map((g) => {
    const tokens = g.words.map((w) => ({
      text: w.text,
      syllables: w.syllables,
      stressIndex: w.stressIndex,
      stressed: w.stressed,
      nuclear: w.nuclear,
      reduced: w.stressIndex === null,
      ipa: w.ipa,
      link: w.linkToNext ?? undefined,
    }));
    return {
      tone: g.tone,
      toneMark: TONE_MARKS[g.tone],
      toneLabel: TONE_LABELS[g.tone],
      tokens,
      points: toPitchPoints(g.tone, tokens),
    };
  });
}

function toPitchPoints(tone: Tone, tokens: StaveToken[]): StavePoint[] {
  const last = Math.max(tokens.length - 1, 1);
  return tokens.map((token, index) => {
    const progress = tokens.length === 1 ? 0.5 : index / last;
    const x = tokens.length === 1 ? 50 : 8 + progress * 84;
    const y = clamp(toneY(tone, progress) + emphasisOffset(token), 14, 62);
    return { x: round(x), y: round(y), kind: pointKind(token) };
  });
}

function toneY(tone: Tone, progress: number): number {
  switch (tone) {
    case "fall":
      return 24 + progress * 30;
    case "rise":
      return 54 - progress * 30;
    case "fall-rise":
      return 24 + Math.sin(progress * Math.PI) * 30;
    case "rise-fall":
      return 54 - Math.sin(progress * Math.PI) * 30;
    case "level":
      return 38;
  }
}

function emphasisOffset(token: StaveToken): number {
  if (token.nuclear) return -5;
  if (token.stressed) return -3;
  if (token.reduced) return 5;
  return 0;
}

function pointKind(token: StaveToken): StavePointKind {
  if (token.nuclear) return "nuclear";
  if (token.stressed) return "stressed";
  if (token.reduced) return "reduced";
  return "plain";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
