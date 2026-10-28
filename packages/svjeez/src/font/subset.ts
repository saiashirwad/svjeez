import { i16, required, table, u16, u32, type Sfnt } from "./sfnt";
import type { Shaper } from "./shape";

/**
 * Tables that go: variation data (the subset is the default instance), layout tables (kerning is rebuilt as a `kern`
 * table, and a scene whose text could meet any other lookup embeds the whole font instead), per-glyph device metrics, and the signature.
 */
const DROP = new Set([
  "GSUB",
  "GPOS",
  "GDEF",
  "BASE",
  "JSTF",
  "MATH",
  "fvar",
  "gvar",
  "avar",
  "cvar",
  "HVAR",
  "VVAR",
  "MVAR",
  "STAT",
  "hdmx",
  "LTSH",
  "VDMX",
  "DSIG",
  "kern",
  "morx",
  "kerx",
]);

const glyphRange = (f: Sfnt, glyph: number): readonly [number, number] => {
  const loca = required(f, "loca");
  const long = i16(f, required(f, "head") + 50) === 1;
  const at = (g: number) => (long ? u32(f, loca + 4 * g) : 2 * u16(f, loca + 2 * g));

  return [at(glyph), at(glyph + 1)];
};

/** The glyphs a composite glyph is built from, all the way down. */
const withComponents = (f: Sfnt, glyphs: Set<number>): Set<number> => {
  const glyf = required(f, "glyf");
  const queue = [...glyphs];

  while (queue.length > 0) {
    const glyph = queue.pop()!;
    const [start, end] = glyphRange(f, glyph);

    if (start === end || i16(f, glyf + start) >= 0) continue;
    let p = glyf + start + 10;

    for (let flags = 0x20; flags & 0x20;) {
      flags = u16(f, p);
      const component = u16(f, p + 2);
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 0x08 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);

      if (!glyphs.has(component)) {
        glyphs.add(component);
        queue.push(component);
      }
    }
  }

  return glyphs;
};

class Writer {
  readonly bytes: number[] = [];
  u16(v: number) {
    this.bytes.push((v >> 8) & 255, v & 255);

    return this;
  }
  i16(v: number) {
    return this.u16(v & 0xffff);
  }
  u32(v: number) {
    this.bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);

    return this;
  }
  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** binarySearchHeader fields for `count` entries of `size` bytes. */
const search = (count: number, size: number) => {
  const power = 2 ** Math.floor(Math.log2(Math.max(1, count)));

  return { range: power * size, selector: Math.log2(power), shift: count * size - power * size };
};

/** A format 4 cmap for the BMP characters, plus a format 12 one when any character lies beyond it. */
const charMap = (pairs: readonly (readonly [number, number])[]): Uint8Array => {
  const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
  const segments = sorted.filter(([code]) => code < 0xffff);
  const count = segments.length + 1;
  const { range, selector, shift } = search(count, 2);

  const sub = new Writer()
    .u16(4)
    .u16(16 + 8 * count)
    .u16(0)
    .u16(count * 2)
    .u16(range)
    .u16(selector)
    .u16(shift);

  for (const [code] of segments) sub.u16(code);
  sub.u16(0xffff).u16(0);

  for (const [code] of segments) sub.u16(code);
  sub.u16(0xffff);

  for (const [code, glyph] of segments) sub.u16((glyph - code) & 0xffff);
  sub.u16(1);

  for (let i = 0; i < count; i++) sub.u16(0);
  const bmp = sub.done();

  if (sorted.every(([code]) => code <= 0xffff)) {
    const head = new Writer().u16(0).u16(2).u16(0).u16(3).u32(20).u16(3).u16(1).u32(20).done();

    return Uint8Array.from([...head, ...bmp]);
  }

  const full = new Writer()
    .u16(12)
    .u16(0)
    .u32(16 + 12 * sorted.length)
    .u32(0)
    .u32(sorted.length);

  for (const [code, glyph] of sorted) full.u32(code).u32(code).u32(glyph);
  const at = 4 + 8 * 4 + bmp.length;

  const head = new Writer()
    .u16(0)
    .u16(4)
    .u16(0)
    .u16(3)
    .u32(36)
    .u16(0)
    .u16(4)
    .u32(at)
    .u16(3)
    .u16(1)
    .u32(36)
    .u16(3)
    .u16(10)
    .u32(at)
    .done();

  return Uint8Array.from([...head, ...bmp, ...full.done()]);
};

/** A version 0 `kern` table with one format 0 subtable. Browsers fall back to it when a font has no GPOS. */
const kernTable = (
  pairs: readonly (readonly [number, number, number])[],
): Uint8Array | undefined => {
  if (pairs.length === 0) return undefined;
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 10000);
  const { range, selector, shift } = search(sorted.length, 6);

  const w = new Writer()
    .u16(0)
    .u16(1)
    .u16(0)
    .u16(14 + 6 * sorted.length)
    .u16(1)
    .u16(sorted.length)
    .u16(range)
    .u16(selector)
    .u16(shift);

  for (const [left, right, value] of sorted) w.u16(left).u16(right).i16(value);

  return w.done();
};

