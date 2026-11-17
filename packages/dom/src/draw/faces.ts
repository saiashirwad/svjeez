import { font, type Font, type FontValue } from "svjeez";
import { fontFace, formatOf, isWholeFile } from "../fonts.ts";
import type { Face, Item, TextRun, Vector } from "../tree.ts";

/** Faces from every state, once each, by family. */
const byFamily = (faces: readonly Face[]): Map<string, Face[]> => {
  const out = new Map<string, Face[]>();
  const seen = new Set<string>();

  for (const face of faces) {
    const key = JSON.stringify(face);

    if (seen.has(key)) continue;

    seen.add(key);
    out.set(face.family, [...(out.get(face.family) ?? []), face]);
  }

  return out;
};

// Decoding a font is the slow part, and every `Dom` drawn from the same snapshots shares the files.
const decoded = new Map<string, Font | undefined>();

const fontOf = (face: Face): Font | undefined => {
  const key = `${face.family}|${face.weight}|${face.style}|${face.src}`;

  if (!decoded.has(key)) {
    const bytes = Uint8Array.from(atob(face.src.slice(face.src.indexOf(",") + 1)), (c) =>
      c.charCodeAt(0),
    );

    try {
      decoded.set(
        key,
        // Without ligatures, so the file always cuts down to the characters drawn: a UI font like Inter carries
        // contextual alternates that would otherwise keep the whole face, several hundred KB of it.
        font(bytes, {
          family: face.family,
          weight: Number(face.weight),
          style: face.style,
          ligatures: false,
        }),
      );
    } catch {
      decoded.set(key, undefined);
    }
  }

  return decoded.get(key);
};

// Twins without layout lookups, by the font they copy.
const twins = new WeakMap<Font, Font | undefined>();

const twinOf = (face: Font): Font | undefined => {
  if (!twins.has(face)) {
    const bytes = Uint8Array.from(atob(face.href.slice(face.href.indexOf(",") + 1)), (c) =>
      c.charCodeAt(0),
    );

    try {
      twins.set(
        face,
        font(bytes, {
          family: face.family,
          weight: face.weight,
          style: face.style,
          fallback: face.fallback,
          ligatures: false,
        }),
      );
    } catch {
      twins.set(face, undefined);
    }
  }

  return twins.get(face);
};

/**
 * The face to draw `runs` in. svjeez keeps a face whole when its text could meet any layout lookup, and a UI font
 * like Inter has contextual alternates whose coverage takes in nearly every letter, so a recording embedded several
 * hundred KB per weight. The drawing places every run where the page laid it out and svjeez sets text with
 * ligatures and kerning only, so where no ligature forms in what is drawn, a copy without layout lookups, which cuts
 * down to the glyphs drawn, draws the same. A monospaced face keeps its lookups: coding fonts form their ligatures
 * as contextual alternates of the same width, which only the browser applies.
 */
const cuttable = (face: Font, runs: readonly TextRun[]): Font => {
  if (!face.ligatures || !face.subset || face.format !== "ttf" || runs.length === 0) return face;

  if (face.fallback.includes("monospace")) return face;

  const twin = twinOf(face);

  // A ligature changes how many glyphs a line has, and so its width.
  return twin && runs.every((run) => face.measure(run.text, 100) === twin.measure(run.text, 100))
    ? twin
    : face;
};

/** Every run under `item`, by the family it is set in. */
export const runsByFamily = (
  item: Item,
  out = new Map<string, TextRun[]>(),
): Map<string, TextRun[]> => {
  const add = (run: TextRun) => out.set(run.family, [...(out.get(run.family) ?? []), run]);

  const vectors = (v: Vector) => {
    if (v.run) add(v.run);

    for (const c of [...(v.mask ?? []), ...v.children]) vectors(c);
  };

  if (item.kind === "text") add(item);
  else if (item.kind === "box") for (const child of item.children) runsByFamily(child, out);
  else if (item.kind === "graphic") item.children.forEach(vectors);

  return out;
};

/** One family of `fonts`, as svjeez takes several faces under one name. */
const familyOf = (fonts: readonly Font[]): FontValue | undefined => {
  const [first, ...rest] = fonts;

  return first && (rest.length === 0 ? first : font.family(first, ...rest));
};

/** One `FontFamily`, when every face is a whole file of one weight and style. */
const asFamily = (faces: readonly Face[]): FontValue | undefined => {
  const kinds = new Set(faces.map((f) => `${f.weight} ${f.style}`));

  if (kinds.size !== faces.length || faces.some(isWholeFile)) return undefined;

  const fonts = faces.flatMap((f) => fontOf(f) ?? []);
  const [first, ...rest] = fonts;

  return first && fonts.length === faces.length ? font.family(first, ...rest) : undefined;
};

/** The page's own `@font-face` rule for a face svjeez can't hold as a `Font`: a range, or a variable weight. */
const faceRule = (face: Face): string =>
  fontFace(face, face.src, formatOf(face.src.slice("data:font/".length, face.src.indexOf(";"))));

/**
 * The fonts text is drawn in, by family name, and `@font-face` rules for the page's faces svjeez can't embed itself.
 * Faces that share a family name become one family, so `font-weight` picks among them as on the page. The page's own
 * fonts fill in for families `given` doesn't cover: a family svjeez can hold as one face per weight and style becomes
 * a `Font`, so it embeds only where drawn and a TTF is cut down; the rest embed as the page had them.
 */
export const typefaces = (
  given: readonly FontValue[],
  captured: readonly Face[],
  drawn: ReadonlyMap<string, readonly TextRun[]> = new Map(),
) => {
  const byName = new Map<string, FontValue>();
  const grouped = new Map<string, Font[]>();

  for (const value of given) {
    const runs = drawn.get("faces" in value ? value.name : value.family) ?? [];

    if ("faces" in value) {
      // Each face against the runs the browser set in it.
      const [first, ...rest] = value.faces.map((f) =>
        cuttable(
          f,
          runs.filter((r) => value.face(r.weight, r.style) === f),
        ),
      );

      byName.set(value.name, first ? font.family(first, ...rest) : value);
    } else grouped.set(value.family, [...(grouped.get(value.family) ?? []), cuttable(value, runs)]);
  }

  for (const [name, faces] of grouped) {
    const family = familyOf(faces);

    if (family) byName.set(name, family);
  }

  const rules: string[] = [];

  for (const [name, list] of byFamily(captured)) {
    if (byName.has(name)) continue;

    const family = asFamily(list);

    if (family) byName.set(name, family);
    else rules.push(...list.map(faceRule));
  }

  return { byName, rules };
};
