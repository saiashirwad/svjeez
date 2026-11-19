import { cssFontStyle, fontFaceRule, fontFaces, isFontValue, type Font } from "./font";
import type { AttrValue, Element } from "../svg/tree";

interface Face {
  readonly name: string;
  readonly font: Font;
}

export interface FontCtx {
  readonly family: readonly Face[] | null;
  readonly weight: number | null;
  readonly style: string | null;
}

interface TextRun {
  readonly text: string;
  readonly family: readonly string[] | null;
  readonly exact: readonly string[];
}

export interface FontUse {
  readonly runs: TextRun[];
  readonly css: { family: boolean; weight: boolean };
}

export const UNKNOWN_FONT: FontCtx = { family: null, weight: null, style: null };

export const newFontUse = (): FontUse => ({ runs: [], css: { family: false, weight: false } });

export const slotOf = (name: string, font: Font): string =>
  `'${name}' ${font.weight} ${cssFontStyle(font)}`;

const FONT_FAMILY_CSS = /font-family|(?:^|[\s;{}"'])font\s*:/i;
const FONT_WEIGHT_CSS = /font-(?:weight|style|stretch)|(?:^|[\s;{}"'])font\s*:/i;

export const noteCss = (use: FontUse, css: string): void => {
  use.css.family ||= FONT_FAMILY_CSS.test(css);
  use.css.weight ||= FONT_WEIGHT_CSS.test(css);
};

const weightOf = (value: AttrValue): number | null => {
  const text = String(value).trim();

  if (text === "normal") return 400;

  if (text === "bold") return 700;

  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
};

const styleOf = (value: AttrValue): string | null => {
  const text = String(value).trim();

  return text === "normal" || text === "italic" ? text : null;
};

export const fontOf = (
  prefix: string,
  own: Element["attrs"],
  attrs: Element["attrs"],
  parent: FontCtx,
): FontCtx => {
  if (attrs.font !== undefined || /font/i.test(String(attrs.style))) return UNKNOWN_FONT;

  const given = own["font-family"] ?? own.fontFamily;
  const weight = attrs["font-weight"] ?? attrs.fontWeight;
  const style = attrs["font-style"] ?? attrs.fontStyle;

  return {
    family:
      given === undefined
        ? parent.family
        : isFontValue(given)
          ? fontFaces(given).faces.map(({ name, font }) => ({ name: prefix + name, font }))
          : null,
    weight: weight === undefined ? parent.weight : weightOf(weight),
    style: style === undefined ? parent.style : styleOf(style),
  };
};

export const noteText = (use: FontUse, text: string, ctx: FontCtx): void => {
  if (ctx.family === null) {
    use.runs.push({ text, family: null, exact: [] });

    return;
  }

  const slots = ctx.family.map(({ name, font }) => slotOf(name, font));

  const exact = ctx.family.flatMap(({ font }, i) =>
    (ctx.weight === null || font.weight === ctx.weight) &&
    (ctx.style === null || cssFontStyle(font) === ctx.style)
      ? [slots[i]!]
      : [],
  );

  use.runs.push({ text, family: slots, exact: exact.length > 0 ? exact : slots });
};

export const faceRules = (use: FontUse, faces: readonly Face[]): string[] => {
  const every = use.runs.map((run) => run.text);
  const shared = use.runs.filter((run) => run.family === null).map((run) => run.text);

  const files = faces.filter(({ font }) => font.format !== "system");

  return files.map(({ name, font }) => {
    const slot = slotOf(name, font);

    if (use.css.family) return fontFaceRule(name, font, every);

    const own = use.runs
      .filter((run) => (use.css.weight ? run.family : run.exact)?.includes(slot))
      .map((run) => run.text);

    return fontFaceRule(name, font, [...shared, ...own]);
  });
};
