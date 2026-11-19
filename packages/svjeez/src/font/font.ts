import { SceneError } from "../model/scene-error";
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

/** What a font file is, or `"system"` for a family the viewer already has. */
export type FontKind = FontFormat | "system";

/** How CSS spells a face's slant. */
export const cssFontStyle = (face: { readonly italic: boolean }): "normal" | "italic" =>
  face.italic ? "italic" : "normal";

export type { Metrics as FontMetrics };

export interface FontOptions {
  readonly family?: string;
  readonly weight?: number;
  readonly italic?: boolean;
  readonly fallback?: readonly string[];
  readonly subset?: boolean;
  readonly ligatures?: boolean;
  /** Vertical metrics as fractions of the size, for a font svjeez can't read. */
  readonly metrics?: {
    readonly ascent: number;
    readonly descent: number;
    readonly lineGap?: number;
  };
}

export interface SystemFontOptions {
  readonly weight?: number;
  readonly italic?: boolean;
  readonly fallback?: readonly string[];
  readonly metrics?: FontOptions["metrics"];
}

export interface PathOptions {
  readonly size: number;
  readonly spacing?: number;
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

const UNREAD: Metrics = { unitsPerEm: 1, ascent: 0.8, descent: 0.2, lineGap: 0 };

export class Font {
  readonly #sfnt: Sfnt | undefined;
  readonly #bytes: Uint8Array;
  #typesetter: Typesetter | undefined;
  readonly #embeds = new Map<string, `data:${string}`>();
  readonly family: string;
  readonly weight: number;
  readonly italic: boolean;
  readonly fallback: readonly string[];
  readonly subset: boolean;
  readonly ligatures: boolean;
  readonly format: FontKind;
  readonly href: `data:${string}` | undefined;
  readonly bytes: number;
  readonly #metrics: Metrics | undefined;

  constructor(bytes: Uint8Array, format: FontKind, options: FontOptions) {
    const readable = format === "ttf" || format === "otf" ? sfnt(bytes) : undefined;
    this.#sfnt = readable;
    this.#metrics = options.metrics && { unitsPerEm: 1, lineGap: 0, ...options.metrics };
    this.#bytes = bytes;
    this.subset = options.subset ?? true;
    this.ligatures = options.ligatures ?? true;
    this.format = format;
    this.family = options.family ?? (readable && name(readable, 16, 1)) ?? `font-${hash(bytes)}`;
    this.weight = options.weight ?? (readable ? weightOf(readable) : 400);
    this.italic = options.italic ?? (readable !== undefined && isItalic(readable));
    this.fallback = options.fallback ?? [
      readable && isFixedPitch(readable) ? "monospace" : "sans-serif",
    ];

    if (!(this.weight >= 1 && this.weight <= 1000))
      throw new SceneError(`font() needs a weight between 1 and 1000, got ${this.weight}.`);
    this.href =
      format === "system" ? undefined : `data:${FORMATS[format].mime};base64,${base64(bytes)}`;
    this.bytes = this.href?.length ?? 0;
  }

  /** Whether glyph advances can be read from the file; if not, a run must bring its own `advances`. */
  get measurable(): boolean {
    return this.#sfnt !== undefined;
  }

  #readable(what: string): Sfnt {
    if (!this.#sfnt)
      throw new SceneError(
        this.format === "system"
          ? `${what} needs a font file, and ${this.family} is only a family name the viewer supplies.`
          : `${what} needs the TTF or OTF file. A ${this.format.toUpperCase()} font embeds, but its tables are compressed.`,
        "Give the <Run> its advances={[…]} (one per character), or load a TTF or OTF.",
      );

    return this.#sfnt;
  }

  #typeset(text: string, what: string) {
    this.#typesetter ??= typesetter(this.#readable(what), this.ligatures);

    return this.#typesetter.layoutGlyphs(text);
  }

