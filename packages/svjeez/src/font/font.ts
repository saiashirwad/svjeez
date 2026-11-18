import { contours, pathData } from "./glyf";
import { typesetter, type Typesetter } from "./shape";
import { subset } from "./subset";
import {
  isFixedPitch,
  isItalic,
  metrics,
  name,
  sfnt,
  SFNT_CFF,
  SFNT_TRUETYPE,
  weightOf,
  type Metrics,
  type Sfnt,
} from "./sfnt";
import { readSource } from "../author/source";

export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

export type FontStyle = "normal" | "italic";

export type { Metrics as FontMetrics };

export interface FontOptions {
  readonly family?: string;
  readonly weight?: number;
  readonly style?: FontStyle;
  readonly fallback?: readonly string[];
  readonly subset?: boolean;
  readonly ligatures?: boolean;
}

export interface PathOptions {
  readonly size: number;
  readonly x?: number;
  readonly y?: number;
}

export interface GlyphPath {
  readonly char: string;
  readonly d: string;
  readonly x: number;
  readonly advance: number;
}

export interface TextPath {
  readonly d: string;
  readonly width: number;
  readonly glyphs: readonly GlyphPath[];
}

interface Format {
  readonly mime: string;
  readonly css: string;
  readonly matches: (tag: number) => boolean;
}

const tag = (text: string): number =>
  [...text].reduce((n, char) => n * 256 + char.charCodeAt(0), 0);

const FORMATS: Readonly<Record<FontFormat, Format>> = {
  ttf: {
    mime: "font/ttf",
    css: "truetype",
    matches: (t) => t === SFNT_TRUETYPE || t === tag("true"),
  },
  otf: { mime: "font/otf", css: "opentype", matches: (t) => t === SFNT_CFF },
  woff: { mime: "font/woff", css: "woff", matches: (t) => t === tag("wOFF") },
  woff2: { mime: "font/woff2", css: "woff2", matches: (t) => t === tag("wOF2") },
};

const base64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";

  for (let at = 0; at < bytes.length; at += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));

  return btoa(binary);
};

const hash = (bytes: Uint8Array): string => {
  let h = 0x811c9dc5;

  for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193);

  return (h >>> 0).toString(36);
};

export class Font {
  readonly #sfnt: Sfnt | undefined;
  readonly #bytes: Uint8Array;
  #typesetter: Typesetter | undefined;
  readonly #embeds = new Map<string, `data:${string}`>();
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;
  readonly fallback: readonly string[];
  readonly subset: boolean;
  readonly ligatures: boolean;
  readonly format: FontFormat;
  readonly href: `data:${string}`;
  readonly bytes: number;

  constructor(bytes: Uint8Array, format: FontFormat, options: FontOptions) {
    const readable = format === "ttf" || format === "otf" ? sfnt(bytes) : undefined;
    this.#sfnt = readable;
    this.#bytes = bytes;
    this.subset = options.subset ?? true;
    this.ligatures = options.ligatures ?? true;
    this.format = format;
    this.family = options.family ?? (readable && name(readable, 16, 1)) ?? `font-${hash(bytes)}`;
    this.weight = options.weight ?? (readable ? weightOf(readable) : 400);
    this.style = options.style ?? (readable && isItalic(readable) ? "italic" : "normal");
    this.fallback = options.fallback ?? [
      readable && isFixedPitch(readable) ? "monospace" : "sans-serif",
    ];

    if (!(this.weight >= 1 && this.weight <= 1000))
      throw new Error(`font() needs a weight between 1 and 1000, got ${this.weight}.`);
    this.href = `data:${FORMATS[format].mime};base64,${base64(bytes)}`;
    this.bytes = this.href.length;
  }

  #readable(what: string): Sfnt {
    if (!this.#sfnt)
      throw new Error(
        `${what} needs the TTF or OTF file. A ${this.format.toUpperCase()} font embeds, but its tables are compressed.`,
      );

    return this.#sfnt;
  }

  #typeset(text: string, what: string) {
    this.#typesetter ??= typesetter(this.#readable(what), this.ligatures);

