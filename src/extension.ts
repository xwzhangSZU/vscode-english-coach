import * as vscode from "vscode";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";
import { ClipboardWatcher } from "./vscode/clipboard-watch";
import { stopSpeaking } from "./vscode/audio";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CoachViewProvider(context);
  const watcher = new ClipboardWatcher(context, provider);

  provider.onWatchToggle = () => watcher.sync();
  provider.onVisibilityChange = () => watcher.sync();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    watcher,
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
    vscode.commands.registerCommand("englishCoach.coachClipboard", async () => {
      const text = (await vscode.env.clipboard.readText()) ?? "";
      provider.reveal();
      await provider.coachText(text);
    }),
  );
}

export function deactivate(): void {
  stopSpeaking();
}
