import { i16, name, required, requiredTable, table, u16, u32, type Sfnt } from "./sfnt";
import type { Typesetter } from "./shape";

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

const search = (count: number, size: number) => {
  const power = 2 ** Math.floor(Math.log2(Math.max(1, count)));

  return { range: power * size, selector: Math.log2(power), shift: count * size - power * size };
};

type Group = [first: number, last: number, glyph: number];

const groups = (pairs: readonly (readonly [number, number])[]): Group[] => {
  const merged: Group[] = [];

  for (const [code, glyph] of [...pairs].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);

    if (last && code === last[1] + 1 && glyph === last[2] + code - last[0]) last[1] = code;
    else merged.push([code, code, glyph]);
  }

  return merged;
};

export const charMap = (pairs: readonly (readonly [number, number])[]): Uint8Array => {
  const all = groups(pairs);

  const segments: Group[] = [
    ...groups(pairs.filter(([code]) => code < 0xffff)),
    [0xffff, 0xffff, 0],
  ];

  const count = segments.length;
  const { range, selector, shift } = search(count, 2);

  const bmp = new Writer()
    .u16(4)
    .u16(16 + 8 * count)
    .u16(0)
    .u16(count * 2)
    .u16(range)
    .u16(selector)
    .u16(shift);

  for (const [, last] of segments) bmp.u16(last);
  bmp.u16(0);

  for (const [first] of segments) bmp.u16(first);

  for (const [first, , glyph] of segments) bmp.u16((glyph - first) & 0xffff);

  for (let i = 0; i < count; i++) bmp.u16(0);

  if (all.every(([, last]) => last <= 0xffff))
    return Uint8Array.from([
      ...new Writer().u16(0).u16(1).u16(3).u16(1).u32(12).bytes,
      ...bmp.bytes,
    ]);

  const full = new Writer()
    .u16(12)
    .u16(0)
    .u32(16 + 12 * all.length)
    .u32(0)
    .u32(all.length);

  for (const [first, last, glyph] of all) full.u32(first).u32(last).u32(glyph);
  const at = 4 + 8 * 2 + bmp.bytes.length;

  return Uint8Array.from([
    ...new Writer().u16(0).u16(2).u16(3).u16(1).u32(20).u16(3).u16(10).u32(at).bytes,
    ...bmp.bytes,
    ...full.bytes,
  ]);
};

export const kernTable = (
  pairs: readonly (readonly [number, number, number])[],
  perSubtable = 10000,
): Uint8Array | undefined => {
  if (pairs.length === 0) return undefined;
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const chunks: (typeof sorted)[] = [];

  for (let i = 0; i < sorted.length; i += perSubtable)
    chunks.push(sorted.slice(i, i + perSubtable));

  const w = new Writer().u16(0).u16(chunks.length);

  for (const chunk of chunks) {
    const { range, selector, shift } = search(chunk.length, 6);

    w.u16(0)
      .u16(14 + 6 * chunk.length)
      .u16(1)
      .u16(chunk.length)
      .u16(range)
      .u16(selector)
      .u16(shift);

    for (const [left, right, value] of chunk) w.u16(left).u16(right).i16(value);
  }

  return w.done();
};

