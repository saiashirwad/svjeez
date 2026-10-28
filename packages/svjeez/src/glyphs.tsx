import type { Paint } from "./attributes";
import type { TagChannels } from "./channels";
import type { Ref } from "./defs";
import {
  regularFace,
  type Font,
  type FontFamily,
  type FontStyle,
  type GlyphPath,
} from "./font/font";
import type { Stack } from "./motion";
import type { SvgNode } from "./svg";

type GlyphStack = Stack<TagChannels<"path">>;

const isPerGlyph = (
  animation: GlyphsProps["animation"],
): animation is (glyph: GlyphPath, index: number) => GlyphStack =>
  typeof animation === "function";

export interface GlyphsProps {
  readonly font: Font | FontFamily;
  /** From a family, the face nearest this weight and style. Default 400, normal. */
  readonly weight?: number;
  readonly style?: FontStyle;
  readonly text: string;
  /** Font size in px. */
  readonly size: number;
  /** The left end of the baseline. */
  readonly x?: number;
  readonly y?: number;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly filter?: Ref<"filter">;
  readonly class?: string;
  /** What assistive tech reads. Default `text`. */
  readonly alt?: string;
  /**
   * Runs on every glyph. Pass a function to vary it by glyph, as in `(glyph, i) => draw({ at: i * 0.1, over: 1 })`.
   * To move the whole word as one, wrap it in an animated `<g>`.
   */
  readonly animation?: GlyphStack | ((glyph: GlyphPath, index: number) => GlyphStack);
}

/** A line of text drawn as one path per glyph. No font is embedded; the outlines are the drawing. */
export function Glyphs({
  font,
  weight,
  style,
  text,
  size,
  x = 0,
  y = 0,
  fill,
  stroke,
  strokeWidth,
  opacity,
  filter,
  class: className,
  alt,
  animation,
}: GlyphsProps): SvgNode {
  const face =
    "faces" in font
      ? weight === undefined && style === undefined
        ? regularFace(font)
        : font.face(weight, style)
      : font;

  const glyphs = face.path(text, { size, x, y }).glyphs;

  return (
    <g
      role="img"
      aria-label={alt ?? text}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      filter={filter}
      class={className}
    >
      {glyphs.map(
        (glyph, index) =>
          glyph.d && (
            <path
              d={glyph.d}
              animation={isPerGlyph(animation) ? animation(glyph, index) : animation}
            />
          ),
      )}
    </g>
  );
}
