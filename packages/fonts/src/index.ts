import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { font } from "svjeez";
import type { Font, FontFamily, FontOptions } from "svjeez/tools";

export type GoogleOptions = Omit<FontOptions, "family" | "weight" | "italic"> & {
  readonly weight?: number;
  readonly italic?: boolean;
};

const cacheDir = (): string => {
  const { SVJEEZ_FONTS_CACHE, XDG_CACHE_HOME } = process.env;

  if (SVJEEZ_FONTS_CACHE) return SVJEEZ_FONTS_CACHE;

  return join(XDG_CACHE_HOME || join(homedir(), ".cache"), "svjeez", "fonts");
};

const HEADERS = { "user-agent": "svjeez-fonts" };

const slug = (family: string): string => {
  const plain = family.replace(/[^A-Za-z0-9]+/g, "-");

  if (/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(family)) return plain;

  return `${plain}-${createHash("sha256").update(family).digest("hex").slice(0, 8)}`;
};

const isFont = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = view.getUint32(0);

  if (tag !== 0x00010000 && tag !== 0x74727565 && tag !== 0x4f54544f) return false;
  const tables = view.getUint16(4);

  if (bytes.length < 12 + 16 * tables) return false;

  for (let i = 0; i < tables; i++) {
    const at = 12 + 16 * i;

    if (view.getUint32(at + 8) + view.getUint32(at + 12) > bytes.length) return false;
  }

  return true;
};

const slant = (italic: boolean): string => (italic ? "italic" : "normal");

const cssUrl = (family: string, weight: number, italic: boolean): string => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  const axes = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;

  return `https://fonts.googleapis.com/css2?family=${name}:${axes}`;
};

const message = (page: string): string => {
  const title = /<title>([^<]*)<\/title>/.exec(page)?.[1];

  return (title ?? page.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200);
};

class GoogleError extends Error {}

const download = async (family: string, weight: number, italic: boolean): Promise<Uint8Array> => {
  const label = `${family} ${weight} ${slant(italic)}`;
  const css = await fetch(cssUrl(family, weight, italic), { headers: HEADERS });
  const text = await css.text();

  if (!css.ok)
    throw new GoogleError(
      `Google Fonts has no "${family}" at weight ${weight} (${slant(italic)}): HTTP ${css.status}, ${message(text)}`,
    );

  const url = /src:\s*url\(([^)]+)\)/.exec(text)?.[1];

  if (!url) throw new GoogleError(`Google Fonts answered for ${label} with no font file URL.`);

  const file = await fetch(url, { headers: HEADERS });

  if (!file.ok)
    throw new GoogleError(
      `Google Fonts could not serve the file for ${label}: HTTP ${file.status}.`,
    );

  return new Uint8Array(await file.arrayBuffer());
};

const pending = new Map<string, Promise<Uint8Array>>();

const bytesOf = (family: string, weight: number, italic: boolean): Promise<Uint8Array> => {
  const path = join(cacheDir(), `${slug(family)}-${weight}-${slant(italic)}.ttf`);
  let bytes = pending.get(path);

  if (!bytes) {
    bytes = load(path, family, weight, italic).finally(() => pending.delete(path));
    pending.set(path, bytes);
  }

  return bytes;
};

const load = async (
  path: string,
  family: string,
  weight: number,
  italic: boolean,
): Promise<Uint8Array> => {
  try {
    const cached = await readFile(path);

    if (isFont(cached)) return cached;
  } catch {}

  let bytes: Uint8Array;

  try {
    bytes = await download(family, weight, italic);
  } catch (error) {
    if (error instanceof GoogleError) throw error;

    throw new Error(
      `Could not load "${family}" ${weight} ${slant(italic)} from Google Fonts, and ${path} is not cached. Run once with a network connection.`,
      { cause: error },
    );
  }

  if (!isFont(bytes))
    throw new GoogleError(
      `Google Fonts answered for ${family} ${weight} ${slant(italic)} with a file that is not a font.`,
    );

  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, bytes);
  await rename(temp, path);

  return bytes;
};

export const google = Object.assign(
  async (family: string, options: GoogleOptions = {}): Promise<Font> => {
    const { weight = 400, italic = false, ...rest } = options;

    return font(await bytesOf(family, weight, italic), { ...rest, family, weight, italic });
  },
  {
    family: async (
      family: string,
      faces: readonly [GoogleOptions, ...GoogleOptions[]],
      options: GoogleOptions = {},
    ): Promise<FontFamily> => {
      const fonts = await Promise.all(faces.map((face) => google(family, { ...options, ...face })));

      // SAFETY: `faces` is a non-empty tuple and Promise.all keeps its length.
      return font.family(...(fonts as [Font, ...Font[]]));
    },
  },
);
