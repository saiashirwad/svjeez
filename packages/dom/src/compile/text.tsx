/** @jsxImportSource svjeez */
import { Run, Shape, Text, blur, font, rect, shadow, type SceneElement } from "svjeez";
import type { Effect, Font } from "svjeez/tools";
import type { Run as Captured, TextNode } from "../schema.ts";
import { painted, type Context, type Solid } from "./context.ts";
import { add, sub, type Vec } from "./geometry.ts";
import { bytesOf } from "./image.tsx";

/** The embedded web font that is `family` at this weight and slant, or the closest weight of it. */
const embedded = (ctx: Context, family: string, weight: number, italic: boolean) =>
  ctx.faces
    .filter(
      (one) =>
        one.family.toLowerCase() === family.toLowerCase() &&
        one.italic === italic &&
        one.src.startsWith("data:"),
    )
    .sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0];

/** `"Helvetica Neue", Arial, sans-serif` as the page's embedded font of that name, or else a system font. */
const face = (ctx: Context, { family, weight, italic }: Captured["font"]): Font => {
  const id = `${family}\0${weight}\0${italic}`;
  const known = ctx.fonts.get(id);

  if (known) return known;

  const [first = "sans-serif", ...fallback] = family
    .split(",")
    .map((name) => name.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  const web = embedded(ctx, first, weight, italic);
  const bytes = web && bytesOf(web.src);
  let made: Font | undefined;

  if (bytes)
    try {
      made = font(bytes, { family: first, weight, italic });
    } catch (error) {
      ctx.note(
        first,
        `the web font ${first} could not be read, so it is a system font (${error instanceof Error ? error.message : String(error)})`,
      );
    }

  made ??= font.system(first, { weight, italic, ...(fallback.length > 0 && { fallback }) });

  ctx.fonts.set(id, made);

  return made;
};

/** Where a decoration's line starts below the baseline, in em, and how it is anchored: by its top. */
const LINES = {
  underline: (size: number) => size * 0.1,
  overline: (size: number) => -size * 0.9,
  "line-through": (size: number, thickness: number) => -size * 0.3 - thickness / 2,
} as const;

const run = (one: Captured, at: Vec, key: string, ctx: Context): SceneElement[] => {
  const fill = painted(one.color);
  const width = one.advances.reduce((sum, advance) => sum + advance, 0);
  const out: SceneElement[] = [];

  if (fill && one.text !== "") {
    const glyphs = (key: string, color: Solid, where: Vec, effects?: Effect[]) => (
      <Text
        key={key}
        font={face(ctx, one.font)}
        size={one.font.size}
        fill={color}
        {...(one.letterSpacing !== 0 && { letterSpacing: one.letterSpacing })}
        {...(effects && { effects })}
        at={where}
        anchor="baseline-left"
      >
        <Run advances={one.advances}>{one.text}</Run>
      </Text>
    );

    const shadows = (one.shadows ?? []).flatMap((s) => {
      const paint = painted(s.color);

      const offset: Vec = [s.x, s.y];

      // A blur radius, as in `box-shadow`: a deviation of half of it.
      return paint ? [{ paint, offset, sigma: s.blur / 2 }] : [];
    });

    const [only, ...more] = shadows;

    if (only && more.length === 0)
      out.push(
        glyphs(key, fill.rgba, at, [
          shadow({
            color: only.paint.hex,
            offset: only.offset,
            blur: only.sigma,
            opacity: only.paint.alpha,
          }),
        ]),
      );
    else {
      // A shadow of the text and the shadows below it would shadow those too, so each shadow is its own copy of the glyphs.
      // CSS paints the first shadow on top.
      [...shadows]
        .reverse()
        .forEach(({ paint, offset, sigma }, i) =>
          out.push(
            glyphs(
              `${key}-shadow${shadows.length - i}`,
              paint.rgba,
              add(at, offset),
              sigma > 0 ? [blur(sigma)] : undefined,
            ),
          ),
        );

      out.push(glyphs(key, fill.rgba, at));
    }
  }

  const line = one.decoration && painted(one.decoration.color);

  if (one.decoration && line)
    for (const name of one.decoration.lines)
      out.push(
        <Shape
          key={`${key}-${name}`}
          geometry={rect(width, one.decoration.thickness)}
          at={[at[0], at[1] + LINES[name](one.font.size, one.decoration.thickness)]}
          fill={line.rgba}
        />,
      );

  return out;
};

/** A text node's line fragments, positioned by their baseline in the parent's frame `origin`. */
export const text = (node: TextNode, origin: Vec, key: string, ctx: Context): SceneElement[] =>
  node.runs.flatMap((one, i) => run(one, sub([one.x, one.y], origin), `${key}.${i}`, ctx));
