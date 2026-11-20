import { mkdir, writeFile } from "node:fs/promises";

export interface Asset {
  readonly type: string;
  readonly bytes: () => Promise<Uint8Array>;
}

export interface Assets {
  readonly files: Map<string, Asset>;
  limit?: number;
  close?: () => Promise<void>;
}

export const ROUTE = "/_svjeez/";

const key = Symbol.for("svjeez.vite.assets");

// SAFETY: only this module writes the symbol, always with an Assets, so whatever is stored under it is one.
export const assets: Assets = ((globalThis as { [key]?: Assets })[key] ??= { files: new Map() });

export const register = (file: string, asset: Asset): void => {
  assets.files.delete(file);
  assets.files.set(file, asset);

  for (const old of assets.files.keys()) {
    if (assets.files.size <= (assets.limit ?? Infinity)) break;
    assets.files.delete(old);
  }
};

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
