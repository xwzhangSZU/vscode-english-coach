export type HistoryKind = "coach" | "translate";

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  source: string;
  output: string;
  why?: string;
  provider: string;
  model: string;
  createdAt: number;
  starred?: boolean;
}

export const MAX_HISTORY_ENTRIES = 50;

/**
 * Prepend the new entry, drop any exact duplicate (same kind+source+output), and
 * cap the list — but starred entries (the review deck) are always kept, only
 * unstarred recent history is capped. Re-coaching a starred pair keeps the star.
 */
export function mergeHistory(
  existing: HistoryEntry[],
  entry: HistoryEntry,
  max: number = MAX_HISTORY_ENTRIES,
): HistoryEntry[] {
  const isDup = (e: HistoryEntry) => e.kind === entry.kind && e.source === entry.source && e.output === entry.output;
  const head = existing.some((e) => isDup(e) && e.starred) ? { ...entry, starred: true } : entry;
  const deduped = existing.filter((e) => !isDup(e));
  let unstarred = 0;
  return [head, ...deduped].filter((e) => {
    if (e.starred) return true;
    unstarred += 1;
    return unstarred <= max;
  });
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    (e.kind === "coach" || e.kind === "translate") &&
    typeof e.source === "string" &&
    typeof e.output === "string" &&
    typeof e.provider === "string" &&
    typeof e.model === "string" &&
    typeof e.createdAt === "number"
  );
}
