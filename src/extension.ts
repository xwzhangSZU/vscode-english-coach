import * as vscode from "vscode";
import { HistoryEntry } from "./core/history";
import { stopSpeaking } from "./vscode/audio";
import { registerCoachParticipant } from "./vscode/chat-participant";
import { ClipboardWatcher } from "./vscode/clipboard-watch";
import { HistoryStore } from "./vscode/history";
import { HistoryTreeProvider } from "./vscode/history-view";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";

export function activate(context: vscode.ExtensionContext): void {
  const history = new HistoryStore(context);
  const provider = new CoachViewProvider(context, history);
  const watcher = new ClipboardWatcher(context, provider);
  const historyTree = new HistoryTreeProvider(history);

  provider.onWatchToggle = () => watcher.sync();
  provider.onVisibilityChange = () => watcher.sync();

  context.subscriptions.push(
    history,
    historyTree,
    watcher,
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    vscode.window.registerTreeDataProvider("englishCoach.history", historyTree),
    registerCoachParticipant(context, history),
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
    vscode.commands.registerCommand("englishCoach.coachClipboard", async () => {
      const text = (await vscode.env.clipboard.readText()) ?? "";
      provider.reveal();
      await provider.coachText(text);
    }),
    vscode.commands.registerCommand("englishCoach.history.reload", (entry: HistoryEntry) => provider.restoreEntry(entry)),
    vscode.commands.registerCommand("englishCoach.history.copyOutput", async (entry: HistoryEntry) => {
      await vscode.env.clipboard.writeText(entry.output);
      void vscode.window.showInformationMessage("Copied the native version.");
    }),
    vscode.commands.registerCommand("englishCoach.history.delete", async (entry: HistoryEntry) => {
      await history.remove(entry.id);
    }),
    vscode.commands.registerCommand("englishCoach.history.clear", async () => {
      const ok = await vscode.window.showWarningMessage("Clear all English Coach history?", { modal: true }, "Clear");
      if (ok === "Clear") await history.clear();
    }),
  );
}

export function deactivate(): void {
  stopSpeaking();
}
