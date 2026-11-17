import { font, type Font, type FontFamily, type FontOptions, type FontStyle } from "svjeez";

export type GoogleOptions = Omit<FontOptions, "family" | "weight" | "style"> & {
  /** Default 400. */
  readonly weight?: number;
  readonly style?: FontStyle;
};

type Disk = typeof import("node:fs/promises") &
  typeof import("node:path") &
  Pick<typeof import("node:crypto"), "createHash"> &
  Pick<typeof import("node:os"), "homedir">;

const loadDisk = async (): Promise<Disk | undefined> => {
  try {
    const [crypto, fs, os, path] = await Promise.all([
      import("node:crypto"),
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
    ]);

    return { ...path, ...fs, createHash: crypto.createHash, homedir: os.homedir };
  } catch {}
};

let disk: Promise<Disk | undefined> | undefined;

const memory = new Map<string, Uint8Array>();

const cacheDir = ({ homedir, join }: Disk): string => {
  const { SVJEEZ_FONTS_CACHE, XDG_CACHE_HOME } = process.env;

  if (SVJEEZ_FONTS_CACHE) return SVJEEZ_FONTS_CACHE;

  return join(XDG_CACHE_HOME || join(homedir(), ".cache"), "svjeez", "fonts");
};

// Google serves WOFF2 to browsers and static TTF to a user agent it doesn't recognize.
const HEADERS = { "user-agent": "svjeez-fonts" };

const slug = ({ createHash }: Disk, family: string): string => {
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

const cssUrl = (family: string, weight: number, style: FontStyle): string => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  const axes = style === "italic" ? `ital,wght@1,${weight}` : `wght@${weight}`;

  return `https://fonts.googleapis.com/css2?family=${name}:${axes}`;
};

const message = (page: string): string => {
  const title = /<title>([^<]*)<\/title>/.exec(page)?.[1];

  return (title ?? page.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200);
};

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

const pending = new Map<string, Promise<Uint8Array>>();

const bytesOf = async (family: string, weight: number, style: FontStyle): Promise<Uint8Array> => {
  disk ??= loadDisk();

  const files = await disk;

  const key = files
    ? files.join(cacheDir(files), `${slug(files, family)}-${weight}-${style}.ttf`)
    : `${family} ${weight} ${style}`;

  let bytes = pending.get(key);

  if (!bytes) {
    bytes = load(files, key, family, weight, style).finally(() => pending.delete(key));
    pending.set(key, bytes);
  }

  return bytes;
};

const load = async (
  files: Disk | undefined,
  key: string,
  family: string,
  weight: number,
  style: FontStyle,
): Promise<Uint8Array> => {
  const known = memory.get(key);

  if (known) return known;

  if (files)
    try {
      const cached = await files.readFile(key);

      if (isFont(cached)) return cached;
    } catch {}

  let bytes: Uint8Array;

  try {
    bytes = await download(family, weight, style);
  } catch (error) {
    if (error instanceof GoogleError) throw error;

    throw new Error(
      files
        ? `Could not load "${family}" ${weight} ${style} from Google Fonts, and ${key} is not cached. Run once with a network connection.`
        : `Could not load "${family}" ${weight} ${style} from Google Fonts.`,
      { cause: error },
    );
  }

  if (!isFont(bytes))
    throw new GoogleError(
      `Google Fonts answered for ${family} ${weight} ${style} with a file that is not a font.`,
    );

  if (!files) {
    memory.set(key, bytes);

    return bytes;
  }

  const temp = `${key}.${process.pid}.${Date.now()}.tmp`;

  await files.mkdir(files.dirname(key), { recursive: true });
  await files.writeFile(temp, bytes);
  await files.rename(temp, key);

  return bytes;
};

/**
 * Loads a Google Fonts family at one weight and style as a svjeez `Font`. The file is cached on disk, so only the first
 * run on a machine needs the network. Where there is no file system, as in a Worker, the font is fetched once per
 * isolate and kept in memory. Remaining options go to `font()`.
 */
export const google = Object.assign(
  async (family: string, options: GoogleOptions = {}): Promise<Font> => {
    const { weight = 400, style = "normal", ...rest } = options;

    return font(await bytesOf(family, weight, style), { ...rest, family, weight, style });
  },
  {
    /**
     * Several weights and styles under one family name. `faces` lists them, each with the options `google()` takes;
     * `options` applies to every face and a face's own win. The first face's `fallback` is the family's.
     */
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
