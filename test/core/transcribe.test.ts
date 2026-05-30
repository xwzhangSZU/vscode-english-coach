import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeOpenAI, transcribeQwenFileUrl } from "../../src/core/transcribe";

describe("transcribeOpenAI", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs multipart to /audio/transcriptions and returns words with timings", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Go now",
        words: [
          { word: "Go", start: 0, end: 0.3 },
          { word: "now", start: 0.3, end: 0.6 },
        ],
      }),
    });
    const result = await transcribeOpenAI(Buffer.from([1, 2, 3]), "wav", {
      apiKey: "k",
      baseURL: "https://api.openai.com/v1",
    });
    expect(result).toEqual({
      text: "Go now",
      words: [
        { word: "Go", start: 0, end: 0.3 },
        { word: "now", start: 0.3, end: 0.6 },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws the API error text on non-ok", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "bad" });
    await expect(
      transcribeOpenAI(Buffer.from([1]), "wav", { apiKey: "k", baseURL: "https://api.openai.com/v1" }),
    ).rejects.toThrow(/bad|400/);
  });
});

describe("transcribeQwenFileUrl", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("submits a reachable file URL, polls the task, downloads transcript, and maps word times", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_id: "task-1" } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { task_status: "SUCCEEDED", results: [{ transcription_url: "https://example.test/t.json" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Go now",
          sentences: [
            {
              text: "Go now",
              words: [
                { text: "Go", begin_time: 0, end_time: 300 },
                { text: "now", begin_time: 300, end_time: 600 },
              ],
            },
          ],
        }),
      });
    const result = await transcribeQwenFileUrl({
      apiKey: "dash",
      baseURL: "https://dashscope.aliyuncs.com",
      fileUrl: "https://files.test/audio.wav",
      pollIntervalMs: 0,
    });
    expect(result.words).toEqual([
      { word: "Go", start: 0, end: 0.3 },
      { word: "now", start: 0.3, end: 0.6 },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-DashScope-Async"]).toBe("enable");
    expect(JSON.parse(init.body).input.file_urls).toEqual(["https://files.test/audio.wav"]);
  });
});
