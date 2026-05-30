import { ProsodyAnalysis, Tone, Link } from "./types";

export interface StaveToken {
  text: string;
  stressed: boolean;
  nuclear: boolean;
  reduced: boolean;        // stressIndex === null
  ipa?: string;
  link?: Exclude<Link, null>;
}
export interface StaveRow { tone: Tone; tokens: StaveToken[]; }

/** Pure transform: ProsodyAnalysis -> rows the webview can paint (one row per thought group). */
export function toStave(a: ProsodyAnalysis): StaveRow[] {
  return a.thoughtGroups.map((g) => ({
    tone: g.tone,
    tokens: g.words.map((w) => ({
      text: w.text,
      stressed: w.stressed,
      nuclear: w.nuclear,
      reduced: w.stressIndex === null,
      ipa: w.ipa,
      link: w.linkToNext ?? undefined,
    })),
  }));
}
