import * as vscode from "vscode";
import { PROVIDER_IDS, ProviderId } from "../core/types";

export type SecretKeyId = ProviderId;

const SECRET_PREFIX = "englishCoach.secret.";

const SECRET_LABELS: Record<SecretKeyId, string> = {
  qwen: "Qwen / DashScope",
  deepseek: "DeepSeek",
  mimo: "Xiaomi MiMo",
  gemini: "Gemini",
  kimi: "Kimi",
  openai: "OpenAI / ChatGPT",
};

export function getSecret(context: vscode.ExtensionContext, id: SecretKeyId): Thenable<string | undefined> {
  return context.secrets.get(`${SECRET_PREFIX}${id}`);
}

export async function setApiKeyInteractive(context: vscode.ExtensionContext): Promise<void> {
  const ids: SecretKeyId[] = [...PROVIDER_IDS];
  const picked = await vscode.window.showQuickPick(
    ids.map((id) => ({ label: SECRET_LABELS[id], id })),
    { placeHolder: "Which API key do you want to set?" },
  );
  if (!picked) return;
  const value = await vscode.window.showInputBox({
    prompt: `Enter your ${picked.label} API key`,
    password: true,
    ignoreFocusOut: true,
  });
  if (value === undefined) return;
  const key = `${SECRET_PREFIX}${picked.id}`;
  if (value.trim() === "") {
    await context.secrets.delete(key);
    void vscode.window.showInformationMessage(`Cleared ${picked.label} API key.`);
  } else {
    await context.secrets.store(key, value.trim());
    void vscode.window.showInformationMessage(`Saved ${picked.label} API key.`);
  }
}
