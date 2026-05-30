import * as vscode from "vscode";
import { HistoryEntry } from "./core/history";
import { HistoryStore } from "./vscode/history";
import { HistoryTreeProvider } from "./vscode/history-view";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";
import { SayItRightPanel } from "./vscode/player/panel";

export function activate(context: vscode.ExtensionContext): void {
  const history = new HistoryStore(context);
  const provider = new CoachViewProvider(context, history);
  const historyTree = new HistoryTreeProvider(history);

  context.subscriptions.push(
    history,
    historyTree,
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    vscode.window.registerTreeDataProvider("englishCoach.history", historyTree),
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
    vscode.commands.registerCommand("englishCoach.reviewDeck", () => provider.startReview()),
    vscode.commands.registerCommand("englishCoach.history.reload", (entry: HistoryEntry) =>
      provider.restoreEntry(entry),
    ),
    vscode.commands.registerCommand("englishCoach.history.star", async (entry: HistoryEntry) => {
      await history.toggleStar(entry.id);
    }),
    vscode.commands.registerCommand("englishCoach.history.copyOutput", async (entry: HistoryEntry) => {
      await vscode.env.clipboard.writeText(entry.output);
      void vscode.window.showInformationMessage("Copied the native version.");
    }),
    vscode.commands.registerCommand("englishCoach.history.delete", async (entry: HistoryEntry) => {
      await history.remove(entry.id);
    }),
    vscode.commands.registerCommand("englishCoach.history.clear", async () => {
      const ok = await vscode.window.showWarningMessage("Clear all Say It Right history?", { modal: true }, "Clear");
      if (ok === "Clear") await history.clear();
    }),
    vscode.commands.registerCommand("sayItRight.analyzeSelection", () => {
      const ed = vscode.window.activeTextEditor;
      const text = ed?.document.getText(ed.selection)?.trim();
      if (!text) {
        void vscode.window.showWarningMessage("Select some English text first.");
        return;
      }
      SayItRightPanel.show(context, text);
    }),
    vscode.commands.registerCommand("sayItRight.practiceSentence", async (initialText?: string) => {
      const text =
        typeof initialText === "string" && initialText.trim()
          ? initialText.trim()
          : (await vscode.window.showInputBox({ prompt: "Type or paste an English sentence" }))?.trim();
      if (text) SayItRightPanel.show(context, text);
    }),
  );
}

export function deactivate(): void {}
