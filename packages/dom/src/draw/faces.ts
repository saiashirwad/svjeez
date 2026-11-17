import { font, type Font, type FontValue } from "svjeez";
import { fontFace, formatOf, isWholeFile } from "../fonts.ts";
import type { Face, Item, TextRun, Vector } from "../tree.ts";

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

const cuttable = (face: Font, runs: readonly TextRun[]): Font => {
  if (!face.ligatures || !face.subset || face.format !== "ttf" || runs.length === 0) return face;

  if (face.fallback.includes("monospace")) return face;

  const twin = twinOf(face);

  return twin && runs.every((run) => face.measure(run.text, 100) === twin.measure(run.text, 100))
    ? twin
    : face;
};

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

const familyOf = (fonts: readonly Font[]): FontValue | undefined => {
  const [first, ...rest] = fonts;

  return first && (rest.length === 0 ? first : font.family(first, ...rest));
};

const asFamily = (faces: readonly Face[]): FontValue | undefined => {
  const kinds = new Set(faces.map((f) => `${f.weight} ${f.style}`));

  if (kinds.size !== faces.length || faces.some(isWholeFile)) return undefined;

  const fonts = faces.flatMap((f) => fontOf(f) ?? []);
  const [first, ...rest] = fonts;

  return first && fonts.length === faces.length ? font.family(first, ...rest) : undefined;
};

const faceRule = (face: Face): string =>
  fontFace(face, face.src, formatOf(face.src.slice("data:font/".length, face.src.indexOf(";"))));

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
