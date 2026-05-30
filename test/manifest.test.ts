import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const properties = manifest.contributes.configuration.properties as Record<string, any>;

describe("extension manifest provider defaults", () => {
  it("shows Xiaomi MiMo in the default Coach provider switcher", () => {
    expect(properties["englishCoach.mimo.enabled"].default).toBe(true);
    expect(properties["englishCoach.providerOrder"].default.split(",")).toContain("mimo");
  });

  it("exposes analysis, speech model, and voice choices for MiniMax and MiMo", () => {
    expect(properties["sayItRight.provider"].enum).toEqual(expect.arrayContaining(["minimax", "mimo"]));
    expect(properties["sayItRight.analysisModel.minimax"].enum).toContain("MiniMax-M2.7-highspeed");
    expect(properties["sayItRight.analysisModel.mimo"].enum).toContain("mimo-v2.5-pro");
    expect(properties["sayItRight.ttsModel.minimax"].enum).toContain("speech-2.8-turbo");
    expect(properties["sayItRight.ttsModel.mimo"].enum).toContain("mimo-v2.5-tts");
    expect(properties["sayItRight.voice.minimax"].enum).toContain("English_expressive_narrator");
    expect(properties["sayItRight.voice.mimo"].enum).toEqual(expect.arrayContaining(["Chloe", "Mia", "Milo", "Dean"]));
  });

  it("declares the macOS ffmpeg recorder path setting", () => {
    expect(properties["sayItRight.ffmpegPath"].default).toBe("/opt/homebrew/bin/ffmpeg");
  });
});
