import { SceneError } from "../model/scene-error";
import { Font, FontFamily, type FontValue } from "../font/font";
import type { Face } from "../model/ir";
import type { RunProps, RunStyle, SceneElement } from "./nodes";
import { isCount, type TextContent } from "./count";

export type Asked = RunStyle & Required<Pick<RunStyle, "font">>;

export interface AskedPiece {
  readonly text: string;
  readonly asked: Asked;
}

const isList = (child: TextContent): child is readonly TextContent[] => Array.isArray(child);

const isWords = (child: TextContent): child is string | number =>
  typeof child === "string" || typeof child === "number";

const isRun = (child: SceneElement): child is { readonly type: "run"; readonly props: RunProps } =>
  child.type === "run";

const isElement = (child: TextContent): child is SceneElement =>
  typeof child === "object" && child !== null && !isList(child) && !isCount(child);

const over = (style: Asked, run: RunProps): Asked => ({
  ...style,
  ...(run.font !== undefined && { font: run.font }),
  ...(run.weight !== undefined && { weight: run.weight }),
  ...(run.italic !== undefined && { italic: run.italic }),
  ...(run.fill !== undefined && { fill: run.fill }),
  ...(run.opacity !== undefined && { opacity: run.opacity }),
});

export const piecesOf = (children: TextContent, style: Asked, where: string): AskedPiece[] => {
  if (children === undefined || children === null || children === false) return [];

  if (isCount(children))
    throw new SceneError(
      `${where} holds a count() inside a <Run>, and a count goes straight in its <Text>.`,
      "Write <Text …>{count(…)}</Text>, and style the whole <Text>.",
    );

  if (isWords(children)) return [{ text: String(children), asked: style }];

  if (isList(children)) return children.flatMap((child) => piecesOf(child, style, where));

  if (isElement(children) && isRun(children))
    return piecesOf(children.props.children, over(style, children.props), where);

  throw new SceneError(
    `${where} holds ${isElement(children) ? `a <${children.type[0]!.toUpperCase()}${children.type.slice(1)}>` : String(children)}. A <Text> holds strings and <Run>s; put other nodes beside it, in a <Group> or a <Stack>.`,
  );
};

const nameOf = (value: FontValue): string => (value instanceof Font ? value.family : value.name);

const faceName = (family: string, weight: number, italic: boolean): string =>
  `${family} ${weight}${italic ? " italic" : ""}`;

export const faceOf = (
  value: FontValue | undefined,
  weight: number | undefined,
  italic: boolean | undefined,
  where: string,
): Font => {
  if (!(value instanceof Font) && !(value instanceof FontFamily))
    throw new SceneError(
      value === undefined
        ? `${where} has no font.`
        : `${where} takes a font made by font(), font.load(), font.family() or @svjeez/fonts, got ${String(value)}.`,
      value === undefined
        ? 'Give it one: font={await font.load("Inter.ttf")}, or a family from @svjeez/fonts such as font={await google("Inter")}. There is no default font and nothing is inherited.'
        : undefined,
    );

  if (weight !== undefined && !(weight >= 1 && weight <= 1000))
    throw new SceneError(`${where} needs a weight between 1 and 1000, got ${weight}.`);

  if (value instanceof Font) {
    const slanted = italic ?? value.italic;

    if ((weight ?? value.weight) === value.weight && slanted === value.italic) return value;

    throw new SceneError(
      `${where} asks for ${faceName(value.family, weight ?? value.weight, slanted)}, but its font is the one face ${faceName(value.family, value.weight, value.italic)}. Load that face too and pass font.family(…) or google.family("${value.family}", […]), or ask for ${value.weight}${value.italic ? " italic" : ""}.`,
    );
  }

  const slanted = italic ?? false;
  const asked = weight ?? 400;
  const found = value.faces.find((face) => face.weight === asked && face.italic === slanted);

  if (found) return found;

  const has = value.faces.map((face) => `${face.weight}${face.italic ? " italic" : ""}`);

  throw new SceneError(
    `${where} asks for ${faceName(value.name, asked, slanted)}, which its family doesn't have: it has ${has.join(", ")}. Load that face into the family, or ask for one it has.`,
  );
};

interface Picked {
  readonly face: Face;
  readonly font: Font;
}

interface Family {
  readonly faces: Font[];
}

export class FontBook {
  readonly #families = new Map<string, Family>();

  add(value: FontValue, face: Font): Picked {
    const family = nameOf(value);
    const known = this.#families.get(family) ?? { faces: [] };

    const same = known.faces.find(
      (each) => each.weight === face.weight && each.italic === face.italic,
    );

    if (same && same !== face && same.href !== face.href)
      throw new SceneError(
        `Two different fonts are both ${faceName(family, face.weight, face.italic)}. Give one another family name with font(bytes, { family }).`,
      );

    if (!same) known.faces.push(face);
    else if (same.subset && !face.subset) known.faces[known.faces.indexOf(same)] = face;
    this.#families.set(family, known);

    return {
      face: { family, weight: face.weight, italic: face.italic },
      font: known.faces.find((each) => each.weight === face.weight && each.italic === face.italic)!,
    };
  }

  families(): Record<string, FontFamily> {
    return Object.fromEntries(
      [...this.#families].map(([name, { faces }]) => [name, new FontFamily(name, faces, [])]),
    );
  }

  static missing(font: Font, text: string): string[] {
    return [...new Set([...text].filter((char) => !drawsNothing(char) && !hasGlyph(font, char)))];
  }
}

const drawsNothing = (char: string): boolean => /^[\s\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}]$/u.test(char);

const hasGlyph = (font: Font, char: string): boolean => {
  try {
    return font.has(char);
  } catch {
    return true;
  }
};

export const charName = (char: string): string =>
  `"${char}" (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`;
