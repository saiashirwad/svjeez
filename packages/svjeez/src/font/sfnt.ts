import { SceneError } from "../model/scene-error";

interface TableRecord {
  readonly offset: number;
  readonly length: number;
}

export interface Sfnt {
  readonly view: DataView;
  readonly tables: ReadonlyMap<string, TableRecord>;
}

export const SFNT_TRUETYPE = 0x00010000;
export const SFNT_CFF = 0x4f54544f;

export const u8 = (f: Sfnt, at: number): number => f.view.getUint8(at);
export const i8 = (f: Sfnt, at: number): number => f.view.getInt8(at);
export const u16 = (f: Sfnt, at: number): number => f.view.getUint16(at);
export const i16 = (f: Sfnt, at: number): number => f.view.getInt16(at);
export const u32 = (f: Sfnt, at: number): number => f.view.getUint32(at);

export const f2dot14 = (f: Sfnt, at: number): number => i16(f, at) / 16384;

export const table = (f: Sfnt, tag: string): number | undefined => f.tables.get(tag)?.offset;

export const requiredTable = (f: Sfnt, tag: string): TableRecord => {
  const record = f.tables.get(tag);

  if (!record) throw new SceneError(`This font has no ${tag} table.`);

  return record;
};

export const required = (f: Sfnt, tag: string): number => requiredTable(f, tag).offset;

export const sfnt = (bytes: Uint8Array): Sfnt => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = new Map<string, TableRecord>();
  const count = view.getUint16(4);

  if (12 + 16 * count > bytes.length)
    throw new SceneError(
      "This font is truncated: its table directory runs past the end of the file.",
    );

  for (let i = 0; i < count; i++) {
    const record = 12 + 16 * i;
    const [offset, length] = [view.getUint32(record + 8), view.getUint32(record + 12)];

    if (offset + length > bytes.length)
      throw new SceneError("This font is truncated: a table runs past the end of the file.");
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    tables.set(tag, { offset, length });
  }

  return { view, tables };
};

export interface Metrics {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  readonly capHeight?: number;
  readonly xHeight?: number;
}

export const metrics = (f: Sfnt): Metrics => {
  const head = required(f, "head");
  const hhea = required(f, "hhea");
  const os2 = table(f, "OS/2");
  const unitsPerEm = u16(f, head + 18);
  const em = (units: number) => units / unitsPerEm;
  const v2 = os2 !== undefined && u16(f, os2) >= 2;

  return {
    unitsPerEm,
    ascent: em(i16(f, hhea + 4)),
    descent: em(-i16(f, hhea + 6)),
    lineGap: em(i16(f, hhea + 8)),
    ...(v2 && { xHeight: em(i16(f, os2 + 86)), capHeight: em(i16(f, os2 + 88)) }),
  };
};

export const advance = (f: Sfnt, glyph: number): number => {
  const hmtx = required(f, "hmtx");
  const count = u16(f, required(f, "hhea") + 34);

  return u16(f, hmtx + 4 * Math.min(glyph, count - 1));
};

const utf16be = (f: Sfnt, at: number, length: number): string =>
  String.fromCharCode(...Array.from({ length: length / 2 }, (_, i) => u16(f, at + 2 * i)));

const latin1 = (f: Sfnt, at: number, length: number): string =>
  String.fromCharCode(...Array.from({ length }, (_, i) => u8(f, at + i)));

export const name = (f: Sfnt, ...ids: readonly number[]): string | undefined => {
  const at = table(f, "name");

  if (at === undefined) return undefined;
  const strings = at + u16(f, at + 4);

  const records = Array.from({ length: u16(f, at + 2) }, (_, i) => {
    const r = at + 6 + 12 * i;

    return {
      platform: u16(f, r),
      language: u16(f, r + 4),
      id: u16(f, r + 6),
      length: u16(f, r + 8),
      offset: strings + u16(f, r + 10),
    };
  });

  for (const id of ids) {
    const windows =
      records.find((r) => r.id === id && r.platform === 3 && r.language === 0x409) ??
      records.find((r) => r.id === id && r.platform === 3);

    if (windows) return utf16be(f, windows.offset, windows.length);
    const mac = records.find((r) => r.id === id && r.platform === 1 && r.language === 0);

    if (mac) return latin1(f, mac.offset, mac.length);
  }

  return undefined;
};

export const weightOf = (f: Sfnt): number => {
  const os2 = table(f, "OS/2");

  return os2 === undefined ? 400 : u16(f, os2 + 4);
};

export const isItalic = (f: Sfnt): boolean => {
  const os2 = table(f, "OS/2");

  if (os2 !== undefined) return (u16(f, os2 + 62) & 0x201) !== 0;

  return (u16(f, required(f, "head") + 44) & 2) !== 0;
};

export const isFixedPitch = (f: Sfnt): boolean => {
  const post = table(f, "post");

  return post !== undefined && u32(f, post + 12) !== 0;
};
