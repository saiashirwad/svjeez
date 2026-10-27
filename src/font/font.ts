import { contours, pathData } from "./glyf";
import { shaper, type Shaper } from "./shape";
import { subset } from "./subset";
import { isFixedPitch, isItalic, metrics, name, sfnt, SFNT_CFF, SFNT_TRUETYPE, weightOf, type Metrics, type Sfnt } from "./sfnt";

export type FontFormat = "ttf" | "otf" | "woff" | "woff2";
export type FontStyle = "normal" | "italic";
export type { Metrics as FontMetrics };

export interface FontOptions {
  /** The CSS family name. Default: read from the file, or a name derived from the bytes for WOFF and WOFF2. */
  readonly family?: string;
  /** Default: read from the file (OS/2 usWeightClass), else 400. */
  readonly weight?: number;
  readonly style?: FontStyle;
  /** Generic or installed families to fall back to. Default `monospace` for a fixed-pitch font, else `sans-serif`. */
  readonly fallback?: readonly string[];
  /**
   * Embed only the glyphs the scene's text uses. Default true. Applies to TrueType outlines (most .ttf files); OTF with
   * CFF outlines, WOFF and WOFF2 embed whole. Turn it off if text is changed after rendering.
   */
  readonly subset?: boolean;
}

export interface PathOptions {
  /** Font size in px. */
  readonly size: number;
  /** Where the first glyph's origin lands: the left end of the baseline. Default 0, 0. */
  readonly x?: number;
  readonly y?: number;
}

export interface GlyphPath {
  /** The text this glyph draws: one character, or several for a ligature. */
  readonly char: string;
  /** Path data in scene coordinates. Empty for a space. */
  readonly d: string;
  /** Left edge of the glyph's advance box. */
  readonly x: number;
  readonly advance: number;
}

export interface TextPath {
  /** Every glyph in one path. */
  readonly d: string;
  readonly width: number;
  readonly glyphs: readonly GlyphPath[];
}

interface Format {
  readonly mime: string;
  readonly css: string;
  readonly matches: (tag: number) => boolean;
}

const tag = (text: string): number => [...text].reduce((n, char) => n * 256 + char.charCodeAt(0), 0);

const FORMATS: Readonly<Record<FontFormat, Format>> = {
  ttf: { mime: "font/ttf", css: "truetype", matches: (t) => t === SFNT_TRUETYPE || t === tag("true") },
  otf: { mime: "font/otf", css: "opentype", matches: (t) => t === SFNT_CFF },
  woff: { mime: "font/woff", css: "woff", matches: (t) => t === tag("wOFF") },
  woff2: { mime: "font/woff2", css: "woff2", matches: (t) => t === tag("wOF2") },
};

const base64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";
  for (let at = 0; at < bytes.length; at += CHUNK) binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  return btoa(binary);
};

/** FNV-1a, to name a WOFF font whose name table is compressed. */
const hash = (bytes: Uint8Array): string => {
  let h = 0x811c9dc5;
  for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193);
  return (h >>> 0).toString(36);
};

/** A font file, embedded as a data URI. Pass it as `fontFamily`, measure text with it, or draw text as paths. */
export class Font {
  readonly #sfnt: Sfnt | undefined;
  readonly #bytes: Uint8Array;
  #shaper: Shaper | undefined;
  readonly #embeds = new Map<string, `data:${string}`>();
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;
  readonly fallback: readonly string[];
  /** Whether embedding cuts the font down to the glyphs a scene uses. See `FontOptions.subset`. */
  readonly subset: boolean;
  readonly format: FontFormat;
  readonly href: `data:${string}`;
  /** Length of `href`, which is what the output pays each time the font is embedded. */
  readonly bytes: number;

