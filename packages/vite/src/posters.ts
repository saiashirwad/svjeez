import { cached, snapshot, stillTime } from "@svjeez/og/render";

export type Scheme = "light" | "dark";

export interface PosterOptions {
  /** How much bigger than the scene's own size the poster is. 1 by default. Ignored when `widths` is given. */
  readonly scale?: number;
  /** Posters at each of these widths, in device pixels, for a `srcset`: a card that draws 600 wide takes a 600 and a 1200. */
  readonly widths?: readonly number[];
  readonly quality?: number;
  readonly background?: string;
}

const render = (
  svg: string,
  scheme: Scheme,
  { scale = 1, quality = 0.8, background = "Canvas" }: PosterOptions,
) =>
  snapshot(
    svg,
    {
      colorScheme: scheme,
      scale,
      background,
      format: "webp",
      quality,
      at: (duration) => stillTime(svg, duration),
    },
    "poster()",
  );

export const poster = (
  file: string,
  svg: string,
  scheme: Scheme,
  options: PosterOptions,
): Promise<Uint8Array> => cached(file, () => render(svg, scheme, options));
