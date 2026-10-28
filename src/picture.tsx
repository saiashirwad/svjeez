import type { TagChannels } from "./channels";
import { def, type Ref } from "./defs";
import type { Stack } from "./motion";
import { num } from "./format";
import type { SvgNode } from "./svg";

export type ImageFormat = "svg" | "png" | "jpeg" | "gif" | "webp";

/** An image ready to embed: a data URI plus the intrinsic size read from its header. */
export interface PictureData {
  readonly href: `data:${string}`;
  /** Intrinsic width in px, after EXIF rotation. For SVG, the root width, else derived from the viewBox. */
  readonly width: number;
  readonly height: number;
  readonly format: ImageFormat;
  /** Length of `href`, which is what the output pays. */
  readonly bytes: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Codec {
  readonly mime: string;
  readonly matches: (bytes: Uint8Array) => boolean;
  readonly size: (bytes: Uint8Array) => Size | undefined;
}

const ascii = (bytes: Uint8Array, at: number, text: string): boolean => [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));
const be16 = (b: Uint8Array, at: number): number => (b[at]! << 8) | b[at + 1]!;
const le16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const le24 = (b: Uint8Array, at: number): number => le16(b, at) | (b[at + 2]! << 16);

const png: Codec = {
  mime: "image/png",
  matches: (b) => b.length >= 24 && b[0] === 0x89 && ascii(b, 1, "PNG\r\n") && b[6] === 0x1a && b[7] === 0x0a,
  size: (b) => ({ width: be16(b, 16) * 65536 + be16(b, 18), height: be16(b, 20) * 65536 + be16(b, 22) }),
};

const isSof = (marker: number): boolean => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
const hasNoLength = (marker: number): boolean => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);

