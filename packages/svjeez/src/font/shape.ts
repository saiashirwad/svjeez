import { advance, i16, required, table, u16, u32, type Sfnt } from "./sfnt";

/** One glyph placed on the line. `chars` is the text it draws, more than one character for a ligature. */
interface Placed {
  readonly glyph: number;
  readonly chars: string;
  /** In font units, kerning included. */
  readonly advance: number;
}

type CharMap = (code: number) => number;

const format4 = (f: Sfnt, at: number): CharMap => {
  const segments = u16(f, at + 6) / 2;
  const ends = at + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const ranges = deltas + 2 * segments;
  return (code) => {
    if (code > 0xffff) return 0;
    for (let i = 0; i < segments; i++) {
      if (code > u16(f, ends + 2 * i)) continue;
      const start = u16(f, starts + 2 * i);
      if (code < start) return 0;
      const delta = i16(f, deltas + 2 * i);
      const range = u16(f, ranges + 2 * i);
      if (range === 0) return (code + delta) & 0xffff;
      const glyph = u16(f, ranges + 2 * i + range + 2 * (code - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
};

const format12 = (f: Sfnt, at: number): CharMap => {
  const groups = u32(f, at + 12);
  return (code) => {
    let [lo, hi] = [0, groups - 1];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const g = at + 16 + 12 * mid;
      if (code < u32(f, g)) hi = mid - 1;
      else if (code > u32(f, g + 4)) lo = mid + 1;
      else return u32(f, g + 8) + code - u32(f, g);
    }
    return 0;
  };
};

/** The Unicode subtable: full repertoire (format 12) before BMP (format 4). */
const charMap = (f: Sfnt): CharMap => {
  const cmap = required(f, "cmap");
  const subtables = Array.from({ length: u16(f, cmap + 2) }, (_, i) => {
    const r = cmap + 4 + 8 * i;
    const at = cmap + u32(f, r + 4);
    return { platform: u16(f, r), encoding: u16(f, r + 2), format: u16(f, at), at };
  });
  const unicode = subtables.filter((s) => s.platform === 0 || (s.platform === 3 && (s.encoding === 1 || s.encoding === 10)));
  const full = unicode.find((s) => s.format === 12);
  if (full) return format12(f, full.at);
  const bmp = unicode.find((s) => s.format === 4);
  if (bmp) return format4(f, bmp.at);
  throw new Error("This font has no Unicode character map (cmap format 4 or 12).");
};

/** Coverage index of a glyph, or -1. */
const coverage = (f: Sfnt, at: number, glyph: number): number => {
  const count = u16(f, at + 2);
  if (u16(f, at) === 1) {
    for (let i = 0; i < count; i++) if (u16(f, at + 4 + 2 * i) === glyph) return i;
    return -1;
  }
  for (let i = 0; i < count; i++) {
    const r = at + 4 + 6 * i;
    if (glyph >= u16(f, r) && glyph <= u16(f, r + 2)) return u16(f, r + 4) + glyph - u16(f, r);
  }
  return -1;
};

const classOf = (f: Sfnt, at: number, glyph: number): number => {
  if (u16(f, at) === 1) {
    const start = u16(f, at + 2);
    const count = u16(f, at + 4);
    return glyph >= start && glyph < start + count ? u16(f, at + 6 + 2 * (glyph - start)) : 0;
  }
  for (let i = 0, count = u16(f, at + 2); i < count; i++) {
    const r = at + 4 + 6 * i;
    if (glyph >= u16(f, r) && glyph <= u16(f, r + 2)) return u16(f, r + 4);
  }
  return 0;
};

interface Lookup {
  readonly index: number;
  readonly type: number;
  readonly flag: number;
  readonly subtables: readonly number[];
}

/** A lookup's type, flag and subtables, with an extension lookup (GSUB 7, GPOS 9) unwrapped to its real type. */
const lookupAt = (f: Sfnt, lookupList: number, index: number, extension: number): Lookup => {
  const lookup = lookupList + u16(f, lookupList + 2 + 2 * index);
  const type = u16(f, lookup);
  const flag = u16(f, lookup + 2);
  const subtables = Array.from({ length: u16(f, lookup + 4) }, (_, i) => lookup + u16(f, lookup + 6 + 2 * i));
  if (type !== extension) return { index, type, flag, subtables };
  return { index, type: u16(f, subtables[0]! + 2), flag, subtables: subtables.map((s) => s + u32(f, s + 4)) };
};

const tagAt = (f: Sfnt, at: number): string => String.fromCharCode(...[0, 1, 2, 3].map((k) => f.view.getUint8(at + k)));

/** Indices of the lookups that a language system's features turn on, for the features `wanted` accepts. */
const langSysLookups = (f: Sfnt, featureList: number, langSys: number, wanted: (feature: string) => boolean, into: Set<number>): void => {
  for (let i = 0, count = u16(f, langSys + 4); i < count; i++) {
    const record = featureList + 2 + 6 * u16(f, langSys + 6 + 2 * i);
    if (!wanted(tagAt(f, record))) continue;
    const table = featureList + u16(f, record + 4);
    for (let j = 0, n = u16(f, table + 2); j < n; j++) into.add(u16(f, table + 4 + 2 * j));
  }
};

/** Subtables of the lookups that the given features turn on, in lookup order, for the Latin script or the default. */
const lookups = (f: Sfnt, tag: "GSUB" | "GPOS", features: readonly string[], extension: number): Lookup[] => {
  const at = table(f, tag);
  if (at === undefined) return [];
  const scripts = at + u16(f, at + 4);
  const scriptRecords = Array.from({ length: u16(f, scripts) }, (_, i) => ({ tag: tagAt(f, scripts + 2 + 6 * i), at: scripts + u16(f, scripts + 2 + 6 * i + 4) }));
  const script = scriptRecords.find((s) => s.tag === "latn") ?? scriptRecords.find((s) => s.tag === "DFLT") ?? scriptRecords[0];
  if (!script || u16(f, script.at) === 0) return [];
  const indices = new Set<number>();
  langSysLookups(f, at + u16(f, at + 6), script.at + u16(f, script.at), (feature) => features.includes(feature), indices);
  return [...indices].sort((a, b) => a - b).map((index) => lookupAt(f, at + u16(f, at + 8), index, extension));
};

/** Features a browser applies without being asked, in some script. */
const DEFAULT_FEATURES = new Set(
  "abvf abvm abvs akhn blwf blwm blws calt ccmp cfar cjct clig curs dist fin2 fin3 fina half haln init isol kern liga ljmo locl ltra ltrm mark med2 medi mkmk nukt pref pres pstf psts rclt rkrf rlig rphf rtla rtlm rvrn stch tjmo vatu vjmo".split(" "),
);

/** Every lookup a default feature turns on in any script's default language system, which is what text without `lang` gets. */
const defaultLookups = (f: Sfnt, tag: "GSUB" | "GPOS", extension: number): Lookup[] => {
  const at = table(f, tag);
  if (at === undefined) return [];
  const scripts = at + u16(f, at + 4);
  const featureList = at + u16(f, at + 6);
  const indices = new Set<number>();
  for (let i = 0, count = u16(f, scripts); i < count; i++) {
    const script = scripts + u16(f, scripts + 2 + 6 * i + 4);
    if (u16(f, script) !== 0) langSysLookups(f, featureList, script + u16(f, script), (feature) => DEFAULT_FEATURES.has(feature), indices);
  }
  return [...indices].map((index) => lookupAt(f, at + u16(f, at + 8), index, extension));
};

/** Lookup flags that make a rule skip glyphs by their GDEF class, so its sequence need not be contiguous in the text. */
const SKIPS = 0xff1e;

/**
 * Whether a subtable could apply somewhere in these runs of glyphs. Format 3 contextual rules and reverse chaining are
 * matched in place. Other contextual formats are judged by their first glyph, and rules that skip glyphs by every
 * coverage meeting some glyph, which errs toward yes.
 */
const mayApply = (f: Sfnt, tag: "GSUB" | "GPOS", lookup: Lookup, subtable: number, runs: readonly (readonly number[])[]): boolean => {
  const covers = (offset: number, glyph: number | undefined) => glyph !== undefined && coverage(f, subtable + offset, glyph) >= 0;
  const meets = (offset: number) => runs.some((run) => run.some((glyph) => covers(offset, glyph)));
  const list = (at: number): [number[], number] => {
    const count = u16(f, at);
    return [Array.from({ length: count }, (_, i) => u16(f, at + 2 + 2 * i)), at + 2 + 2 * count];
  };
  const format = u16(f, subtable);
  let backtrack: number[] = [];
  let input: number[];
  let lookahead: number[] = [];
  if (lookup.type === (tag === "GSUB" ? 5 : 7) && format === 3) {
    input = Array.from({ length: u16(f, subtable + 2) }, (_, i) => u16(f, subtable + 6 + 2 * i));
  } else if (lookup.type === (tag === "GSUB" ? 6 : 8) && format === 3) {
    let next: number;
    [backtrack, next] = list(subtable + 2);
    [input, next] = list(next);
    [lookahead] = list(next);
  } else if (tag === "GSUB" && lookup.type === 8) {
    input = [u16(f, subtable + 2)];
    [backtrack] = list(subtable + 4);
    [lookahead] = list(subtable + 6 + 2 * backtrack.length);
  } else return meets(u16(f, subtable + 2));
  if (lookup.flag & SKIPS) return [...backtrack, ...input, ...lookahead].every(meets);
  return runs.some((run) =>
    run.some(
      (_, i) =>
        input.every((c, k) => covers(c, run[i + k])) &&
        backtrack.every((c, k) => covers(c, run[i - 1 - k])) &&
        lookahead.every((c, k) => covers(c, run[i + input.length + k])),
    ),
  );
};

/** GSUB type 4: replace a run of glyphs with one ligature glyph. */
const ligate = (f: Sfnt, subtable: number, run: Placed[], i: number): number => {
  const index = coverage(f, subtable + u16(f, subtable + 2), run[i]!.glyph);
  if (index < 0 || index >= u16(f, subtable + 4)) return 0;
  const set = subtable + u16(f, subtable + 6 + 2 * index);
  for (let l = 0, count = u16(f, set); l < count; l++) {
    const lig = set + u16(f, set + 2 + 2 * l);
    const components = u16(f, lig + 2);
    if (i + components > run.length) continue;
    let matches = true;
    for (let c = 1; c < components && matches; c++) matches = run[i + c]!.glyph === u16(f, lig + 4 + 2 * (c - 1));
    if (!matches) continue;
    const chars = run.slice(i, i + components).map((p) => p.chars).join("");
    run.splice(i, components, { glyph: u16(f, lig), chars, advance: 0 });
    return 1;
  }
  return 0;
};

const bits = (n: number): number => {
  let count = 0;
  for (; n; n &= n - 1) count++;
  return count;
};

/** The XAdvance of a ValueRecord, which is all that horizontal Latin kerning uses. */
const xAdvance = (f: Sfnt, record: number, format: number): number => (format & 4 ? i16(f, record + 2 * bits(format & 3)) : 0);

/** GPOS type 2: the kerning between two glyphs, or undefined when this subtable does not cover the pair. */
const kern = (f: Sfnt, subtable: number, first: number, second: number): number | undefined => {
  const index = coverage(f, subtable + u16(f, subtable + 2), first);
  if (index < 0) return undefined;
  const [format1, format2] = [u16(f, subtable + 4), u16(f, subtable + 6)];
  const size1 = 2 * bits(format1);
  const size2 = 2 * bits(format2);
  if (u16(f, subtable) === 1) {
    const set = subtable + u16(f, subtable + 10 + 2 * index);
    let [lo, hi] = [0, u16(f, set) - 1];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const record = set + 2 + mid * (2 + size1 + size2);
      const glyph = u16(f, record);
      if (glyph < second) lo = mid + 1;
      else if (glyph > second) hi = mid - 1;
      else return xAdvance(f, record + 2, format1);
    }
    return undefined;
  }
  const class1 = classOf(f, subtable + u16(f, subtable + 8), first);
  const class2 = classOf(f, subtable + u16(f, subtable + 10), second);
  const count2 = u16(f, subtable + 14);
  return xAdvance(f, subtable + 16 + (class1 * count2 + class2) * (size1 + size2), format1);
};

export interface Shaper {
  readonly shape: (text: string) => readonly Placed[];
  readonly glyph: (char: string) => number;
  /** Pair kerning between two glyphs in font units. */
  readonly kern: (left: number, right: number) => number;
  /**
   * Whether a browser could substitute or position these runs of glyphs, one per text, through a lookup this shaper
   * does not apply: contextual alternates, mark positioning, the forms of another script. Errs toward yes.
   */
  readonly beyond: (runs: readonly (readonly number[])[]) => boolean;
}

/**
 * Glyphs for a line of text with the features a browser turns on by default for Latin: standard ligatures and pair kerning.
 * No bidi, no contextual alternates, no mark positioning, so complex scripts will not match the browser.
 * Without `withLigatures`, one glyph per character and pair kerning only.
 */
export const shaper = (f: Sfnt, withLigatures = true): Shaper => {
  const map = charMap(f);
  const ligatures = withLigatures ? lookups(f, "GSUB", ["liga", "clig", "rlig"], 7).filter((l) => l.type === 4) : [];
  const kerning = lookups(f, "GPOS", ["kern"], 9).filter((l) => l.type === 2);
  const legacyTable = kerning.length === 0 ? table(f, "kern") : undefined;
  const pair = (left: number, right: number): number => {
    let total = 0;
    for (const { subtables } of kerning) {
      for (const s of subtables) {
        const k = kern(f, s, left, right);
        if (k === undefined) continue;
        total += k;
        break;
      }
    }
    if (legacyTable !== undefined) total += legacyKern(f, legacyTable, left, right);
    return total;
  };
  const applied = new Set([...ligatures, ...kerning].map((l) => `${l.type === 4 ? "GSUB" : "GPOS"} ${l.index}`));
  const others = (["GSUB", "GPOS"] as const).flatMap((tag) =>
    defaultLookups(f, tag, tag === "GSUB" ? 7 : 9)
      .filter((lookup) => !applied.has(`${tag} ${lookup.index}`))
      .map((lookup) => ({ tag, lookup })),
  );
  return {
    glyph: (char) => map(char.codePointAt(0)!),
    kern: pair,
    beyond: (runs) => others.some(({ tag, lookup }) => lookup.subtables.some((s) => mayApply(f, tag, lookup, s, runs))),
    shape: (text) => {
      const run: Placed[] = [...text].map((chars) => ({ glyph: map(chars.codePointAt(0)!), chars, advance: 0 }));
      for (const { subtables } of ligatures) {
        for (let i = 0; i < run.length; i++) for (const s of subtables) if (ligate(f, s, run, i)) break;
      }
      return run.map((p, i) => ({ ...p, advance: advance(f, p.glyph) + (i + 1 < run.length ? pair(p.glyph, run[i + 1]!.glyph) : 0) }));
    },
  };
};

/** The kerning between two glyphs from the old `kern` table, format 0, for fonts without GPOS kerning. */
const legacyKern = (f: Sfnt, at: number, left: number, right: number): number => {
  if (u16(f, at) !== 0) return 0;
  const key = left * 65536 + right;
  let total = 0;
  let sub = at + 4;
  for (let t = 0, count = u16(f, at + 2); t < count; t++, sub += u16(f, sub + 2)) {
    if (u16(f, sub + 4) >> 8 !== 0 || (u16(f, sub + 4) & 1) === 0) continue;
    let [lo, hi] = [0, u16(f, sub + 6) - 1];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = sub + 14 + 6 * mid;
      const k = u16(f, r) * 65536 + u16(f, r + 2);
      if (k < key) lo = mid + 1;
      else if (k > key) hi = mid - 1;
      else {
        total += i16(f, r + 4);
        break;
      }
    }
  }
  return total;
};
