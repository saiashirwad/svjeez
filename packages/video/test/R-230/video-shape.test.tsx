import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { renderVideo } from "@svjeez/video";
import { read, scene, slide } from "../helpers/video";

describe("renderVideo", () => {
  test("webm is one frame per 1/fps of the loop", async () => {
    const video = await renderVideo(slide, { format: "webm", fps: 12, colorScheme: "light" });

    expect(video).toMatchObject({ frames: 12, duration: 1 });
    expect(await read(video.bytes)).toMatchObject({
      width: 64,
      height: 48,
      packets: 12,
      duration: 1,
    });
  });

  test("loops and scale shape the video", async () => {
    const video = await renderVideo(slide, {
      format: "webm",
      codec: "vp8",
      fps: 10,
      loops: 3,
      scale: 2,
    });

    expect(video).toMatchObject({ frames: 30, duration: 3 });
    expect(await read(video.bytes)).toMatchObject({
      width: 128,
      height: 96,
      packets: 30,
      duration: 3,
    });
  });

  test("an odd-sized scene loses its last device pixel row and column, which H.264 can't encode", async () => {
    const video = await renderVideo(scene(65, 49), { fps: 6 });

    expect(await read(video.bytes)).toMatchObject({ codec: "avc", width: 64, height: 48 });
  });

  test("a scene with nothing animated has no video to make", async () => {
    const still = render(
      { width: 8, height: 8, duration: 1, title: "Still" },
      <rect width={8} height={8} />,
    );

    const error = await renderVideo(still, { format: "webm" }).catch((error: Error) => error);

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain(
      "renderVideo() needs an animated scene, got one whose loop lasts 0s.",
    );
  });
});
