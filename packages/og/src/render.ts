import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderFrames } from "svjeez/frames";
import { isScene, svg as backend, type Scene } from "svjeez/tools";
import { closeBrowser, encode, type Format } from "./encode.ts";
import { settings } from "./settings.ts";

export { closeBrowser, encode, settings, type Format };

export type { RenderSettings } from "./settings.ts";

const LANES = 4;
let running = 0;
const queue: (() => void)[] = [];

const limited = async <T>(task: () => Promise<T>): Promise<T> => {
  if (running >= LANES) await new Promise<void>((resolve) => queue.push(resolve));
  running++;

  try {
    return await task();
  } finally {
    running--;
    queue.shift()?.();
  }
};

const pending = new Map<string, Promise<Uint8Array>>();

/** One render per file name: from the cache folder if it is there, else made in one of a few lanes and kept there. */
export const cached = (file: string, make: () => Promise<Uint8Array>): Promise<Uint8Array> => {
  let job = pending.get(file);

  if (!job) {
    const { cache } = settings;
    const path = cache && new URL(file, cache);

    job = (path ? readFile(path) : Promise.reject()).catch(() =>
      limited(async () => {
        const bytes = await make();

        if (cache && path) {
          await mkdir(cache, { recursive: true });
          await writeFile(path, bytes);
        }

        return bytes;
      }),
    );
    pending.set(file, job);
    job.catch(() => pending.delete(file));

    for (const old of pending.keys()) {
      if (pending.size <= (settings.limit ?? Infinity)) break;
      pending.delete(old);
    }
  }

  return job;
};

export interface RenderOptions {
  /** Where on the timeline to take the picture, in seconds. */
  readonly time?: number;
  readonly scheme?: "light" | "dark";
  readonly format?: Format;
  readonly quality?: number;
  readonly scale?: number;
}

export interface Rendered {
  readonly bytes: Uint8Array;
  /** The image's MIME type. */
  readonly type: string;
  readonly width: number;
  readonly height: number;
}

const MIME = { jpeg: "image/jpeg", webp: "image/webp" } as const satisfies Record<Format, string>;

const EXTENSION = { jpeg: "jpg", webp: "webp" } as const satisfies Record<Format, string>;

/** What a file for these options is called: the same scene and options always give the same name. */
export const imageName = (
  svg: string,
  { format = "jpeg", ...options }: RenderOptions = {},
): string =>
  `${createHash("sha256")
    .update(svg + JSON.stringify(options))
    .digest("base64url")
    .slice(0, 12)}.${EXTENSION[format]}`;

const sizeOf = (svg: string) => {
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);

  if (!box) throw new Error("A card needs a scene whose svg has a viewBox, found none.");

  return { width: Number(box[1]), height: Number(box[2]) };
};

/** A scene, or SVG markup, as an image: its first frame unless `time` says otherwise. Needs `playwright-core`. */
export const renderOg = async (
  source: Scene | string,
  options: RenderOptions = {},
): Promise<Rendered> => {
  const { time = 0, scheme = "light", format = "jpeg", quality = 0.9, scale = 1 } = options;
  const svg = isScene(source) ? backend.emit(source) : source;

  const bytes = await cached(imageName(svg, options), async () => {
    const { frames } = await renderFrames(svg, { times: [time], colorScheme: scheme, scale });

    return encode(frames[0]!.png, format, quality);
  });

  return { bytes, type: MIME[format], ...sizeOf(svg) };
};

/** When a scene is still: the moment it holds, else 72% in. Posters and `renderStill` take their picture here. */
export const stillTime = (svg: string, duration: number): number => {
  const held = /animation-delay:-([\d.]+)s!important/.exec(svg);

  return held ? Number(held[1]) : duration * 0.72;
};

export interface StillOptions {
  /** When to take the picture, in seconds. The scene's still moment by default. */
  readonly time?: number;
  readonly scheme?: "light" | "dark";
  /** How much bigger than the scene's own size the picture is. 2 by default, so it stays sharp when a card scales it. */
  readonly scale?: number;
  /** What shows behind the scene. Transparent by default, so it sits on whatever the card draws beneath it. */
  readonly background?: string;
}

/**
 * A scene, or SVG markup, as a PNG taken at its still moment (see `stillTime`) or at `time`: a picture of it to place inside a
 * card with `picture()`. Renders are cached like `renderOg`'s.
 */
export const renderStill = (
  source: Scene | string,
  { time, scheme = "light", scale = 2, background = "transparent" }: StillOptions = {},
): Promise<Uint8Array> => {
  const svg = isScene(source) ? backend.emit(source) : source;

  const name = `${createHash("sha256")
    .update(svg + JSON.stringify({ time, scheme, scale, background }))
    .digest("base64url")
    .slice(0, 12)}.png`;

  return cached(name, async () => {
    const { duration } = await renderFrames(svg, { times: [0], colorScheme: scheme });

    const { frames } = await renderFrames(svg, {
      times: [time ?? stillTime(svg, duration)],
      colorScheme: scheme,
      scale,
      background,
    });

    return frames[0]!.png;
  });
};

/** `renderOg` as a web-standard `Response`, for an Astro endpoint, a Next route handler or any fetch-style server. */
export const ogResponse = async (
  source: Scene | string,
  options: RenderOptions = {},
): Promise<Response> => {
  const { bytes, type } = await renderOg(source, options);

  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } });
};
