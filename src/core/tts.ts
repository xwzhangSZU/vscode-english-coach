import { TTSProvider } from "./types";

export interface TTSConfig {
  provider: TTSProvider;
  geminiApiKey: string;
  geminiVoice: string;
  dashscopeApiKey: string;
  qwenModel: string;
  qwenVoice: string;
  qwenLanguageType: string;
  qwenBaseURL: string;
  qwenInstructions: string;
}

export interface SynthesizeOptions {
  slow?: boolean;
  signal?: AbortSignal;
}

const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_TTS_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_DEFAULT_VOICE = "Kore";
const GEMINI_SAMPLE_RATE = 24000;

const QWEN_TTS_INSTRUCT_MODEL = "qwen3-tts-instruct-flash";
const QWEN_TTS_DEFAULT_MODEL = "qwen3-tts-flash";
const QWEN_TTS_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const QWEN_TTS_DEFAULT_VOICE = "Cherry";
const QWEN_TTS_MAX_CHARS = 550;
const QWEN_TTS_SOFT_CHARS = 420;

const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;

interface GeminiTTSResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  error?: { message?: string };
}

interface QwenTTSResponse {
  output?: { audio?: { data?: string; url?: string } };
  code?: string | number;
  message?: string;
}

/** Synthesize speech and return one playable audio buffer per chunk. Throws on failure. */
export async function synthesize(
  text: string,
  config: TTSConfig,
  options: SynthesizeOptions = {},
): Promise<Buffer[]> {
  const trimmed = text.trim().slice(0, 5000);
  if (!trimmed) return [];

  const slow = Boolean(options.slow);
  const chunks = config.provider === "qwen" ? splitTextForQwen(trimmed) : [trimmed];
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    if (options.signal?.aborted) break;
    const buf =
      config.provider === "qwen"
        ? await synthesizeWithQwen(chunk, slow, config, options.signal)
        : await synthesizeWithGemini(chunk, slow, config, options.signal);
    buffers.push(buf);
  }
  return buffers;
}

async function synthesizeWithGemini(
  text: string,
  slow: boolean,
  config: TTSConfig,
  signal?: AbortSignal,
): Promise<Buffer> {
  const apiKey = config.geminiApiKey.trim();
  if (!apiKey) throw new Error("Add a Gemini API key to use Gemini read-aloud.");
  const voiceName = config.geminiVoice.trim() || GEMINI_DEFAULT_VOICE;
  const spokenText = slow
    ? `Read the following slowly and clearly, enunciating each word like a language teacher helping a learner: ${text}`
    : text;

  const response = await fetch(`${GEMINI_TTS_BASE_URL}/models/${GEMINI_TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: spokenText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
    signal,
  });

  const responseText = await response.text();
  const data = parseJson<GeminiTTSResponse>(responseText);
  if (!response.ok || data.error?.message) {
    throw new Error(data.error?.message ?? `Gemini TTS HTTP ${response.status}`);
  }
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) throw new Error("Gemini TTS returned no audio.");
  return wrapPCMInWAV(Buffer.from(audioBase64, "base64"), GEMINI_SAMPLE_RATE);
}

async function synthesizeWithQwen(
  text: string,
  slow: boolean,
  config: TTSConfig,
  signal?: AbortSignal,
): Promise<Buffer> {
  const apiKey = config.dashscopeApiKey.trim();
  if (!apiKey) throw new Error("Add a DashScope API key to use Qwen read-aloud.");
  const model = config.qwenModel === QWEN_TTS_INSTRUCT_MODEL ? QWEN_TTS_INSTRUCT_MODEL : QWEN_TTS_DEFAULT_MODEL;
  const voice = config.qwenVoice.trim() || QWEN_TTS_DEFAULT_VOICE;
  const languageType = config.qwenLanguageType.trim() || "Auto";
  const instructions =
    model === QWEN_TTS_INSTRUCT_MODEL
      ? [config.qwenInstructions.trim(), slow ? "Read slowly and clearly, enunciating each word." : ""]
          .filter(Boolean)
          .join(" ")
      : "";

  const response = await fetch(qwenGenerationUrl(config.qwenBaseURL), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: { text, voice, language_type: languageType, ...(instructions ? { instructions } : {}) },
    }),
    signal,
  });

  const responseText = await response.text();
  const data = parseJson<QwenTTSResponse>(responseText);
  if (!response.ok || data.message || data.code) {
    throw new Error(data.message ?? `Qwen TTS HTTP ${response.status}`);
  }
  const base64 = data.output?.audio?.data || (await fetchUrlAsBase64(data.output?.audio?.url, signal));
  if (!base64) throw new Error("Qwen TTS returned no audio.");
  return Buffer.from(base64, "base64");
}

async function fetchUrlAsBase64(url: string | undefined, signal?: AbortSignal): Promise<string | undefined> {
  if (!url) return undefined;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Qwen TTS audio download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

function qwenGenerationUrl(baseURL: string): string {
  const trimmed = (baseURL.trim() || QWEN_TTS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const suffix = "/services/aigc/multimodal-generation/generation";
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

export function splitTextForQwen(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let count = 0;
  for (const char of text) {
    current += char;
    count += 1;
    if (count >= QWEN_TTS_MAX_CHARS || (count >= QWEN_TTS_SOFT_CHARS && "。！？.!?；;".includes(char))) {
      const chunk = current.trim();
      if (chunk) chunks.push(chunk);
      current = "";
      count = 0;
    }
  }
  const tail = current.trim();
  if (tail) chunks.push(tail);
  return chunks;
}

export function wrapPCMInWAV(pcmData: Buffer, sampleRate: number): Buffer {
  const byteRate = sampleRate * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const blockAlign = PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(PCM_CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

function parseJson<T>(text: string): T & { error?: { message?: string } } {
  try {
    return JSON.parse(text) as T & { error?: { message?: string } };
  } catch {
    return { error: { message: text ? `Invalid response: ${text.slice(0, 100)}` : "Empty response" } } as T & {
      error?: { message?: string };
    };
  }
}
