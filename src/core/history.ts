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
}

export const MAX_HISTORY_ENTRIES = 50;

/** Prepend the new entry, drop any exact duplicate (same kind+source+output), cap the list. */
export function mergeHistory(
  existing: HistoryEntry[],
  entry: HistoryEntry,
  max: number = MAX_HISTORY_ENTRIES,
): HistoryEntry[] {
  const deduped = existing.filter(
    (e) => !(e.kind === entry.kind && e.source === entry.source && e.output === entry.output),
  );
  return [entry, ...deduped].slice(0, max);
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
