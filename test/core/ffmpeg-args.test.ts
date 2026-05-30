import { describe, expect, it } from "vitest";
import { buildAvfoundationArgs } from "../../src/core/ffmpeg-args";

describe("buildAvfoundationArgs", () => {
  it("builds a mac avfoundation audio-only capture to a wav path", () => {
    expect(buildAvfoundationArgs(":default", "/tmp/take.wav")).toEqual([
      "-y",
      "-f",
      "avfoundation",
      "-i",
      ":default",
      "-ac",
      "1",
      "-ar",
      "16000",
      "/tmp/take.wav",
    ]);
  });
});
