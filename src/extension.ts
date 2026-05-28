import * as vscode from "vscode";
import { setApiKeyInteractive } from "./vscode/secrets";
import { CoachViewProvider } from "./vscode/sidebar/provider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new CoachViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CoachViewProvider.viewType, provider),
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
    vscode.commands.registerCommand("englishCoach.setApiKey", () => setApiKeyInteractive(context)),
  );
}

export function deactivate(): void {}