/** EXIF Orientation (tag 0x0112) from an APP1 segment spanning `start` to `end`. Browsers apply it, and 5 to 8 turn the image a quarter. */
const exifOrientation = (b: Uint8Array, start: number, end: number): number | undefined => {
  if (end > b.length || !ascii(b, start, "Exif\0\0")) return undefined;
  const tiff = start + 6;
  const little = ascii(b, tiff, "II");
  const u16 = (at: number) => (little ? le16(b, at) : be16(b, at));
  const u32 = (at: number) => (little ? (le16(b, at) | (le16(b, at + 2) << 16)) >>> 0 : be16(b, at) * 65536 + be16(b, at + 2));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return undefined;
  for (let entry = ifd + 2, count = u16(ifd); count > 0 && entry + 12 <= end; count--, entry += 12) {
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return undefined;
};

const jpeg: Codec = {
  mime: "image/jpeg",
  matches: (b) => b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  size: (b) => {
    let orientation = 1;
    let at = 2;
    while (at + 4 <= b.length) {
      if (b[at] !== 0xff || b[at + 1] === 0xff) {
        at++;
        continue;
      }
      const marker = b[at + 1]!;
      if (marker === 0xe1) orientation = exifOrientation(b, at + 4, at + 2 + be16(b, at + 2)) ?? orientation;
      if (isSof(marker)) {
        if (at + 9 > b.length) return undefined;
        const [height, width] = [be16(b, at + 5), be16(b, at + 7)];
        return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
      }
      at += hasNoLength(marker) ? 2 : 2 + be16(b, at + 2);
    }
    return undefined;
  },
};

const gif: Codec = {
  mime: "image/gif",
  matches: (b) => b.length >= 10 && ascii(b, 0, "GIF8") && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
  size: (b) => ({ width: le16(b, 6), height: le16(b, 8) }),
};

const webp: Codec = {
  mime: "image/webp",
  matches: (b) => b.length >= 30 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"),
  size: (b) => {
    if (ascii(b, 12, "VP8X")) return { width: 1 + le24(b, 24), height: 1 + le24(b, 27) };
    if (ascii(b, 12, "VP8L")) {
      const bits = (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (ascii(b, 12, "VP8 ")) return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
    return undefined;
  },
};

/** The root `<svg ...>` tag, after any BOM, XML declaration, comments, doctype and whitespace. Anything else before it is not an SVG file. */
const SVG_ROOT = /^\uFEFF?(?:\s+|<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)*<svg\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/i;

const attribute = (attrs: string, name: string): string | undefined =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs)?.slice(1).find((value) => value !== undefined);

const pixels = (value: string | undefined): number | undefined => {
  const match = /^\s*(\d*\.?\d+)\s*(?:px)?\s*$/.exec(value ?? "");
  return match ? Number(match[1]) : undefined;
};

const svgSize = (markup: string): Size | undefined => {
  const attrs = SVG_ROOT.exec(markup)?.[1] ?? "";
  const width = pixels(attribute(attrs, "width"));
  const height = pixels(attribute(attrs, "height"));
  if (width && height) return { width, height };
  const box = attribute(attrs, "viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!(box?.length === 4 && box[2]! > 0 && box[3]! > 0)) return undefined;
  const ratio = box[2]! / box[3]!;
  if (width) return { width, height: width / ratio };
  if (height) return { width: height * ratio, height };
  return { width: box[2]!, height: box[3]! };
};

const svg: Codec = {
  mime: "image/svg+xml",
  matches: (b) => SVG_ROOT.test(new TextDecoder().decode(b)),
  size: (b) => svgSize(new TextDecoder().decode(b)),
};

const FORMATS: Readonly<Record<ImageFormat, Codec>> = { png, jpeg, gif, webp, svg };

const base64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = "";
  for (let at = 0; at < bytes.length; at += CHUNK) binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  return btoa(binary);
};

/**
 * Percent-encode only what a data URI inside a double-quoted attribute cannot carry. Smaller than base64 and it gzips well.
 * Line breaks and tabs are encoded too, since attribute normalization would turn them into spaces.
 */
const svgHref = (markup: string): `data:${string}` => `data:image/svg+xml,${markup.trim().replace(/[%#<>"\r\n\t]/g, encodeURIComponent)}`;

const SUPPORTED = Object.keys(FORMATS).join(", ");

/**
 * Embed an image as a data URI. The format comes from the bytes, never the file extension; a string is SVG markup.
 * Pure and synchronous. See `picture.load` for files and URLs.
 */
export const picture = Object.assign(
  (source: Uint8Array | ArrayBuffer | string): PictureData => {
    const bytes = typeof source === "string" ? new TextEncoder().encode(source) : source instanceof Uint8Array ? source : new Uint8Array(source);
    const format = (Object.keys(FORMATS) as ImageFormat[]).find((key) => FORMATS[key].matches(bytes));
    if (!format) throw new Error(`Unknown image format. picture() reads ${SUPPORTED}.`);
    const codec = FORMATS[format];
    const size = codec.size(bytes);
    if (!size || !(size.width > 0 && size.height > 0)) {
      throw new Error(
        format === "svg" ? "This SVG has no size. Give the root <svg> a width and height or a viewBox." : `Could not read the size of this ${format} image. The file may be truncated.`,
      );
    }
    const href = format === "svg" ? svgHref(new TextDecoder().decode(bytes)) : (`data:${codec.mime};base64,${base64(bytes)}` as const);
    return { href, ...size, format, bytes: href.length };
  },
  {
    /** Read an http(s) URL with fetch, or a path or file: URL from disk. The format comes from the content. */
    load: async (source: string | URL): Promise<PictureData> => {
      const url = source instanceof URL ? source : /^[a-z][a-z0-9+.-]*:\/\//i.test(source) ? new URL(source) : undefined;
      if (url?.protocol === "http:" || url?.protocol === "https:") {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`.trim());
        return picture(await response.arrayBuffer());
      }
      const { readFile } = await import("node:fs/promises");
      if (!url) return picture(await readFile(source as string));
      if (url.protocol !== "file:") throw new Error(`Cannot load ${url}. Use an http(s) or file: URL, or a path.`);
      const { fileURLToPath } = await import("node:url");
      return picture(await readFile(fileURLToPath(url)));
    },
  },
);

const FITS = ["contain", "cover", "fill"] as const;

export interface PictureProps {
  readonly src: PictureData;
  /** Frame position. Default 0. */
  readonly x?: number;
  readonly y?: number;
  /** With only one of width and height, the other follows the aspect ratio. With neither, the intrinsic size. */
  readonly width?: number;
  readonly height?: number;
  /** How the image meets the frame. Default "cover". */
  readonly fit?: (typeof FITS)[number];
  /** Corner radius of the frame in px. */
  readonly radius?: number;
  readonly filter?: Ref<"filter">;
  readonly opacity?: number;
  readonly class?: string;
  /** Alt text. Without it the picture is hidden from assistive tech. */
  readonly alt?: string;
  /** Moves the image inside a frame that stays put. To animate the whole picture, wrap it in an animated `<g>`. */
  readonly animation?: Stack<TagChannels<"g">>;
}

/** One symbol per picture, so drawing an image many times embeds its bytes once. Overflow stays visible, or the symbol would crop an image larger than the canvas. */
const symbols = new WeakMap<PictureData, Ref<"symbol">>();

const symbolOf = (src: PictureData): Ref<"symbol"> => {
  let symbol = symbols.get(src);
  if (!symbol) symbols.set(src, (symbol = def.symbol({ style: "overflow:visible" }, <image href={src.href} width={src.width} height={src.height} />)));
  return symbol;
};

/** An embedded image in a fixed frame. `scale` on `animation` zooms about the frame's center, clipped to the frame. */
export function Picture({ src, x = 0, y = 0, width, height, fit = "cover", radius, filter, opacity, class: className, alt, animation }: PictureProps): SvgNode {
  const w = width ?? (height === undefined ? src.width : (height * src.width) / src.height);
  const h = height ?? (width === undefined ? src.height : (width * src.height) / src.width);
  const [sx, sy] = fit === "fill" ? [w / src.width, h / src.height] : Array(2).fill((fit === "cover" ? Math.max : Math.min)(w / src.width, h / src.height));
  const placed = (
    <g transform={`translate(${num(x + (w - src.width * sx) / 2, 4)} ${num(y + (h - src.height * sy) / 2, 4)}) scale(${num(sx, 6)} ${num(sy, 6)})`}>
      <use href={symbolOf(src)} />
    </g>
  );
  const moving = animation ? <g animation={animation}>{placed}</g> : placed;
  const clipped = fit === "cover" || radius || animation ? <g clipPath={def.clipPath({}, <rect x={x} y={y} width={w} height={h} rx={radius} />)}>{moving}</g> : moving;
  return (
    <g filter={filter} opacity={opacity} class={className} role={alt === undefined ? undefined : "img"} aria-label={alt} aria-hidden={alt === undefined ? "true" : undefined}>
      {clipped}
    </g>
  );
}
