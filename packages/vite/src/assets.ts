import { mkdir, writeFile } from "node:fs/promises";

// The files getScene() hands out URLs for. Scenes fill it as they compile, and the dev server and the build read it.
// It lives on globalThis because the plugin and the pages that call getScene() load this module through different module graphs.
// Each file carries its own way to make its bytes, so a poster renders only when something asks for it.

export interface Asset {
  readonly type: string;
  readonly bytes: () => Promise<Uint8Array>;
}

export interface Assets {
  readonly files: Map<string, Asset>;
  /** Where rendered posters are kept between runs. The plugin sets it. */
  cache?: URL;
  /** Releases what rendering held open, such as a browser. */
  close?: () => Promise<void>;
}

export const ROUTE = "/_svjeez/";

const key = Symbol.for("svjeez.vite.assets");
export const assets: Assets = ((globalThis as { [key]?: Assets })[key] ??= { files: new Map() });

/** Writes every file getScene() handed out a URL for under `dir`, at the path of its URL, and returns how many it wrote. */
export const writeScenes = async (dir: URL): Promise<number> => {
  const out = new URL(ROUTE.slice(1), dir);
  await mkdir(out, { recursive: true });
  await Promise.all(
    [...assets.files].map(async ([file, asset]) =>
      writeFile(new URL(file, out), await asset.bytes()),
    ),
  );
  await assets.close?.();

  return assets.files.size;
};
