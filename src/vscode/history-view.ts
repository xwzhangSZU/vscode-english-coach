import * as vscode from "vscode";
import { HistoryEntry } from "../core/history";
import { HistoryStore } from "./history";

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryEntry> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly storeListener: vscode.Disposable;

  constructor(private readonly store: HistoryStore) {
    this.storeListener = store.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(entry: HistoryEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(oneLine(entry.source), vscode.TreeItemCollapsibleState.None);
    item.description = `${entry.kind === "coach" ? "Coach" : "Translate"} · ${entry.provider}`;
    item.tooltip = new vscode.MarkdownString(
      `**You:** ${entry.source}\n\n**Native:** ${entry.output}${entry.why ? `\n\n${entry.why}` : ""}`,
    );
    item.contextValue = "historyEntry";
    item.iconPath = entry.starred
      ? new vscode.ThemeIcon("star-full")
      : new vscode.ThemeIcon(entry.kind === "coach" ? "sparkle" : "globe");
    item.command = { command: "englishCoach.history.reload", title: "Reload in Coach", arguments: [entry] };
    return item;
  }

  getChildren(element?: HistoryEntry): HistoryEntry[] {
    return element ? [] : this.store.load();
  }

  dispose(): void {
    this.storeListener.dispose();
    this._onDidChangeTreeData.dispose();
  }
}

function oneLine(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}