  constructor(bytes: Uint8Array, format: FontFormat, options: FontOptions) {
    const readable = format === "ttf" || format === "otf" ? sfnt(bytes) : undefined;
    this.#sfnt = readable;
    this.#bytes = bytes;
    this.subset = options.subset ?? true;
    this.format = format;
    this.family = options.family ?? (readable && name(readable, 16, 1)) ?? `font-${hash(bytes)}`;
    this.weight = options.weight ?? (readable ? weightOf(readable) : 400);
    this.style = options.style ?? (readable && isItalic(readable) ? "italic" : "normal");
    this.fallback = options.fallback ?? [readable && isFixedPitch(readable) ? "monospace" : "sans-serif"];
    this.href = `data:${FORMATS[format].mime};base64,${base64(bytes)}`;
    this.bytes = this.href.length;
    if (!(this.weight >= 1 && this.weight <= 1000)) throw new Error(`Font weight must be between 1 and 1000, got ${this.weight}.`);
  }

  #readable(what: string): Sfnt {
    if (!this.#sfnt) throw new Error(`${what} needs the TTF or OTF file. A ${this.format.toUpperCase()} font embeds, but its tables are compressed.`);
    return this.#sfnt;
  }

  #shape(text: string, what: string) {
    this.#shaper ??= shaper(this.#readable(what));
    return this.#shaper.shape(text);
  }

  /**
   * The data URI to embed for a scene whose text is `texts`: cut down to their glyphs when the font allows it, else
   * the whole file. Each distinct text set is cut once.
   */
  embed(texts: readonly string[]): `data:${string}` {
    const font = this.#sfnt;
    if (!font || !this.subset || font.tables.get("glyf") === undefined) return this.href;
    const key = [...new Set(texts.flatMap((text) => [...text]))].sort().join("") + "\u0000" + texts.join("\u0000");
    let href = this.#embeds.get(key);
    if (!href) {
      this.#shaper ??= shaper(font);
      const shaped = this.#shaper;
      const cut = subset(this.#bytes, font, shaped, shaped.kern, texts);
      href = cut ? `data:font/ttf;base64,${base64(cut)}` : this.href;
      this.#embeds.set(key, href);
    }
    return href;
  }

  /** Ascent, descent, line gap, cap height and x-height in em. Multiply by the font size for px. */
  get metrics(): Metrics {
    return metrics(this.#readable("metrics"));
  }

  /** Whether the font has a glyph for this character. The browser draws a missing one from the fallback font. */
  has(char: string): boolean {
    this.#shaper ??= shaper(this.#readable("has()"));
    return this.#shaper.glyph(char) !== 0;
  }

  /** Advance width of one line of text in px, with ligatures and kerning as the browser applies them. */
  measure(text: string, size: number): number {
    const scale = size / this.metrics.unitsPerEm;
    return this.#shape(text, "measure()").reduce((width, glyph) => width + glyph.advance * scale, 0);
  }

  /** One line of text as outlines. Paths stay sharp at any zoom and can be animated glyph by glyph, but are not selectable text. */
  path(text: string, { size, x = 0, y = 0 }: PathOptions): TextPath {
    const font = this.#readable("path()");
    if (this.format === "otf") throw new Error("path() reads TrueType outlines. This OTF stores CFF outlines, which path() does not read yet.");
    if (!(size > 0) || !Number.isFinite(x + y)) throw new Error("path() needs a positive size and finite coordinates.");
    const scale = size / this.metrics.unitsPerEm;
    let pen = x;
    const glyphs = this.#shape(text, "path()").map((glyph): GlyphPath => {
      const placed = { char: glyph.chars, d: pathData(contours(font, glyph.glyph), scale, pen, y), x: pen, advance: glyph.advance * scale };
      pen += placed.advance;
      return placed;
    });
    return { d: glyphs.map((glyph) => glyph.d).join(""), width: pen - x, glyphs };
  }

  toString(): never {
    throw new Error("A font is not a string. Pass it as fontFamily={font}.");
  }
}

/** Faces of one family. The browser picks among them by `font-weight` and `font-style`. */
export class FontFamily {
  constructor(
    readonly name: string,
    readonly faces: readonly Font[],
    readonly fallback: readonly string[],
  ) {}

  /** The face the browser would pick: the matching style, then the weight by CSS font matching. */
  face(weight = 400, style: FontStyle = "normal"): Font {
    const styled = this.faces.filter((face) => face.style === style);
    const pool = styled.length > 0 ? styled : this.faces;
    const exact = pool.find((face) => face.weight === weight);
    if (exact) return exact;
    const lighter = pool.filter((face) => face.weight < weight).sort((a, b) => b.weight - a.weight);
    const heavier = pool.filter((face) => face.weight > weight).sort((a, b) => a.weight - b.weight);
    if (weight > 500) return heavier[0] ?? lighter[0]!;
    if (weight < 400) return lighter[0] ?? heavier[0]!;
    return heavier.find((face) => face.weight <= 500) ?? lighter[0] ?? heavier[0]!;
  }

