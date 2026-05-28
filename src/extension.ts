import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("englishCoach.focus", () => {
      void vscode.commands.executeCommand("englishCoach.sidebar.focus");
    }),
  );
  console.log("English Coach activated");
}

export function deactivate(): void {}
