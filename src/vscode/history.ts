import * as vscode from "vscode";
import { HistoryEntry, isHistoryEntry, mergeHistory } from "../core/history";

const KEY = "englishCoach.history.v1";

export type NewHistoryEntry = Omit<HistoryEntry, "id" | "createdAt">;

export class HistoryStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  load(): HistoryEntry[] {
    const raw = this.context.globalState.get<unknown[]>(KEY) ?? [];
    return Array.isArray(raw) ? raw.filter(isHistoryEntry) : [];
  }

  loadStarred(): HistoryEntry[] {
    return this.load().filter((e) => e.starred);
  }

  /** Append an entry and return its id (or undefined if it was empty and skipped). */
  async add(entry: NewHistoryEntry): Promise<string | undefined> {
    const source = entry.source.trim();
    const output = entry.output.trim();
    if (!source || !output) return undefined;
    const now = Date.now();
    const full: HistoryEntry = {
      ...entry,
      source,
      output,
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      createdAt: now,
    };
    await this.context.globalState.update(KEY, mergeHistory(this.load(), full));
    this._onDidChange.fire();
    return full.id;
  }

  async toggleStar(id: string): Promise<void> {
    await this.context.globalState.update(
      KEY,
      this.load().map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)),
    );
    this._onDidChange.fire();
  }

  async remove(id: string): Promise<void> {
    await this.context.globalState.update(
      KEY,
      this.load().filter((e) => e.id !== id),
    );
    this._onDidChange.fire();
  }

  async clear(): Promise<void> {
    await this.context.globalState.update(KEY, []);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