  toString(): never {
    throw new Error("A font family is not a string. Pass it as fontFamily={family}.");
  }
}

export type FontValue = Font | FontFamily;

export const isFontValue = (value: unknown): value is FontValue => value instanceof Font || value instanceof FontFamily;

/** The face a measuring helper should use for regular text. */
export const regularFace = (value: FontValue): Font => (value instanceof Font ? value : value.face());

/** A CSS string. Control characters are hex-escaped, since a raw newline would end the string and start a rule. */
const cssString = (text: string): string =>
  `'${text.replace(/['\\]/g, "\\$&").replace(/[\u0000-\u001f\u007f]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `)}'`;

/** The faces a `fontFamily` value embeds, each under the family name it is used with, and the attribute value. */
export const fontFaces = (value: FontValue): { readonly family: string; readonly faces: readonly { readonly name: string; readonly font: Font }[] } => {
  const [name, faces, fallback] = value instanceof Font ? [value.family, [value], value.fallback] : [value.name, value.faces, value.fallback];
  return { family: [cssString(name), ...fallback].join(", "), faces: faces.map((font) => ({ name, font })) };
};

/** The `@font-face` rule for a face, embedding only what `texts` need when the font can be cut down. */
export const fontFaceRule = (name: string, font: Font, texts: readonly string[] = []): string =>
  `@font-face{font-family:${cssString(name)};src:url(${font.embed(texts)}) format('${FORMATS[font.format].css}');font-weight:${font.weight};font-style:${font.style}}`;

const SUPPORTED = Object.keys(FORMATS).join(", ");

/**
 * Embed a font. The format comes from the bytes, never the file extension. Pure and synchronous.
 * See `font.load` for files and URLs, and `font.family` to group weights and styles under one name.
 */
export const font = Object.assign(
  (source: Uint8Array | ArrayBuffer, options: FontOptions = {}): Font => {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    if (bytes.length < 12) throw new Error("This font is empty or truncated.");
    const signature = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (signature === tag("ttcf")) throw new Error("This is a font collection (.ttc). Extract one face to a .ttf or .otf and load that.");
    const format = (Object.keys(FORMATS) as FontFormat[]).find((key) => FORMATS[key].matches(signature));
    if (!format) throw new Error(`Unknown font format. font() reads ${SUPPORTED}.`);
    return new Font(bytes, format, options);
  },
  {
    /** Read an http(s) URL with fetch, or a path or file: URL from disk. */
    load: async (source: string | URL, options: FontOptions = {}): Promise<Font> => {
      const url = source instanceof URL ? source : /^[a-z][a-z0-9+.-]*:\/\//i.test(source) ? new URL(source) : undefined;
      if (url?.protocol === "http:" || url?.protocol === "https:") {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`.trim());
        return font(await response.arrayBuffer(), options);
      }
      const { readFile } = await import("node:fs/promises");
      if (!url) return font(await readFile(source as string), options);
      if (url.protocol !== "file:") throw new Error(`Cannot load ${url}. Use an http(s) or file: URL, or a path.`);
      const { fileURLToPath } = await import("node:url");
      return font(await readFile(fileURLToPath(url)), options);
    },
    /** Group weights and styles under the first face's family name. Using the family embeds every face in it. */
    family: (...faces: readonly [Font, ...Font[]]): FontFamily => {
      if (faces.length === 0) throw new Error("font.family() needs at least one font.");
      const seen = new Map<string, Font>();
      for (const face of faces) {
        const key = `${face.weight} ${face.style}`;
        if (seen.has(key)) throw new Error(`font.family() got two ${face.style} faces of weight ${face.weight}. Each weight and style needs its own file.`);
        seen.set(key, face);
      }
      return new FontFamily(faces[0].family, faces, faces[0].fallback);
    },
  },
);
