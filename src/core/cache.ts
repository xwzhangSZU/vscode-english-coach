import { createHash } from "node:crypto";

export interface AudioKeyParts {
  text: string;
  provider: string;
  model: string;
  voice: string;
  instructions: string;
  format: string;
}

/** Stable content hash for the synthesized-audio cache. */
export function audioCacheKey(p: AudioKeyParts): string {
  return createHash("sha256")
    .update([p.text, p.provider, p.model, p.voice, p.instructions, p.format].join(" "))
    .digest("hex")
    .slice(0, 32);
}
