import { Font, FontFamily, type FontValue } from "../font/font";
import type { Face } from "../model/ir";
import type { RunProps, RunStyle, SceneElement, TextChild } from "./nodes";

/** What a stretch of text asks to be drawn in: the `<Text>`'s own props, with each `<Run>` around it laid over. */
export type Asked = RunStyle & Required<Pick<RunStyle, "font">>;

export interface AskedPiece {
  readonly text: string;
  /** One object for every piece of one run, so a caller can lower each style once. */
  readonly asked: Asked;
}

const isList = (child: TextChild): child is readonly TextChild[] => Array.isArray(child);

const isWords = (child: TextChild): child is string | number =>
  typeof child === "string" || typeof child === "number";

const isRun = (child: SceneElement): child is { readonly type: "run"; readonly props: RunProps } =>
  child.type === "run";

const isElement = (child: TextChild): child is SceneElement =>
  typeof child === "object" && child !== null && !isList(child);

/** `style` with what `run` says laid over it. */
const over = (style: Asked, run: RunProps): Asked => ({
  ...style,
  ...(run.font !== undefined && { font: run.font }),
  ...(run.weight !== undefined && { weight: run.weight }),
  ...(run.italic !== undefined && { italic: run.italic }),
  ...(run.fill !== undefined && { fill: run.fill }),
  ...(run.opacity !== undefined && { opacity: run.opacity }),
});

/** A text's children as pieces of text, in order, each with the style it asks for. */
export const piecesOf = (children: TextChild, style: Asked, where: string): AskedPiece[] => {
  if (children === undefined || children === null || children === false) return [];

  if (isWords(children)) return [{ text: String(children), asked: style }];

  if (isList(children)) return children.flatMap((child) => piecesOf(child, style, where));

  if (isElement(children) && isRun(children))
    return piecesOf(children.props.children, over(style, children.props), where);

  throw new Error(
    `Text ${where} holds ${isElement(children) ? `a <${children.type[0]!.toUpperCase()}${children.type.slice(1)}>` : String(children)}. A <Text> holds strings and <Run>s; put other nodes beside it, in a <Group> or a <Stack>.`,
  );
};

const nameOf = (value: FontValue): string => (value instanceof Font ? value.family : value.name);

const faceName = (family: string, weight: number, style: Face["style"]): string =>
  `${family} ${weight}${style === "italic" ? " italic" : ""}`;

/**
 * The face `weight` and `italic` pick from `value`, which must have it: text is measured with the real face, so
 * there is no nearest match and no bold or slant the browser makes up.
 */
export const faceOf = (
  value: FontValue,
  weight: number | undefined,
  italic: boolean | undefined,
  where: string,
): Font => {
  if (weight !== undefined && !(weight >= 1 && weight <= 1000))
    throw new Error(`Text ${where} needs a weight between 1 and 1000, got ${weight}.`);

  if (value instanceof Font) {
    const style = italic === undefined ? value.style : italic ? "italic" : "normal";

    if ((weight ?? value.weight) === value.weight && style === value.style) return value;

    throw new Error(
      `Text ${where} asks for ${faceName(value.family, weight ?? value.weight, style)}, but its font is the one face ${faceName(value.family, value.weight, value.style)}. Load that face too and pass font.family(…) or google.family("${value.family}", […]), or ask for ${value.weight}${value.style === "italic" ? " italic" : ""}.`,
    );
  }

  const style = italic ? "italic" : "normal";
  const asked = weight ?? 400;
  const found = value.faces.find((face) => face.weight === asked && face.style === style);

  if (found) return found;

  const has = value.faces.map(
    (face) => `${face.weight}${face.style === "italic" ? " italic" : ""}`,
  );

  throw new Error(
    `Text ${where} asks for ${faceName(value.name, asked, style)}, which its family doesn't have: it has ${has.join(", ")}. Load that face into the family, or ask for one it has.`,
  );
};

/** A face as runs name it, and the file the scene embeds for it. */
interface Picked {
  readonly face: Face;
  readonly font: Font;
}

interface Family {
  readonly faces: Font[];
}

/** The faces a scene's text uses, each once, by family: what `Scene.fonts` holds. */
export class FontBook {
  readonly #families = new Map<string, Family>();

  /** `face`, picked from `value`, as runs name it. Two different files can't be one family's same face. */
  add(value: FontValue, face: Font): Picked {
    const family = nameOf(value);
    const known = this.#families.get(family) ?? { faces: [] };

    const same = known.faces.find(
      (each) => each.weight === face.weight && each.style === face.style,
    );

    if (same && same !== face && same.href !== face.href)
      throw new Error(
        `Two different fonts are both ${faceName(family, face.weight, face.style)}. Give one another family name with font(bytes, { family }).`,
      );

    if (!same) known.faces.push(face);
    this.#families.set(family, known);

    return { face: { family, weight: face.weight, style: face.style }, font: same ?? face };
  }

  /**
   * Each family with no fallback: text is measured with the face it names and every character it draws is in that
   * face, so no other face ever draws one.
   */
  families(): Record<string, FontFamily> {
    return Object.fromEntries(
      [...this.#families].map(([name, { faces }]) => [name, new FontFamily(name, faces, [])]),
    );
  }

  /**
   * The characters of `text` that `font` has no glyph for. White space, control and format characters and variation
   * selectors draw nothing of their own, so they are never missing.
   */
  static missing(font: Font, text: string): string[] {
    return [...new Set([...text].filter((char) => !drawsNothing(char) && !hasGlyph(font, char)))];
  }
}

/** Whether a character draws nothing of its own: white space, a control or format character, a variation selector. */
const drawsNothing = (char: string): boolean => /^[\s\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}]$/u.test(char);

/** Whether `font` has a glyph for `char`. A face whose glyph table can't be read is taken at its word. */
const hasGlyph = (font: Font, char: string): boolean => {
  try {
    return font.has(char);
  } catch {
    return true;
  }
};

/** How a character reads in an error: itself and its code point. */
export const charName = (char: string): string =>
  `"${char}" (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`;
