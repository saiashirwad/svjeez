import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { font, type Font, type FontFamily, type FontOptions, type FontStyle } from "svjeez";

export type GoogleOptions = Omit<FontOptions, "family" | "weight" | "style"> & {
  /** Default 400. */
  readonly weight?: number;
  readonly style?: FontStyle;
};

export interface GoogleFace {
  readonly weight?: number;
  readonly style?: FontStyle;
}

/** The folder shared by every project on this machine: `$SVJEEZ_FONTS_CACHE`, `$XDG_CACHE_HOME/svjeez/fonts` or `~/.cache/svjeez/fonts`. */
export const cacheDir = (): string => {
  const { SVJEEZ_FONTS_CACHE, XDG_CACHE_HOME } = process.env;

  if (SVJEEZ_FONTS_CACHE) return SVJEEZ_FONTS_CACHE;

  return join(XDG_CACHE_HOME || join(homedir(), ".cache"), "svjeez", "fonts");
};

// Google serves WOFF2 to browsers and static TTF to a user agent it doesn't recognize. Fetch's own differs by runtime.
const HEADERS = { "user-agent": "svjeez-fonts" };

const isWeight = (face: number | GoogleFace): face is number => typeof face === "number";

/** Open Sans keeps its plain name. A family that needed other characters turned into dashes gets a hash of its exact name, so Open-Sans and Open_Sans don't share a file. */
const slug = (family: string): string => {
  const plain = family.replace(/[^A-Za-z0-9]+/g, "-");

  if (/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(family)) return plain;

  return `${plain}-${createHash("sha256").update(family).digest("hex").slice(0, 8)}`;
};

/** Whether `bytes` is a font file whose table directory fits inside it, which a torn write is not. */
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

const cssUrl = (family: string, weight: number, style: FontStyle): string => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  const axes = style === "italic" ? `ital,wght@1,${weight}` : `wght@${weight}`;

  return `https://fonts.googleapis.com/css2?family=${name}:${axes}`;
};

/** Google's error pages are HTML, and the `<title>` holds the message, such as "400: Font family not found". */
const message = (page: string): string => {
  const title = /<title>([^<]*)<\/title>/.exec(page)?.[1];

  return (title ?? page.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200);
};

/** Google answered, so the network works and retrying offline advice would mislead. */
class GoogleError extends Error {}

const download = async (family: string, weight: number, style: FontStyle): Promise<Uint8Array> => {
  const label = `${family} ${weight} ${style}`;
  const css = await fetch(cssUrl(family, weight, style), { headers: HEADERS });
  const text = await css.text();

  if (!css.ok)
    throw new GoogleError(
      `Google Fonts has no "${family}" at weight ${weight} (${style}): HTTP ${css.status}, ${message(text)}`,
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

// Scenes load their fonts side by side, so one process often asks for the same file twice before either lands.
const pending = new Map<string, Promise<Uint8Array>>();

const bytesOf = (family: string, weight: number, style: FontStyle): Promise<Uint8Array> => {
  const path = join(cacheDir(), `${slug(family)}-${weight}-${style}.ttf`);
  let bytes = pending.get(path);

  if (!bytes) {
    bytes = load(path, family, weight, style).finally(() => pending.delete(path));
    pending.set(path, bytes);
  }

  return bytes;
};

const load = async (
  path: string,
  family: string,
  weight: number,
  style: FontStyle,
): Promise<Uint8Array> => {
  try {
    const cached = await readFile(path);

    if (isFont(cached)) return cached;
    // A torn or corrupt file: fetch it again and write it over.
  } catch {
    // Cold cache: fall through to the network.
  }

  let bytes: Uint8Array;

  try {
    bytes = await download(family, weight, style);
  } catch (error) {
    if (error instanceof GoogleError) throw error;

    throw new Error(
      `Could not load "${family}" ${weight} ${style} from Google Fonts, and ${path} is not cached. Run once with a network connection.`,
      { cause: error },
    );
  }

  if (!isFont(bytes))
    throw new GoogleError(
      `Google Fonts answered for ${family} ${weight} ${style} with a file that is not a font.`,
    );

  // Rename is atomic, so a crashed or concurrent run never leaves a torn file where readFile looks.
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, bytes);
  await rename(temp, path);

  return bytes;
};

/**
 * Loads a Google Fonts family at one weight and style as a svjeez `Font`. The file is cached on disk, so only the first
 * run on a machine needs the network. Remaining options go to `font()`.
 */
export const google = Object.assign(
  async (family: string, options: GoogleOptions = {}): Promise<Font> => {
    const { weight = 400, style = "normal", ...rest } = options;

    return font(await bytesOf(family, weight, style), { ...rest, family, weight, style });
  },
  {
    /** Several weights and styles grouped under one family name. A number is a weight at normal style. */
    family: async (
      family: string,
      faces: readonly [number | GoogleFace, ...(number | GoogleFace)[]],
      options: Omit<GoogleOptions, "weight" | "style"> = {},
    ): Promise<FontFamily> => {
      const fonts = await Promise.all(
        faces.map((face) =>
          google(family, { ...options, ...(isWeight(face) ? { weight: face } : face) }),
        ),
      );

      // SAFETY: `faces` is a non-empty tuple and Promise.all keeps its length.
      return font.family(...(fonts as [Font, ...Font[]]));
    },
  },
);