    return this.#typesetter.layoutGlyphs(text);
  }

  embed(texts: readonly string[]): `data:${string}` {
    const font = this.#sfnt;

    if (!font || !this.subset || font.tables.get("glyf") === undefined) return this.href;

    const key =
      [...new Set(texts.flatMap((text) => [...text]))].sort().join("") +
      "\u0000" +
      texts.join("\u0000");

    let href = this.#embeds.get(key);

    if (!href) {
      this.#typesetter ??= typesetter(font, this.ligatures);
      const active = this.#typesetter;
      const cut = subset(this.#bytes, font, active, active.kern, texts, this.ligatures);
      href = cut ? `data:font/ttf;base64,${base64(cut)}` : this.href;
      this.#embeds.set(key, href);
    }

    return href;
  }

  get metrics(): Metrics {
    return metrics(this.#readable("metrics"));
  }

  has(char: string): boolean {
    if (char === "") return false;

    this.#typesetter ??= typesetter(this.#readable("has()"), this.ligatures);

    return this.#typesetter.glyph(char) !== 0;
  }

  measure(text: string, size: number): number {
    const scale = size / this.metrics.unitsPerEm;

    return this.#typeset(text, "measure()").reduce(
      (width, glyph) => width + glyph.advance * scale,
      0,
    );
  }

  advances(text: string, size: number): number[] {
    const scale = size / this.metrics.unitsPerEm;

    return this.#typeset(text, "advances()").map((glyph) => glyph.advance * scale);
  }

  path(text: string, { size, x = 0, y = 0 }: PathOptions): TextPath {
    const font = this.#readable("path()");

    if (this.format === "otf")
      throw new Error(
        "path() reads TrueType outlines. This OTF stores CFF outlines, which path() does not read yet.",
      );

    if (!(size > 0) || !Number.isFinite(x + y))
      throw new Error(
        `path() needs a positive size and finite coordinates, got size ${size} at ${x}, ${y}.`,
      );
    const scale = size / this.metrics.unitsPerEm;
    let pen = x;

    const glyphs = this.#typeset(text, "path()").map((glyph): GlyphPath => {
      const placed = {
        char: glyph.chars,
        d: pathData(contours(font, glyph.glyph), scale, pen, y),
        x: pen,
        advance: glyph.advance * scale,
      };

      pen += placed.advance;

      return placed;
    });

    return { d: glyphs.map((glyph) => glyph.d).join(""), width: pen - x, glyphs };
  }

  toString(): never {
    throw new Error("A font is not a string. Pass it as fontFamily={font}.");
  }
}

export class FontFamily {
  constructor(
    readonly name: string,
    readonly faces: readonly Font[],
    readonly fallback: readonly string[],
  ) {}

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

export const isFontValue = (value: unknown): value is FontValue =>
  value instanceof Font || value instanceof FontFamily;

const escapeControl = (char: string): string => {
  const code = char.charCodeAt(0);

  return code < 0x20 || code === 0x7f ? `\\${code.toString(16)} ` : char;
};

const cssString = (text: string): string =>
  `'${[...text.replace(/['\\]/g, "\\$&")].map(escapeControl).join("")}'`;

interface FontFaces {
  readonly family: string;
  readonly faces: readonly { readonly name: string; readonly font: Font }[];
}

export const fontFaces = (value: FontValue): FontFaces => {
  const [name, faces, fallback] =
    value instanceof Font
      ? [value.family, [value], value.fallback]
      : [value.name, value.faces, value.fallback];

  return {
    family: [cssString(name), ...fallback].join(", "),
    faces: faces.map((font) => ({ name, font })),
  };
};

export const fontFaceRule = (name: string, font: Font, texts: readonly string[] = []): string =>
  `@font-face{font-family:${cssString(name)};src:url(${font.embed(texts)}) format('${FORMATS[font.format].css}');font-weight:${font.weight};font-style:${font.style}}`;

const SUPPORTED = Object.keys(FORMATS).join(", ");

export const font = Object.assign(
  (source: Uint8Array | ArrayBuffer, options: FontOptions = {}): Font => {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);

    if (bytes.length < 12) throw new Error("This font is empty or truncated.");
    const signature = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);

    if (signature === tag("ttcf"))
      throw new Error(
        "This is a font collection (.ttc). Extract one face to a .ttf or .otf and load that.",
      );

    // SAFETY: FORMATS has exactly the FontFormat keys, so every key Object.keys returns is a FontFormat.
    const format = (Object.keys(FORMATS) as FontFormat[]).find((key) =>
      FORMATS[key].matches(signature),
    );

    if (!format) throw new Error(`Unknown font format. font() reads ${SUPPORTED}.`);

    return new Font(bytes, format, options);
  },
  {
    load: async (source: string | URL, options: FontOptions = {}): Promise<Font> =>
      font(await readSource(source), options),
    family: (...faces: readonly [Font, ...Font[]]): FontFamily => {
      if (faces.length === 0) throw new Error("font.family() needs at least one font, got none.");
      const seen = new Map<string, Font>();

      for (const face of faces) {
        const key = `${face.weight} ${face.style}`;

        if (seen.has(key))
          throw new Error(
            `font.family() got two ${face.style} faces of weight ${face.weight}. Each weight and style needs its own file.`,
          );
        seen.set(key, face);
      }

      return new FontFamily(faces[0].family, faces, faces[0].fallback);
    },
  },
);
