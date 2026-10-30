import { describe, expect, test } from "bun:test";
import { renderVideo } from "@svjeez/video";
import { read, slide } from "../helpers/video";

describe("renderVideo", () => {
  test("webm is VP9 by default", async () => {
    const video = await renderVideo(slide, { format: "webm", fps: 12, colorScheme: "light" });

    expect(video).toMatchObject({ mime: "video/webm", codec: "vp9" });
    expect(await read(video.bytes)).toMatchObject({
      mime: expect.stringContaining("video/webm"),
      codec: "vp9",
      transparent: false,
    });
  });

  test("codec shapes the video", async () => {
    const video = await renderVideo(slide, {
      format: "webm",
      codec: "vp8",
      fps: 10,
      loops: 3,
      scale: 2,
    });

    expect(video).toMatchObject({ codec: "vp8" });
    expect(await read(video.bytes)).toMatchObject({ codec: "vp8" });
  });

  test("a transparent background keeps alpha in webm", async () => {
    const video = await renderVideo(slide, { format: "webm", fps: 6, background: "transparent" });

    expect(await read(video.bytes)).toMatchObject({ transparent: true, alpha: 6, packets: 6 });
  });

  test("mp4 is H.264 by default", async () => {
    const video = await renderVideo(slide, { fps: 12 });

    expect(video).toMatchObject({ mime: "video/mp4", codec: "avc", frames: 12 });
    expect(await read(video.bytes)).toMatchObject({
      mime: expect.stringContaining("video/mp4"),
      codec: "avc",
      width: 64,
      height: 48,
      packets: 12,
      duration: 1,
    });
  });
});
