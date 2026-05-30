import { StaveRow } from "./stave";
import { AsrWord } from "./transcribe";

export interface TokenTiming {
  start: number;
  end: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']+/g, "");

/** Map each stave token to a timing. Greedy ASR match first; proportional fallback when ASR is unavailable. */
export function alignTimings(tokenTexts: string[], asr: AsrWord[], durationSec: number): TokenTiming[] {
  if (tokenTexts.length === 0) return [];
  if (asr.length === 0) return proportionalTimings(tokenTexts.length, durationSec);

  const out: TokenTiming[] = [];
  let nextSearch = 0;
  for (const token of tokenTexts) {
    const target = norm(token);
    let matched = -1;
    for (let index = nextSearch; index < asr.length; index++) {
      if (norm(asr[index].word) === target) {
        matched = index;
        break;
      }
    }
    if (matched >= 0) {
      out.push({ start: asr[matched].start, end: asr[matched].end });
      nextSearch = matched + 1;
    } else {
      const previousEnd = out[out.length - 1]?.end ?? 0;
      out.push({ start: previousEnd, end: previousEnd });
    }
  }

  return repairZeroLengthTimings(out, durationSec);
}

export function flattenStaveTokenTexts(rows: StaveRow[]): string[] {
  return rows.flatMap((row) => row.tokens.map((token) => token.text));
}

export function proportionalTimings(tokenCount: number, durationSec: number): TokenTiming[] {
  const total = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Math.max(1, tokenCount);
  const step = total / Math.max(1, tokenCount);
  return Array.from({ length: tokenCount }, (_, index) => ({
    start: round(index * step),
    end: round((index + 1) * step),
  }));
}

function repairZeroLengthTimings(timings: TokenTiming[], durationSec: number): TokenTiming[] {
  if (timings.every((timing) => timing.end > timing.start)) return timings.map(roundTiming);
  const fallback = proportionalTimings(timings.length, durationSec || lastEnd(timings));
  return timings.map((timing, index) => (timing.end > timing.start ? roundTiming(timing) : fallback[index]));
}

function lastEnd(timings: TokenTiming[]): number {
  return timings.reduce((max, timing) => Math.max(max, timing.end), 0);
}

function roundTiming(timing: TokenTiming): TokenTiming {
  return { start: round(timing.start), end: round(timing.end) };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