  embed(texts: readonly string[]): `data:${string}` | undefined {
    const font = this.#sfnt;

    if (!font || !this.subset || !font.tables.has("glyf")) return this.href;

    const key =
      [...new Set(texts.flatMap((text) => [...text]))].sort().join("") +
      "\u0000" +
      texts.join("\u0000");

    let href = this.#embeds.get(key);

    if (!href) {
      this.#typesetter ??= typesetter(font, this.ligatures);
      const active = this.#typesetter;
      const cut = subset(this.#bytes, font, active, texts, this.ligatures);
      href = cut ? `data:font/ttf;base64,${base64(cut)}` : this.href!;
      this.#embeds.set(key, href);
    }

    return href;
  }

  get metrics(): Metrics {
    if (this.#metrics) return this.#metrics;

    return this.#sfnt ? metrics(this.#sfnt) : UNREAD;
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

  get outlines(): boolean {
    return this.format === "ttf" && this.#sfnt !== undefined;
  }

  path(text: string, { size, x = 0, y = 0, spacing = 0 }: PathOptions): TextPath {
    const font = this.#readable("path()");

    if (!this.outlines)
      throw new SceneError(
        "path() reads TrueType outlines. This OTF stores CFF outlines, which path() does not read yet.",
      );

    if (!(size > 0) || !Number.isFinite(x + y))
      throw new SceneError(
        `path() needs a positive size and finite coordinates, got size ${size} at ${x}, ${y}.`,
      );
    const scale = size / this.metrics.unitsPerEm;
    let pen = x;

    const glyphs = this.#typeset(text, "path()").map((glyph): GlyphPath => {
      const placed = {
        char: glyph.chars,
        d: pathData(contours(font, glyph.glyph), scale, pen, y),
        x: pen,
        advance: glyph.advance * scale + spacing,
      };

      pen += placed.advance;

      return placed;
    });

    return { d: glyphs.map((glyph) => glyph.d).join(""), width: pen - x, glyphs };
  }

  toString(): never {
    throw new SceneError("A font is not a string. Pass it as fontFamily={font}.");
  }
}

export class FontFamily {
  constructor(
    readonly name: string,
    readonly faces: readonly Font[],
    readonly fallback: readonly string[],
  ) {}

  face(weight = 400, italic = false): Font {
    const styled = this.faces.filter((face) => face.italic === italic);
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
    throw new SceneError("A font family is not a string. Pass it as fontFamily={family}.");
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

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|ui-[a-z-]+)$/i;

/** The CSS family list for a font. `prefix` renames only embedded faces; system families keep their own name, and a CSS generic (`monospace`) stays a bare keyword. */
export const fontFaces = (value: FontValue, prefix = ""): FontFaces => {
  const [name, faces, fallback] =
    value instanceof Font
      ? [value.family, [value], value.fallback]
      : [value.name, value.faces, value.fallback];

  const embedded = faces.some((font) => font.format !== "system");

  return {
    family:
      !embedded && GENERIC.test(name.trim())
        ? name.trim()
        : [cssString((embedded ? prefix : "") + name), ...fallback].join(", "),
    faces: faces.map((font) => ({ name, font })),
  };
};

export const fontFaceRule = (name: string, font: Font, texts: readonly string[] = []): string =>
  font.format === "system"
    ? ""
    : `@font-face{font-family:${cssString(name)};src:url(${font.embed(texts)}) format('${FORMATS[font.format].css}');font-weight:${font.weight};font-style:${cssFontStyle(font)}}`;

const SUPPORTED = Object.keys(FORMATS).join(", ");

export const font = Object.assign(
  (source: Uint8Array | ArrayBuffer, options: FontOptions = {}): Font => {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);

    if (bytes.length < 12) throw new SceneError("This font is empty or truncated.");
    const signature = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);

    if (signature === tag("ttcf"))
      throw new SceneError(
        "This is a font collection (.ttc). Extract one face to a .ttf or .otf and load that.",
      );

    // SAFETY: FORMATS has exactly the FontFormat keys, so every key Object.keys returns is a FontFormat.
    const format = (Object.keys(FORMATS) as FontFormat[]).find((key) =>
      FORMATS[key].matches(signature),
    );

    if (!format) throw new SceneError(`Unknown font format. font() reads ${SUPPORTED}.`);

    return new Font(bytes, format, options);
  },
  {
    load: async (source: string | URL, options: FontOptions = {}): Promise<Font> =>
      font(await readSource(source), options),
    system: (family: string, options: SystemFontOptions = {}): Font => {
      if (family.trim() === "")
        throw new SceneError("font.system() needs a family name, got an empty string.");

      return new Font(new Uint8Array(0), "system", { ...options, family });
    },
    family: (...faces: readonly [Font, ...Font[]]): FontFamily => {
      if (faces.length === 0)
        throw new SceneError("font.family() needs at least one font, got none.");
      const seen = new Map<string, Font>();

      for (const face of faces) {
        const key = `${face.weight} ${cssFontStyle(face)}`;

        if (seen.has(key))
          throw new SceneError(
            `font.family() got two ${face.italic ? "italic" : "upright"} faces of weight ${face.weight}. Each weight, upright and italic, needs its own file.`,
          );
        seen.set(key, face);
      }

      return new FontFamily(faces[0].family, faces, faces[0].fallback);
    },
  },
);
