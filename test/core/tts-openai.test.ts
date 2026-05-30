import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { synthesizeOpenAISpeech } from "../../src/core/tts";

describe("synthesizeOpenAISpeech", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("POSTs to /v1/audio/speech with model, voice, instructions, speed and returns bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    (fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
    const buf = await synthesizeOpenAISpeech("Hello.", {
      apiKey: "k", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini-tts",
      voice: "marin", instructions: "Slowly.", speed: 0.9, format: "mp3",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "gpt-4o-mini-tts", voice: "marin", input: "Hello.", instructions: "Slowly.", speed: 0.9, response_format: "mp3" });
    expect(init.headers.Authorization).toBe("Bearer k");
  });

  it("throws with the API error text on non-ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" });
    await expect(synthesizeOpenAISpeech("Hi", { apiKey: "k", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini-tts", voice: "marin", format: "mp3" }))
      .rejects.toThrow(/401|bad key/);
  });
});
