import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderFrames } from "svjeez/frames";
import { assets } from "./assets.ts";
import { close, encode } from "./encode.ts";

export type Scheme = "light" | "dark";

export interface PosterOptions {
  readonly scale?: number;
  readonly quality?: number;
  readonly background?: string;
}

assets.close = close;

const stillAt = (svg: string, duration: number) => {
  const held = /animation-delay:-([\d.]+)s!important/.exec(svg);

  return held ? Number(held[1]) : duration * 0.72;
};

const render = async (
  svg: string,
  scheme: Scheme,
  { scale = 1, quality = 0.8, background = "Canvas" }: PosterOptions,
) => {
  const { duration } = await renderFrames(svg, { times: [0], colorScheme: scheme });

  const { frames } = await renderFrames(svg, {
    times: [stillAt(svg, duration)],
    colorScheme: scheme,
    scale,
    background,
  });

  return encode(frames[0]!.png, "webp", quality);
};

const LANES = 4;
let running = 0;
const queue: (() => void)[] = [];

const limit = async <T>(task: () => Promise<T>): Promise<T> => {
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

export const poster = (
  file: string,
  svg: string,
  scheme: Scheme,
  options: PosterOptions,
): Promise<Uint8Array> => {
  let job = pending.get(file);

  if (!job) {
    const cached = assets.cache && new URL(file, assets.cache);
    job = (cached ? readFile(cached) : Promise.reject()).catch(() =>
      limit(async () => {
        const bytes = await render(svg, scheme, options);

        if (assets.cache && cached) {
          await mkdir(assets.cache, { recursive: true });
          await writeFile(cached, bytes);
        }

        return bytes;
      }),
    );
    pending.set(file, job);
    job.catch(() => pending.delete(file));

    for (const old of pending.keys()) {
      if (pending.size <= (assets.limit ?? Infinity)) break;
      pending.delete(old);
    }
  }

  return job;
};
