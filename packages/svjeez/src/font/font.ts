import { SceneError } from "../model/scene-error";
import { contours, pathData } from "./glyf";
import { typesetter, type Typesetter } from "./shape";
import { subsetWithReason } from "./subset";
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
import { base64 } from "../model/base64";

type FontFormat = "ttf" | "otf" | "woff" | "woff2";

/** What a font file is, or `"system"` for a family the viewer already has. */
export type FontKind = FontFormat | "system";

/** How CSS spells a face's slant. */
export const cssFontStyle = (face: { readonly italic: boolean }): "normal" | "italic" =>
  face.italic ? "italic" : "normal";

export interface FontOptions {
  readonly family?: string;
  readonly weight?: number;
  readonly italic?: boolean;
  readonly fallback?: readonly string[];
  readonly subset?: boolean;
  readonly ligatures?: boolean;
  /** OpenType single-substitution features to activate (e.g. `["lnum"]`, `["tnum"]`, `["smcp"]`). */
  readonly features?: readonly string[];
  /** Vertical metrics as fractions of the size, for a font svjeez can't read. */
  readonly metrics?: {
    readonly ascent: number;
    readonly descent: number;
    readonly lineGap?: number;
  };
}

export interface MeasureOptions {
  readonly letterSpacing?: number;
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

interface GlyphPath {
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

const hash = (bytes: Uint8Array): string => {
  let h = 0x811c9dc5;

  for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193);

  return (h >>> 0).toString(36);
};

const UNREAD: Metrics = { unitsPerEm: 1, ascent: 0.8, descent: 0.2, lineGap: 0 };

export type FontBytes = Uint8Array | ArrayBuffer;

export type FontSource = FontBytes | (() => FontBytes);

const isLazySource = (source: FontSource): source is () => FontBytes =>
  typeof source === "function";

const detectBytes = (source: FontBytes) => {
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

  return { bytes, format };
};

export class Font {
  #sfnt: Sfnt | undefined;
  #bytes: Uint8Array;
  #loader: (() => FontBytes) | undefined;
  #loaded: boolean;
  #typesetter: Typesetter | undefined;
  readonly #embeds = new Map<
    string,
    { readonly href: `data:${string}`; readonly reason?: string }
  >();
  #family: string | undefined;
  #weight: number | undefined;
  #italic: boolean | undefined;
  #fallback: readonly string[] | undefined;
  readonly subset: boolean;
  readonly ligatures: boolean;
  readonly features: readonly string[];
  #format: FontKind | undefined;
  #href: `data:${string}` | undefined;
  readonly #metrics: Metrics | undefined;
  readonly #options: FontOptions;

  constructor(
    bytes: Uint8Array | (() => FontBytes),
    format: FontKind | undefined,
    options: FontOptions,
  ) {
    this.#options = options;
    this.#metrics = options.metrics && { unitsPerEm: 1, lineGap: 0, ...options.metrics };
    this.subset = options.subset ?? true;
    this.ligatures = options.ligatures ?? true;
    this.features = options.features ?? [];
    this.#family = options.family;
    this.#weight = options.weight;
    this.#italic = options.italic;
    this.#fallback = options.fallback;

    if (options.weight !== undefined && !(options.weight >= 1 && options.weight <= 1000))
      throw new SceneError(`font() needs a weight between 1 and 1000, got ${options.weight}.`);

    if (isLazySource(bytes)) {
      this.#bytes = new Uint8Array(0);
      this.#loader = bytes;
      this.#loaded = false;
      this.#format = format;
    } else {
      this.#bytes = bytes;
      this.#loaded = true;
      this.#init(bytes, format!);
    }
  }

  #init(bytes: Uint8Array, format: FontKind): void {
    const readable = format === "ttf" || format === "otf" ? sfnt(bytes) : undefined;
    this.#sfnt = readable;
    this.#bytes = bytes;
    this.#format = format;
    this.#family =
      this.#options.family ?? (readable && name(readable, 16, 1)) ?? `font-${hash(bytes)}`;
    this.#weight = this.#options.weight ?? (readable ? weightOf(readable) : 400);
    this.#italic = this.#options.italic ?? (readable !== undefined && isItalic(readable));
    this.#fallback = this.#options.fallback ?? [
      readable && isFixedPitch(readable) ? "monospace" : "sans-serif",
    ];

