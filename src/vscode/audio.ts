export function audioExtension(data: Buffer): "mp3" | "wav" {
  if (data.length >= 3 && data.toString("ascii", 0, 3) === "ID3") return "mp3";
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "mp3";
  return "wav";
}
