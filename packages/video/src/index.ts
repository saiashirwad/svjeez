import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type * as Mediabunny from "mediabunny";
import type { Seconds } from "svjeez/tools";
import { openScene, type ColorScheme, type SceneOptions } from "svjeez/frames";

const FORMATS = {
  mp4: { mime: "video/mp4", codecs: ["avc", "hevc", "vp9", "av1"], alpha: false },
  webm: { mime: "video/webm", codecs: ["vp9", "vp8", "av1"], alpha: true },
} as const;

export type VideoFormat = keyof typeof FORMATS;

export type VideoCodec<F extends VideoFormat = VideoFormat> = (typeof FORMATS)[F]["codecs"][number];

const QUALITIES = { low: "QUALITY_LOW", medium: "QUALITY_MEDIUM", high: "QUALITY_HIGH" } as const;

export type VideoQuality = keyof typeof QUALITIES;

export type VideoOptions = SceneOptions & {
  readonly fps?: number;
  readonly loops?: number;
  readonly quality?: VideoQuality;
  /** How many browser tabs capture frames in parallel. More is faster and uses more memory. Default 4. */
  readonly workers?: number;
} & (
    | { readonly format?: "mp4"; readonly codec?: VideoCodec<"mp4"> }
    | { readonly format: "webm"; readonly codec?: VideoCodec<"webm"> }
  );

export interface Video {
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly format: VideoFormat;
  readonly codec: VideoCodec;
  readonly playTime: Seconds;
  readonly frames: number;
  readonly colorScheme: ColorScheme;
}

const isFormat = (format: string): format is VideoFormat => Object.hasOwn(FORMATS, format);

const isQuality = (quality: string): quality is VideoQuality => Object.hasOwn(QUALITIES, quality);

const allows = (format: VideoFormat, codec: string): codec is VideoCodec =>
  FORMATS[format].codecs.some((allowed) => allowed === codec);

const BUNDLE = join(
  dirname(createRequire(import.meta.url).resolve("mediabunny")),
  "mediabunny.min.cjs",
);

type Page = typeof globalThis & {
  Mediabunny: typeof Mediabunny;
  svjeezVideo: {
    output: Mediabunny.Output<Mediabunny.OutputFormat, Mediabunny.BufferTarget>;
    source: Mediabunny.VideoSampleSource;
  };
};

