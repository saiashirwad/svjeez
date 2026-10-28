import { describe, expect, test } from "bun:test";
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from "mediabunny";
import { motion, render } from "svjeez";
import { renderVideo } from "@svjeez/video";

const scene = (width: number, height: number) =>
  render(
    { width, height, duration: 1, title: "Slide" },
    <rect
      width={16}
      height={height}
      fill="#3EE6D6"
      animation={motion({ x: 0 }).to({ x: width - 16 }, 1)}
    />,
  );

const slide = scene(64, 48);

const read = async (bytes: Uint8Array) => {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();

  if (!track) throw new Error("the video has no video track");
  let alpha = 0;

  for await (const packet of new EncodedPacketSink(track).packets())
    if (packet.sideData.alpha && packet.sideData.alpha.byteLength > 0) alpha++;

  return {
    mime: await input.getMimeType(),
    codec: await track.getCodec(),
    width: await track.getDisplayWidth(),
    height: await track.getDisplayHeight(),
    packets: (await track.computePacketStats()).packetCount,
    duration: await input.computeDuration(),
    transparent: await track.canBeTransparent(),
    alpha,
  };
};

describe("renderVideo", () => {
  test("webm is VP9 by default, one frame per 1/fps of the loop", async () => {
    const video = await renderVideo(slide, { format: "webm", fps: 12, colorScheme: "light" });

    expect(video).toMatchObject({ mime: "video/webm", codec: "vp9", frames: 12, duration: 1 });
    expect(await read(video.bytes)).toMatchObject({
      mime: expect.stringContaining("video/webm"),
      codec: "vp9",
      width: 64,
      height: 48,
      packets: 12,
      duration: 1,
      transparent: false,
    });
  });

  test("loops, scale and codec shape the video", async () => {
    const video = await renderVideo(slide, {
      format: "webm",
      codec: "vp8",
      fps: 10,
      loops: 3,
      scale: 2,
    });

    expect(video).toMatchObject({ codec: "vp8", frames: 30, duration: 3 });
    expect(await read(video.bytes)).toMatchObject({
      codec: "vp8",
      width: 128,
      height: 96,
      packets: 30,
      duration: 3,
    });
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

  test("an odd-sized scene loses its last device pixel row and column, which H.264 can't encode", async () => {
    const video = await renderVideo(scene(65, 49), { fps: 6 });

    expect(await read(video.bytes)).toMatchObject({ codec: "avc", width: 64, height: 48 });
  });

  test("an mp4 can't be transparent", async () => {
    await expect(renderVideo(slide, { background: "transparent" })).rejects.toThrow(
      'renderVideo() can\'t keep a transparent background in mp4. Use format: "webm"',
    );
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
