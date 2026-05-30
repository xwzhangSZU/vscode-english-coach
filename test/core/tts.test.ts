import { describe, it, expect, vi, afterEach } from "vitest";
import { splitTextForQwen, wrapPCMInWAV, synthesize, TTSConfig } from "../../src/core/tts";

afterEach(() => vi.restoreAllMocks());

function ttsConfig(overrides: Partial<TTSConfig>): TTSConfig {
  return {
    provider: "qwen",
    geminiApiKey: "",
    geminiModel: "gemini-3.1-flash-tts-preview",
    geminiVoice: "Kore",
    dashscopeApiKey: "",
    qwenModel: "qwen3-tts-flash",
    qwenVoice: "Cherry",
    qwenLanguageType: "Auto",
    qwenBaseURL: "https://dashscope.aliyuncs.com/api/v1",
    qwenInstructions: "",
    mimoApiKey: "",
    mimoBaseURL: "",
    mimoModel: "",
    mimoVoice: "",
    minimaxApiKey: "",
    minimaxBaseURL: "",
    minimaxModel: "",
    minimaxVoiceId: "",
    ...overrides,
  };
}

describe("splitTextForQwen", () => {
  it("returns one chunk for short text", () => {
    expect(splitTextForQwen("Hello there.")).toEqual(["Hello there."]);
  });
  it("splits long text on sentence boundaries", () => {
    const long = "This is a sentence. ".repeat(40).trim();
    const chunks = splitTextForQwen(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("This is a sentence.");
  });
});

describe("wrapPCMInWAV", () => {
  it("prepends a 44-byte RIFF/WAVE header with valid fmt fields", () => {
    const pcm = Buffer.from([0, 1, 2, 3]);
    const wav = wrapPCMInWAV(pcm, 24000);
    expect(wav.length).toBe(44 + 4);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt16LE(22)).toBe(1); // channels (mono)
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample — must not be 0
    expect(wav.readUInt32LE(40)).toBe(pcm.length); // data chunk size
  });
});

describe("synthesize", () => {
  it("Qwen falls back to the audio URL when inline data is an empty string", async () => {
    // Qwen3-TTS returns { audio: { data: "", url: "…wav" } } — an empty string,
    // not null, so the code must use || (not ??) to reach the URL.
    const audioBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: unknown) => {
      if (String(input).includes("multimodal-generation")) {
        return new Response(JSON.stringify({ output: { audio: { data: "", url: "http://example.com/a.wav" } } }), {
          status: 200,
        });
      }
      return new Response(audioBytes, { status: 200 });
    });
    const buffers = await synthesize("hi", ttsConfig({ provider: "qwen", dashscopeApiKey: "k" }));
    expect(buffers).toHaveLength(1);
    expect(buffers[0].length).toBe(8);
  });

  it("MiMo decodes base64 audio from the chat-completions response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { audio: { data: "AQIDBA==" } } }] }), { status: 200 }),
    );
    const buffers = await synthesize(
      "hi",
      ttsConfig({ provider: "mimo", mimoApiKey: "k", mimoVoice: "Dean", mimoModel: "mimo-v2.5-tts" }),
    );
    expect(buffers).toHaveLength(1);
    expect(buffers[0].length).toBe(4);
    const [url, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body));
    expect(url).toBe("https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    expect(headers.Authorization).toBe("Bearer k");
    expect(headers["api-key"]).toBe("k");
    expect(body.model).toBe("mimo-v2.5-tts");
    expect(body.messages).toEqual([{ role: "assistant", content: "hi" }]);
    expect(body.audio).toEqual({ format: "wav", voice: "Dean" });
  });

  it("MiniMax decodes hex audio from t2a_v2", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: "01020304" } }), { status: 200 }),
    );
    const buffers = await synthesize(
      "hi",
      ttsConfig({
        provider: "minimax",
        minimaxApiKey: "k",
        minimaxModel: "speech-2.8-hd",
        minimaxVoiceId: "English_WiseScholar",
      }),
    );
    expect(buffers).toHaveLength(1);
    expect(buffers[0].length).toBe(4);
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(url).toBe("https://api.minimaxi.com/v1/t2a_v2");
    expect(body.model).toBe("speech-2.8-hd");
    expect(body.voice_setting.voice_id).toBe("English_WiseScholar");
    expect(body.audio_setting).toMatchObject({ sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 });
    expect(body.output_format).toBe("hex");
  });
});
