export interface AsrWord {
  word: string;
  start: number;
  end: number;
}

export interface AsrResult {
  text: string;
  words: AsrWord[];
}

export interface OpenAIAsrConfig {
  apiKey: string;
  baseURL: string;
  model?: string;
  signal?: AbortSignal;
}

export interface QwenFileTranscriptionConfig {
  apiKey: string;
  baseURL: string;
  fileUrl: string;
  model?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface QwenTaskResponse {
  output?: {
    task_id?: string;
    task_status?: string;
    results?: Array<{ transcription_url?: string }>;
  };
  message?: string;
}

interface QwenTranscript {
  text?: string;
  sentences?: Array<{
    text?: string;
    words?: Array<{ text?: string; word?: string; begin_time?: number; end_time?: number }>;
  }>;
}

/** OpenAI Whisper transcription with word timestamps. */
export async function transcribeOpenAI(audio: Buffer, ext: string, cfg: OpenAIAsrConfig): Promise<AsrResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), `audio.${ext.replace(/^\./, "") || "wav"}`);
  form.append("model", cfg.model ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const url = `${cfg.baseURL.replace(/\/+$/, "")}/audio/transcriptions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: cfg.signal,
  });
  if (!res.ok) {
    throw new Error((await res.text().catch(() => "")) || `ASR HTTP ${res.status}`);
  }
  const data = (await res.json()) as { text?: string; words?: AsrWord[] };
  return {
    text: data.text ?? "",
    words: normalizeAsrWords(data.words ?? []),
  };
}

/** Qwen file transcription requires a reachable audio URL; local VS Code files should use another ASR path. */
export async function transcribeQwenFileUrl(cfg: QwenFileTranscriptionConfig): Promise<AsrResult> {
  const base = cfg.baseURL.replace(/\/+$/, "");
  const submit = await fetch(`${base}/api/v1/services/audio/asr/transcription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: cfg.model ?? "qwen3-asr-flash-filetrans",
      input: { file_urls: [cfg.fileUrl] },
      parameters: { enable_words: true },
    }),
    signal: cfg.signal,
  });
  if (!submit.ok) {
    throw new Error((await submit.text().catch(() => "")) || `Qwen ASR HTTP ${submit.status}`);
  }
  const task = (await submit.json()) as QwenTaskResponse;
  const taskId = task.output?.task_id;
  if (!taskId) throw new Error(task.message || "Qwen ASR did not return a task id.");

  const deadline = Date.now() + (cfg.timeoutMs ?? 120000);
  while (Date.now() < deadline) {
    await sleep(cfg.pollIntervalMs ?? 1000, cfg.signal);
    const poll = await fetch(`${base}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: cfg.signal,
    });
    if (!poll.ok) {
      throw new Error((await poll.text().catch(() => "")) || `Qwen ASR poll HTTP ${poll.status}`);
    }
    const state = (await poll.json()) as QwenTaskResponse;
    const status = state.output?.task_status;
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(state.message || `Qwen ASR task ${status.toLowerCase()}.`);
    }
    if (status === "SUCCEEDED") {
      const url = state.output?.results?.[0]?.transcription_url;
      if (!url) throw new Error("Qwen ASR did not return a transcription URL.");
      const transcript = await fetch(url, { signal: cfg.signal });
      if (!transcript.ok) {
        throw new Error((await transcript.text().catch(() => "")) || `Qwen transcript HTTP ${transcript.status}`);
      }
      return normalizeQwenTranscript((await transcript.json()) as QwenTranscript);
    }
  }

  throw new Error("Qwen ASR timed out.");
}

function normalizeQwenTranscript(data: QwenTranscript): AsrResult {
  const words: AsrWord[] = [];
  for (const sentence of data.sentences ?? []) {
    for (const word of sentence.words ?? []) {
      const text = word.word ?? word.text ?? "";
      const begin = typeof word.begin_time === "number" ? word.begin_time / 1000 : 0;
      const end = typeof word.end_time === "number" ? word.end_time / 1000 : begin;
      if (text.trim()) words.push({ word: text, start: begin, end });
    }
  }
  return {
    text: data.text ?? (data.sentences ?? []).map((sentence) => sentence.text).filter(Boolean).join(" "),
    words: normalizeAsrWords(words),
  };
}

function normalizeAsrWords(words: AsrWord[]): AsrWord[] {
  return words
    .map((word) => ({
      word: String(word.word ?? "").trim(),
      start: Number.isFinite(word.start) ? Math.max(0, word.start) : 0,
      end: Number.isFinite(word.end) ? Math.max(0, word.end) : 0,
    }))
    .filter((word) => word.word.length > 0)
    .map((word) => ({ ...word, end: Math.max(word.end, word.start) }));
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Qwen ASR aborted."));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Qwen ASR aborted."));
      },
      { once: true },
    );
  });
}
