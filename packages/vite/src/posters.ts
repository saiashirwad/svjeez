import { renderFrames } from "svjeez/frames";
import { assets } from "./assets.ts";
import { cached, closeBrowser, encode } from "@svjeez/og/render";

export type Scheme = "light" | "dark";

export interface PosterOptions {
  /** How much bigger than the scene's own size the poster is. 1 by default. Ignored when `widths` is given. */
  readonly scale?: number;
  /** Posters at each of these widths, in device pixels, for a `srcset`: a card that draws 600 wide takes a 600 and a 1200. */
  readonly widths?: readonly number[];
  readonly quality?: number;
  readonly background?: string;
}

assets.close = closeBrowser;

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

export const poster = (
  file: string,
  svg: string,
  scheme: Scheme,
  options: PosterOptions,
): Promise<Uint8Array> => cached(file, () => render(svg, scheme, options));
