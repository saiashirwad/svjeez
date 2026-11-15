import { font, type Font, type FontValue } from "svjeez";
import { fontFace, formatOf } from "../fonts.ts";
import type { Face } from "../tree.ts";

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

/** One family of `fonts`, as svjeez takes several faces under one name. */
const familyOf = (fonts: readonly Font[]): FontValue | undefined => {
  const [first, ...rest] = fonts;

  return first && (rest.length === 0 ? first : font.family(first, ...rest));
};

/** One `FontFamily`, when every face is a whole file of one weight and style. */
const asFamily = (faces: readonly Face[]): FontValue | undefined => {
  const kinds = new Set(faces.map((f) => `${f.weight} ${f.style}`));

  if (kinds.size !== faces.length || faces.some((f) => f.unicodeRange || !/^\d+$/.test(f.weight)))
    return undefined;

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
export const typefaces = (given: readonly FontValue[], captured: readonly Face[]) => {
  const byName = new Map<string, FontValue>();
  const grouped = new Map<string, Font[]>();

  for (const value of given) {
    if ("faces" in value) byName.set(value.name, value);
    else grouped.set(value.family, [...(grouped.get(value.family) ?? []), value]);
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
