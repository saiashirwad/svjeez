// Apart from render.ts, which imports the library, so a bundler's plugin can set these before it can resolve it.

export interface RenderSettings {
  /** A folder (a `file:` URL ending in `/`) where finished images are kept between runs. */
  cache?: URL;
  /** Past this many renders in memory, the oldest are forgotten: a dev server's bound. A build has none. */
  limit?: number;
}

const key = Symbol.for("svjeez.og.render");

// SAFETY: only this module writes the symbol, always with settings, so whatever is stored under it is one. A global,
// since a bundler may load this module once for its plugin and once for the server code it runs.
export const settings: RenderSettings = ((globalThis as { [key]?: RenderSettings })[key] ??= {});