const checksum = (bytes: Uint8Array): number => {
  let sum = 0;

  for (let i = 0; i < bytes.length; i += 4)
    sum =
      (sum +
        ((bytes[i]! << 24) |
          ((bytes[i + 1] ?? 0) << 16) |
          ((bytes[i + 2] ?? 0) << 8) |
          (bytes[i + 3] ?? 0))) >>>
      0;

  return sum;
};

const assemble = (tables: Map<string, Uint8Array>): Uint8Array => {
  const tags = [...tables.keys()].sort();
  const { range, selector, shift } = search(tags.length, 16);
  const header = new Writer().u32(0x00010000).u16(tags.length).u16(range).u16(selector).u16(shift);
  let offset = 12 + 16 * tags.length;

  const placed = tags.map((tag) => {
    const data = tables.get(tag)!;
    const at = offset;
    offset += (data.length + 3) & ~3;

    return { tag, data, at };
  });

  for (const { tag, data, at } of placed) {
    header.bytes.push(...[...tag].map((c) => c.charCodeAt(0)));
    header.u32(checksum(data)).u32(at).u32(data.length);
  }

  const out = new Uint8Array(offset);
  out.set(header.done(), 0);

  for (const { data, at } of placed) out.set(data, at);
  const head = placed.find((t) => t.tag === "head")!.at;
  new DataView(out.buffer).setUint32(head + 8, (0xb1b0afba - checksum(out)) >>> 0);

  return out;
};

/**
 * The font cut down to the glyphs that `texts` use. Glyph ids stay as they are, so only the outlines of every other glyph
 * are dropped, the character map is rebuilt for these characters, and pair kerning among them moves to a `kern` table.
 * Returns undefined when the text forms ligatures or could meet any other layout lookup, such as contextual alternates
 * or mark positioning, which a subset without GSUB and GPOS would no longer apply. With `layout` false the caller has
 * opted out of those lookups, so dropping them is the point and the text always cuts.
 */
export const subset = (
  bytes: Uint8Array,
  f: Sfnt,
  shaper: Shaper,
  kerning: (left: number, right: number) => number,
  texts: readonly string[],
  layout = true,
): Uint8Array | undefined => {
  const chars = new Set(texts.flatMap((text) => [...text]));

  const mapped = [...chars]
    .map((char) => [char.codePointAt(0)!, shaper.glyph(char)] as const)
    .filter(([, glyph]) => glyph !== 0);

  if (
    layout &&
    texts.some((text) => shaper.shape(text).some((placed) => [...placed.chars].length > 1))
  )
    return undefined;
  const drawn = [...new Set(mapped.map(([, glyph]) => glyph))];

  if (layout && shaper.beyond(texts.map((text) => [...text].map(shaper.glyph)))) return undefined;
  const keep = withComponents(f, new Set([0, ...drawn]));

  const glyfData: number[] = [];
  const offsets: number[] = [];
  const glyf = required(f, "glyf");
  const glyphs = u16(f, required(f, "maxp") + 4);

  for (let g = 0; g < glyphs; g++) {
    offsets.push(glyfData.length);

    if (!keep.has(g)) continue;
    const [start, end] = glyphRange(f, g);

    for (let i = start; i < end; i++) glyfData.push(f.view.getUint8(glyf + i));

    while (glyfData.length % 4) glyfData.push(0);
  }

  offsets.push(glyfData.length);
  const short = glyfData.length < 0x20000;
  const loca = new Writer();

  for (const offset of offsets) short ? loca.u16(offset / 2) : loca.u32(offset);

  const copy = (tag: string): Uint8Array => {
    const at = required(f, tag);

    return new Uint8Array(bytes.buffer, bytes.byteOffset + at, f.lengths.get(tag)!).slice();
  };

  const tables = new Map<string, Uint8Array>();

  for (const tag of f.tables.keys())
    if (!DROP.has(tag) && !["glyf", "loca", "cmap", "post", "head"].includes(tag))
      tables.set(tag, copy(tag));
  const head = copy("head");
  new DataView(head.buffer).setUint32(8, 0);
  new DataView(head.buffer).setInt16(50, short ? 0 : 1);
  tables.set("head", head);
  tables.set("glyf", Uint8Array.from(glyfData));
  tables.set("loca", loca.done());
  tables.set("cmap", charMap(mapped));

  if (table(f, "post") !== undefined) {
    const post = copy("post").slice(0, 32);
    new DataView(post.buffer).setUint32(0, 0x00030000);
    tables.set("post", post);
  }

  const pairs = drawn
    .flatMap((left) => drawn.map((right) => [left, right, kerning(left, right)] as const))
    .filter(([, , value]) => value !== 0);

  const kern = kernTable(pairs);

  if (kern) tables.set("kern", kern);

  return assemble(tables);
};
