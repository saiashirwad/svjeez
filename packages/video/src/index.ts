import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type * as Mediabunny from "mediabunny";
import type { Seconds } from "svjeez";
import { openScene, type ColorScheme, type SceneOptions } from "svjeez/frames";

/** Each container, the codecs it can hold, in order of preference, and whether it can carry alpha. */
const FORMATS = {
  mp4: { mime: "video/mp4", codecs: ["avc", "hevc", "vp9", "av1"], alpha: false },
  webm: { mime: "video/webm", codecs: ["vp9", "vp8", "av1"], alpha: true },
} as const;

export type VideoFormat = keyof typeof FORMATS;

export type VideoCodec<F extends VideoFormat = VideoFormat> = (typeof FORMATS)[F]["codecs"][number];

const QUALITIES = { low: "QUALITY_LOW", medium: "QUALITY_MEDIUM", high: "QUALITY_HIGH" } as const;

export type VideoQuality = keyof typeof QUALITIES;

export type VideoOptions = Omit<SceneOptions, "background"> & {
  /** Frames per second. Default 30. */
  readonly fps?: number;
  /** How many times to play the scene's loop. Default 1. */
  readonly loops?: number;
  /** Bitrate for the frame size and rate. Default "high". */
  readonly quality?: VideoQuality;
  /** CSS background behind the SVG. Default `Canvas`. "transparent" keeps alpha, in WebM only. */
  readonly background?: string;
} & (
    | { readonly format?: "mp4"; readonly codec?: VideoCodec<"mp4"> }
    | { readonly format: "webm"; readonly codec?: VideoCodec<"webm"> }
  );

export interface Video {
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly format: VideoFormat;
  readonly codec: VideoCodec;
  /** Playback length: `frames / fps`. */
  readonly duration: Seconds;
  readonly frames: number;
  /** The scheme the video was rendered in, after resolving "system". */
  readonly colorScheme: ColorScheme;
}

const isFormat = (format: string): format is VideoFormat => Object.hasOwn(FORMATS, format);

const isQuality = (quality: string): quality is VideoQuality => Object.hasOwn(QUALITIES, quality);

const allows = (format: VideoFormat, codec: string): codec is VideoCodec =>
  FORMATS[format].codecs.some((allowed) => allowed === codec);

// mediabunny exports only ".", so its browser bundle is found next to the file "." resolves to.
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

/** Encode one loop, or several, of an SVG's animation as a video, in headless Chromium. Needs `playwright-core`. */
export const renderVideo = async (svg: string, options: VideoOptions = {}): Promise<Video> => {
  const format = options.format ?? "mp4";

  if (!isFormat(format))
    throw new Error(`renderVideo() needs a format of mp4 or webm, got ${format}.`);
  const { mime, codecs, alpha } = FORMATS[format];
  const codec = options.codec ?? codecs[0];

  if (!allows(format, codec))
    throw new Error(`renderVideo() needs a ${format} codec of ${codecs.join(", ")}, got ${codec}.`);
  const fps = options.fps ?? 30;

  if (!(fps > 0 && Number.isFinite(fps)))
    throw new Error(`renderVideo() needs a positive, finite fps, got ${fps}.`);
  const loops = options.loops ?? 1;

  if (!(Number.isInteger(loops) && loops > 0))
    throw new Error(`renderVideo() needs a positive whole number of loops, got ${loops}.`);
  const quality = options.quality ?? "high";

  if (!isQuality(quality))
    throw new Error(`renderVideo() needs a quality of low, medium or high, got ${quality}.`);
  const transparent = options.background === "transparent";

  if (transparent && !alpha)
    throw new Error(
      `renderVideo() can't keep a transparent background in ${format}. Use format: "webm", or pass a background color.`,
    );

  const scene = await openScene(svg, options, "renderVideo()");

  try {
    if (!(scene.duration > 0))
      throw new Error(
        "renderVideo() needs an animated scene, got one whose loop lasts 0s. Use renderFrames() for a still.",
      );
    const frames = Math.max(1, Math.round(scene.duration * loops * fps));
    await scene.addScript(BUNDLE);
    const first = await scene.capture(0);
    const view = new DataView(first.buffer, first.byteOffset);
    // 4:2:0 chroma covers pixels in pairs, so H.264 rejects an odd side and players mishandle one.
    // Dropping the last row or column costs one device pixel at the edge.
    const width = view.getUint32(16) & ~1;
    const height = view.getUint32(20) & ~1;

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
        `renderVideo() needs a Chromium that can encode ${codec} at ${width} by ${height}, and this one can't. Try another codec or format: "webm", or pass executablePath to Google Chrome.`,
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

    for (let i = 0; i < frames; i++) {
      const png = i === 0 ? first : await scene.capture((i / fps) % scene.duration);

      await scene.evaluate(
        async ({ png, i, fps, width, height }) => {
          // SAFETY: runs in the page after the call above stored svjeezVideo.
          const page = globalThis as Page;
          const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
          const bitmap = await createImageBitmap(blob, 0, 0, width, height);

          const sample = new page.Mediabunny.VideoSample(bitmap, {
            timestamp: i / fps,
            duration: 1 / fps,
          });

          await page.svjeezVideo.source.add(sample);
          sample.close();
          bitmap.close();
        },
        { png: Buffer.from(png).toString("base64"), i, fps, width, height },
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
      duration: frames / fps,
      frames,
      colorScheme: scene.colorScheme,
    };
  } finally {
    await scene.close();
  }
};
