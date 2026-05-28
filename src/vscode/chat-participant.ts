import * as vscode from "vscode";
import { getLanguageTitle, resolveTargetLanguage } from "../core/languages";
import { MissingAPIKeyError, translateWithProvider } from "../core/providers";
import { runRewrite } from "../core/rewrite";
import { TranslationRequest } from "../core/types";
import { PROVIDER_TITLES, defaultProviderId, getMaxOutputTokens, getProviderConfig, getTimeoutMs } from "./config";
import { HistoryStore } from "./history";

export function registerCoachParticipant(
  context: vscode.ExtensionContext,
  history: HistoryStore,
): vscode.ChatParticipant {
  const handler: vscode.ChatRequestHandler = async (request, _ctx, stream) => {
    const text = request.prompt.trim();
    if (!text) {
      stream.markdown("Type some English after `@coach`, or use `/translate` to translate.");
      return {};
    }
    const id = defaultProviderId();
    const title = PROVIDER_TITLES[id];
    try {
      const config = await getProviderConfig(context, id);
      if (request.command === "translate") {
        stream.progress("Translating…");
        const target = resolveTargetLanguage("auto", text);
        const req: TranslationRequest = {
          text,
          targetLanguage: target,
          targetLanguageTitle: getLanguageTitle(target),
          style: "balanced",
          promptProfile: "general",
          timeoutMs: getTimeoutMs(),
          maxOutputTokens: getMaxOutputTokens(),
        };
        const translation = await translateWithProvider(config, req);
        stream.markdown(translation);
        await history.add({ kind: "translate", source: text, output: translation, provider: title, model: config.model });
      } else {
        stream.progress("Coaching…");
        const result = await runRewrite(config, text, "natural", getTimeoutMs(), getMaxOutputTokens());
        stream.markdown(`**✨ Native version**\n\n${result.rewritten}\n\n**💡 为什么更自然**\n\n${result.why}`);
        await history.add({
          kind: "coach",
          source: text,
          output: result.rewritten,
          why: result.why,
          provider: title,
          model: config.model,
        });
      }
    } catch (e) {
      if (e instanceof MissingAPIKeyError) {
        stream.markdown(`Add a **${title}** API key via the **English Coach: Set API Key** command.`);
      } else {
        stream.markdown(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return {};
  };

  const participant = vscode.chat.createChatParticipant("englishCoach.coach", handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.svg");
  return participant;
}