const nameTable = (family: string): Uint8Array => {
  const text = [...family].flatMap((char) => {
    const code = char.charCodeAt(0);

    return [code >> 8, code & 255];
  });

  const w = new Writer()
    .u16(0)
    .u16(1)
    .u16(18)
    .u16(3)
    .u16(1)
    .u16(0x409)
    .u16(1)
    .u16(text.length)
    .u16(0);

  return Uint8Array.from([...w.bytes, ...text]);
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

const ARGS_WORDS = 0x0001;
const ONE_SCALE = 0x0008;
const MORE = 0x0020;
const XY_SCALE = 0x0040;
const TWO_BY_TWO = 0x0080;

const componentSize = (flags: number): number =>
  4 +
  (flags & ARGS_WORDS ? 4 : 2) +
  (flags & ONE_SCALE ? 2 : flags & XY_SCALE ? 4 : flags & TWO_BY_TWO ? 8 : 0);

const glyphs = (f: Sfnt, bytes: Uint8Array) => {
  const loca = required(f, "loca");
  const glyf = required(f, "glyf");
  const long = i16(f, required(f, "head") + 50) === 1;
  const at = (g: number) => (long ? u32(f, loca + 4 * g) : 2 * u16(f, loca + 2 * g));

  return (glyph: number): Uint8Array => bytes.subarray(glyf + at(glyph), glyf + at(glyph + 1));
};

const components = (data: Uint8Array): { glyph: number; at: number }[] => {
  if (data.length === 0 || ((data[0]! << 24) >> 16) + data[1]! >= 0) return [];
  const found: { glyph: number; at: number }[] = [];

  for (let p = 10, flags = MORE; flags & MORE;) {
    flags = (data[p]! << 8) | data[p + 1]!;
    found.push({ glyph: (data[p + 2]! << 8) | data[p + 3]!, at: p });
    p += componentSize(flags);
  }

  return found;
};

const renumbered = (data: Uint8Array, renumber: (glyph: number) => number): Uint8Array => {
  const out = Uint8Array.from(data);

  for (const { glyph, at } of components(data)) {
    const id = renumber(glyph);
    out[at + 2] = id >> 8;
    out[at + 3] = id & 255;
  }

  return out;
};

const HINTING = ["cvt ", "fpgm", "gasp", "prep"];

export const subset = (
  bytes: Uint8Array,
  f: Sfnt,
  typesetter: Typesetter,
  texts: readonly string[],
  layout = true,
): Uint8Array | undefined => {
  if (
    layout &&
    texts.some((text) =>
      typesetter.layoutGlyphs(text).some((placed) => [...placed.chars].length > 1),
    )
  )
    return undefined;
  const runs = texts.map((text) => [...text].map(typesetter.glyph));

  if (layout && typesetter.beyond(runs)) return undefined;

  const mapped = [...new Set(texts.flatMap((text) => [...text]))]
    .flatMap((char) => {
      const glyph = typesetter.glyph(char);

      return glyph === 0 ? [] : [[char.codePointAt(0)!, glyph] as const];
    })
    .sort((a, b) => a[0] - b[0]);

  const outline = glyphs(f, bytes);
  const order = [0];
  const ids = new Map([[0, 0]]);

  const keep = (glyph: number) => {
    if (ids.has(glyph)) return;
    ids.set(glyph, order.length);
    order.push(glyph);
  };

  for (const [, glyph] of mapped) keep(glyph);

  for (let i = 0; i < order.length; i++)
    for (const { glyph } of components(outline(order[i]!))) keep(glyph);

  const renumber = (glyph: number) => ids.get(glyph)!;
  const glyf: number[] = [];
  const offsets: number[] = [];

  for (const glyph of order) {
    offsets.push(glyf.length);
    glyf.push(...renumbered(outline(glyph), renumber));

    if (glyf.length % 2) glyf.push(0);
  }

  offsets.push(glyf.length);
  const short = glyf.length < 0x20000;
  const loca = new Writer();

  for (const offset of offsets) {
    if (short) loca.u16(offset / 2);
    else loca.u32(offset);
  }

  const hmtx = required(f, "hmtx");
  const metrics = u16(f, required(f, "hhea") + 34);
  const advance = (glyph: number) => u16(f, hmtx + 4 * Math.min(glyph, metrics - 1));

  const bearing = (glyph: number) =>
    glyph < metrics
      ? i16(f, hmtx + 4 * glyph + 2)
      : i16(f, hmtx + 4 * metrics + 2 * (glyph - metrics));

  let long = order.length;

  while (long > 1 && advance(order[long - 1]!) === advance(order[long - 2]!)) long--;
  const widths = new Writer();

  order.forEach((glyph, i) => {
    if (i < long) widths.u16(advance(glyph));
    widths.i16(bearing(glyph));
  });

  const copy = (tag: string): Uint8Array => {
    const { offset, length } = requiredTable(f, tag);

    return Uint8Array.from(bytes.subarray(offset, offset + length));
  };

  const head = copy("head");
  new DataView(head.buffer).setUint32(8, 0);
  new DataView(head.buffer).setInt16(50, short ? 0 : 1);
  const hhea = copy("hhea");
  new DataView(hhea.buffer).setUint16(34, long);
  const maxp = copy("maxp");
  new DataView(maxp.buffer).setUint16(4, order.length);

  const tables = new Map<string, Uint8Array>([
    ["head", head],
    ["hhea", hhea],
    ["maxp", maxp],
    ["name", nameTable(name(f, 16, 1) ?? "Subset")],
    ["cmap", charMap(mapped.map(([code, glyph]) => [code, renumber(glyph)]))],
    ["glyf", Uint8Array.from(glyf)],
    ["loca", loca.done()],
    ["hmtx", widths.done()],
  ]);

  for (const tag of ["OS/2", ...HINTING])
    if (table(f, tag) !== undefined) tables.set(tag, copy(tag));

  if (table(f, "post") !== undefined) {
    const post = copy("post").slice(0, 32);
    new DataView(post.buffer).setUint32(0, 0x00030000);
    tables.set("post", post);
  }

  const pairs = new Map<number, readonly [number, number, number]>();

  for (const run of runs)
    for (let i = 0; i + 1 < run.length; i++) {
      const [left, right] = [run[i]!, run[i + 1]!];
      const value = typesetter.kern(left, right);

      if (value !== 0) pairs.set(left * 65536 + right, [renumber(left), renumber(right), value]);
    }

  const kern = kernTable([...pairs.values()]);

  if (kern) tables.set("kern", kern);

  return assemble(tables);
};
