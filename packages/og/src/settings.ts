import type { Format } from "./encode.ts";

/** A custom rasterizer for `renderOg`, e.g. `resvg` or `sharp`, to replace headless Chromium. */
export type Rasterizer = (
  svg: string,
  options: {
    readonly time: number;
    readonly scheme: "light" | "dark";
    readonly scale: number;
    readonly format: Format;
    readonly quality: number;
  },
) => Promise<Uint8Array>;

export interface RenderSettings {
  /** A folder (a `file:` URL ending in `/`) where finished images are kept between runs. */
  cache?: URL;
  /** Past this many renders in memory, the oldest are forgotten: a dev server's bound. A build has none. */
  limit?: number;
  /** Default rasterizer for `renderOg`. Uses headless Chromium when unset. */
  render?: Rasterizer;
}

const key = Symbol.for("svjeez.og.render");

// SAFETY: only this module writes the symbol, always with settings, so whatever is stored under it is one. A global,
export const settings: RenderSettings = ((globalThis as { [key]?: RenderSettings })[key] ??= {});
