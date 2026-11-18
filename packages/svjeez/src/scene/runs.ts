import { Font, FontFamily, type FontValue } from "../font/font";
import type { Face } from "./ir";
import type { RunStyle, SceneElement, SpanProps, TextChild } from "./nodes";

/** What a stretch of text asks to be drawn in: the `<Text>`'s own props, with each `<Span>` around it laid over. */
export type Asked = RunStyle & Required<Pick<RunStyle, "font" | "fill">>;

export interface AskedPiece {
  readonly text: string;
  /** One object for every piece of one span, so a caller can lower each style once. */
  readonly asked: Asked;
}

const isList = (child: TextChild): child is readonly TextChild[] => Array.isArray(child);

const isWords = (child: TextChild): child is string | number =>
  typeof child === "string" || typeof child === "number";

const isSpan = (
  child: SceneElement,
): child is { readonly type: "span"; readonly props: SpanProps } => child.type === "span";

const isElement = (child: TextChild): child is SceneElement =>
  typeof child === "object" && child !== null && !isList(child);

/** `style` with what `span` says laid over it. */
const over = (style: Asked, span: SpanProps): Asked => ({
  ...style,
  ...(span.font !== undefined && { font: span.font }),
  ...(span.weight !== undefined && { weight: span.weight }),
  ...(span.italic !== undefined && { italic: span.italic }),
  ...(span.fill !== undefined && { fill: span.fill }),
  ...(span.opacity !== undefined && { opacity: span.opacity }),
});

/** A text's children as pieces of text, in order, each with the style it asks for. */
export const piecesOf = (children: TextChild, style: Asked, where: string): AskedPiece[] => {
  if (children === undefined || children === null || children === false) return [];

  if (isWords(children)) return [{ text: String(children), asked: style }];

  if (isList(children)) return children.flatMap((child) => piecesOf(child, style, where));

  if (isElement(children) && isSpan(children))
    return piecesOf(children.props.children, over(style, children.props), where);

  throw new Error(
    `Text ${where} holds ${isElement(children) ? `a <${children.type[0]!.toUpperCase()}${children.type.slice(1)}>` : String(children)}. A <Text> holds strings and <Span>s; put other nodes beside it, in a <Group> or a <Stack>.`,
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
  readonly fallback: readonly string[];
  readonly faces: Font[];
}

/** The faces a scene's text uses, each once, by family: what `Scene.fonts` holds. */
export class FontBook {
  readonly #families = new Map<string, Family>();

  /** `face`, picked from `value`, as runs name it. Two different files can't be one family's same face. */
  add(value: FontValue, face: Font): Picked {
    const family = nameOf(value);
    const known = this.#families.get(family) ?? { fallback: value.fallback, faces: [] };

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

  families(): Record<string, FontFamily> {
    return Object.fromEntries(
      [...this.#families].map(([name, { fallback, faces }]) => [
        name,
        new FontFamily(name, faces, fallback),
      ]),
    );
  }
}
