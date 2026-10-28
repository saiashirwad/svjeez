// The files getScene() hands out URLs for. Pages fill it while they render, and the dev server and the build read it.
// It lives on globalThis because the pages and the integration load this module through different module graphs.
// Each file carries its own way to make its bytes, so poster rendering runs in the pages' graph, where Chromium loads.

export interface Asset {
  readonly type: string;
  readonly bytes: () => Promise<Uint8Array>;
}

export interface Assets {
  readonly files: Map<string, Asset>;
  /** Where rendered posters are kept between runs. The integration sets it. */
  cache?: URL;
  /** Releases what rendering held open, such as a browser. */
  close?: () => Promise<void>;
}

export const ROUTE = "/_svjeez/";

const key = Symbol.for("svjeez.astro.assets");
export const assets: Assets = ((globalThis as { [key]?: Assets })[key] ??= { files: new Map() });