    if (!(this.#weight >= 1 && this.#weight <= 1000))
      throw new SceneError(`font() needs a weight between 1 and 1000, got ${this.#weight}.`);
    this.#href =
      format === "system" ? undefined : `data:${FORMATS[format].mime};base64,${base64(bytes)}`;
  }

  #ensure(): void {
    if (this.#loaded) return;
    const loader = this.#loader!;
    this.#loader = undefined;
    this.#loaded = true;
    const { bytes, format } = detectBytes(loader());

    this.#init(bytes, format);
  }

  get family(): string {
    if (this.#family !== undefined) return this.#family;
    this.#ensure();

    return this.#family!;
  }

  get weight(): number {
    if (this.#weight !== undefined) return this.#weight;
    this.#ensure();

    return this.#weight!;
  }

  get italic(): boolean {
    if (this.#italic !== undefined) return this.#italic;
    this.#ensure();

    return this.#italic!;
  }

  get fallback(): readonly string[] {
    if (this.#fallback !== undefined) return this.#fallback;
    this.#ensure();

    return this.#fallback!;
  }

  get format(): FontKind {
    this.#ensure();

    return this.#format!;
  }

  get href(): `data:${string}` | undefined {
    this.#ensure();

    return this.#href;
  }

  get bytes(): number {
    this.#ensure();

    return this.#href?.length ?? 0;
  }

  /** Whether glyph advances can be read from the file; if not, a run must bring its own `advances`. */
  get measurable(): boolean {
    this.#ensure();

    return this.#sfnt !== undefined;
  }

  #readable(what: string): Sfnt {
    this.#ensure();

    if (!this.#sfnt)
      throw new SceneError(
        this.#format === "system"
          ? `${what} needs a font file, and ${this.family} is only a family name the viewer supplies.`
          : `${what} needs the TTF or OTF file. A ${this.#format!.toUpperCase()} font embeds, but its tables are compressed.`,
        "Give the <Run> its advances={[…]} (one per character), or load a TTF or OTF.",
      );

    return this.#sfnt;
  }

  #typeset(text: string, what: string) {
    this.#typesetter ??= typesetter(this.#readable(what), this.ligatures, this.features);

    return this.#typesetter.layoutGlyphs(text);
  }

  #embedEntry(
    texts: readonly string[],
  ): { readonly href: `data:${string}`; readonly reason?: string } | undefined {
    this.#ensure();
    const font = this.#sfnt;

    if (!font || !this.subset || !font.tables.has("glyf"))
      return this.#href === undefined ? undefined : { href: this.#href };

    const key =
      [...new Set(texts.flatMap((text) => [...text]))].sort().join("") +
      "\u0000" +
      texts.join("\u0000");

    let entry = this.#embeds.get(key);

    if (!entry) {
      this.#typesetter ??= typesetter(font, this.ligatures, this.features);
      const active = this.#typesetter;
      const cut = subsetWithReason(this.#bytes, font, active, texts, this.ligatures);

      entry = cut.bytes
        ? { href: `data:font/ttf;base64,${base64(cut.bytes)}` }
        : { href: this.#href!, ...(cut.reason && { reason: cut.reason }) };
      this.#embeds.set(key, entry);
    }

    return entry;
  }

  embed(texts: readonly string[]): `data:${string}` | undefined {
    return this.#embedEntry(texts)?.href;
  }

  /** Explains why subsetting fell back to the full font for `texts`, if it did. */
  subsetSkipReason(texts: readonly string[]): string | undefined {
    return this.#embedEntry(texts)?.reason;
  }

  get metrics(): Metrics {
    if (this.#metrics) return this.#metrics;
    this.#ensure();

    return this.#sfnt ? metrics(this.#sfnt) : UNREAD;
  }

  has(char: string): boolean {
    if (char === "") return false;

    this.#typesetter ??= typesetter(this.#readable("has()"), this.ligatures, this.features);

    return this.#typesetter.glyph(char) !== 0;
  }

  measure(text: string, size: number, options?: MeasureOptions): number {
    const scale = size / this.metrics.unitsPerEm;
    const glyphs = this.#typeset(text, "measure()");
    const spacing = options?.letterSpacing ?? 0;
    const base = glyphs.reduce((width, glyph) => width + glyph.advance * scale, 0);

    return base + (glyphs.length > 1 ? spacing * (glyphs.length - 1) : 0);
  }

  advances(text: string, size: number): number[] {
    const scale = size / this.metrics.unitsPerEm;

    return this.#typeset(text, "advances()").map((glyph) => glyph.advance * scale);
  }

  get outlines(): boolean {
    this.#ensure();

    return this.#format === "ttf" && this.#sfnt !== undefined;
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

    const placedList = this.#typeset(text, "path()");

    const glyphs = placedList.map((glyph, index): GlyphPath => {
      const gap = index + 1 < placedList.length ? spacing : 0;

      const placed = {
        char: glyph.chars,
        d: pathData(contours(font, glyph.glyph), scale, pen, y),
        x: pen,
        advance: glyph.advance * scale + gap,
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

export const fontFaceRule = (name: string, font: Font, texts: readonly string[] = []): string => {
  if (font.format === "system") return "";
  const reason = font.subsetSkipReason(texts);
  const note = reason ? `/* subset-skip: ${reason.replace(/\*\//g, "")} */` : "";

  const features =
    font.features.length > 0
      ? `;font-feature-settings:${font.features.map((feature) => `"${feature}"`).join(",")}`
      : "";

  return `@font-face{font-family:${cssString(name)};src:url(${font.embed(texts)}) format('${FORMATS[font.format].css}');font-weight:${font.weight};font-style:${cssFontStyle(font)}${features}${note}}`;
};

const SUPPORTED = Object.keys(FORMATS).join(", ");

export const font = Object.assign(
  (source: FontSource, options: FontOptions = {}): Font => {
    if (isLazySource(source)) return new Font(source, undefined, options);
    const { bytes, format } = detectBytes(source);

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
