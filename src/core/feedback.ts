export interface WordFeedback {
  matched: number;
  total: number;
  coverage: number;
  missed: string[];
  extra: string[];
}

/** Compare target vs learner transcript as a case/punctuation-insensitive word multiset. */
export function compareWords(target: string, transcript: string): WordFeedback {
  const expected = normalizeWords(target);
  const actual = normalizeWords(transcript);
  const pool = new Map<string, number>();
  for (const word of actual) pool.set(word, (pool.get(word) ?? 0) + 1);

  let matched = 0;
  const missed: string[] = [];
  for (const word of expected) {
    const count = pool.get(word) ?? 0;
    if (count > 0) {
      matched++;
      pool.set(word, count - 1);
    } else {
      missed.push(word);
    }
  }

  const extra: string[] = [];
  for (const [word, count] of pool) {
    for (let index = 0; index < count; index++) extra.push(word);
  }

  return {
    matched,
    total: expected.length,
    coverage: expected.length ? matched / expected.length : 0,
    missed,
    extra,
  };
}

export function buildFeedbackTip(feedback: WordFeedback): string {
  if (feedback.total === 0) return "没有可比较的目标文本。";
  if (feedback.coverage >= 0.95 && feedback.extra.length === 0) {
    return "词面匹配已经很好。下一轮重点放在重读词、弱读词和句末语调，不要把每个词都读成同样力度。";
  }
  const parts: string[] = [];
  if (feedback.missed.length > 0) {
    parts.push(`补上漏读词：${feedback.missed.slice(0, 5).join(", ")}`);
  }
  if (feedback.extra.length > 0) {
    parts.push(`减少多读词：${feedback.extra.slice(0, 5).join(", ")}`);
  }
  parts.push("再跟读时先听 nuclear stress 的位置，再把 function words 读轻。");
  return parts.join("；");
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
