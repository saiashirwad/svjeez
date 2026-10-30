import { describe, expect, test } from "bun:test";
import { renderVideo } from "@svjeez/video";
import { slide } from "../helpers/video";

describe("renderVideo", () => {
  test("an mp4 can't be transparent", async () => {
    await expect(renderVideo(slide, { background: "transparent" })).rejects.toThrow(
      'renderVideo() can\'t keep a transparent background in mp4. Use format: "webm"',
    );
  });

  test("bad options are rejected by name", async () => {
    await expect(renderVideo(slide, { fps: 0 })).rejects.toThrow(
      "renderVideo() needs a positive, finite fps, got 0.",
    );
    await expect(renderVideo(slide, { loops: 1.5 })).rejects.toThrow("loops, got 1.5.");
    await expect(renderVideo(slide, { scale: 0 })).rejects.toThrow(
      "renderVideo() needs a positive, finite scale, got 0.",
    );
    // @ts-expect-error mp4 cannot hold VP8
    await expect(renderVideo(slide, { format: "mp4", codec: "vp8" })).rejects.toThrow(
      "renderVideo() needs a mp4 codec of avc, hevc, vp9, av1, got vp8.",
    );
  });
});