export const video = async (svg: string, options: VideoOptions = {}): Promise<Video> => {
  const format = options.format ?? "mp4";

  if (!isFormat(format)) throw new Error(`video() needs a format of mp4 or webm, got ${format}.`);
  const { mime, codecs, alpha } = FORMATS[format];
  const codec = options.codec ?? codecs[0];

  if (!allows(format, codec))
    throw new Error(`video() needs a ${format} codec of ${codecs.join(", ")}, got ${codec}.`);
  const fps = options.fps ?? 30;

  if (!(fps > 0 && Number.isFinite(fps)))
    throw new Error(`video() needs a positive, finite fps, got ${fps}.`);
  const loops = options.loops ?? 1;

  if (!(Number.isInteger(loops) && loops > 0))
    throw new Error(`video() needs a positive whole number of loops, got ${loops}.`);
  const quality = options.quality ?? "high";

  if (!isQuality(quality))
    throw new Error(`video() needs a quality of low, medium or high, got ${quality}.`);
  const workers = options.workers ?? 4;

  if (!(Number.isInteger(workers) && workers > 0))
    throw new Error(`video() needs a positive whole number of workers, got ${workers}.`);
  const transparent = options.background === "transparent";

  if (transparent && !alpha)
    throw new Error(
      `video() can't keep a transparent background in ${format}. Use format: "webm", or pass a background color.`,
    );

  const scene = await openScene(svg, { ...options, pages: workers }, "video()");

  try {
    if (!(scene.duration > 0))
      throw new Error(
        "video() needs an animated scene, got one whose loop lasts 0s. Use renderFrames() for a still.",
      );
    const { playbackRate } = scene;
    const frames = Math.max(1, Math.round((scene.duration / playbackRate) * loops * fps));
    await scene.addScript(BUNDLE);
    const encoding = transparent ? "fast-png" : "jpeg";
    const type = transparent ? "image/png" : "image/jpeg";
    const first = await scene.capture(0, encoding);

    const measured = await scene.evaluate(
      async (url) => {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const { width, height } = bitmap;
        bitmap.close();

        return { width, height };
      },
      `data:${type};base64,${Buffer.from(first).toString("base64")}`,
    );

    const width = measured.width & ~1;
    const height = measured.height & ~1;

    const supported = await scene.evaluate(
      ({ codec, width, height, fps, quality, transparent }) => {
        // SAFETY: runs in the page after addScript() loaded the bundle that defines Mediabunny.
        const M = (globalThis as Page).Mediabunny;

        return M.canEncodeVideo(codec, {
          width,
          height,
          frameRate: fps,
          quality: M[quality],
          alpha: transparent ? "keep" : "discard",
        });
      },
      { codec, width, height, fps, quality: QUALITIES[quality], transparent },
    );

    if (!supported)
      throw new Error(
        `video() needs a Chromium that can encode ${codec} at ${width} by ${height}, and this one can't. Try another codec or format: "webm", or pass executablePath to Google Chrome.`,
      );

    await scene.evaluate(
      async ({ format, codec, fps, quality, transparent }) => {
        // SAFETY: runs in the page after addScript() loaded the bundle that defines Mediabunny.
        const page = globalThis as Page;
        const M = page.Mediabunny;

        const output = new M.Output({
          format: format === "mp4" ? new M.Mp4OutputFormat() : new M.WebMOutputFormat(),
          target: new M.BufferTarget(),
        });

        const source = new M.VideoSampleSource({
          codec,
          quality: M[quality],
          alpha: transparent ? "keep" : "discard",
        });

        output.addVideoTrack(source, { frameRate: fps });
        await output.start();
        page.svjeezVideo = { output, source };
      },
      { format, codec, fps, quality: QUALITIES[quality], transparent },
    );

    // Captures run ahead of the encoder, which still takes the frames in order.
    const pending: Promise<Uint8Array>[] = [];
    let next = 0;

    for (let i = 0; i < frames; i++) {
      for (; next < frames && next < i + workers * 2; next++) {
        const shot =
          next === 0
            ? Promise.resolve(first)
            : scene.capture(((next / fps) * playbackRate) % scene.duration, encoding);

        // A shot that fails before its turn is reported when it is awaited, not as unhandled.
        shot.catch(() => {});
        pending.push(shot);
      }

      const shot = await pending.shift()!;

      await scene.evaluate(
        async ({ shot, type, i, fps, width, height }) => {
          // SAFETY: runs in the page after the call above stored svjeezVideo.
          const page = globalThis as Page;
          const blob = await (await fetch(`data:${type};base64,${shot}`)).blob();
          const bitmap = await createImageBitmap(blob, 0, 0, width, height);

          const sample = new page.Mediabunny.VideoSample(bitmap, {
            timestamp: i / fps,
            duration: 1 / fps,
          });

          await page.svjeezVideo.source.add(sample);
          sample.close();
          bitmap.close();
        },
        { shot: Buffer.from(shot).toString("base64"), type, i, fps, width, height },
      );
    }

    const bytes = await scene.evaluate(async () => {
      // SAFETY: runs in the page after the encoder was stored as svjeezVideo.
      const { output } = (globalThis as Page).svjeezVideo;
      await output.finalize();
      // SAFETY: finalize() has resolved, and a BufferTarget holds the whole file from then on.
      const bytes = new Uint8Array(output.target.buffer!);
      let binary = "";

      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

      return btoa(binary);
    }, undefined);

    return {
      bytes: new Uint8Array(Buffer.from(bytes, "base64")),
      mime,
      format,
      codec,
      playTime: frames / fps,
      frames,
      colorScheme: scene.colorScheme,
    };
  } finally {
    await scene.close();
  }
};
