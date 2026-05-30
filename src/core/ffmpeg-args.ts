/** ffmpeg args for a mono 16 kHz WAV capture from a macOS avfoundation audio device. */
export function buildAvfoundationArgs(inputDevice: string, outPath: string): string[] {
  return ["-y", "-f", "avfoundation", "-i", inputDevice, "-ac", "1", "-ar", "16000", outPath];
}
