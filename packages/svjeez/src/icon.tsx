/** @jsxImportSource svjeez */
import type { Paint } from "./attributes";
import type { TagChannels } from "./channels";
import type { Ref } from "./defs";
import { num } from "./format";
import { eachOf, type Each } from "./each";
import type { Stack } from "./motion";
import type { SvgNode } from "./svg";

/** The shape of an icon from `@svjeez/icons`, or any path data of your own. */
export interface IconData {
  /** Side of the square viewBox the paths are drawn on. */
  readonly grid: number;
  /** "stroke" icons are outlines to stroke; "fill" icons are shapes to fill. */
  readonly kind: "stroke" | "fill";
  /** One path per drawn piece, in source order, so each can animate on its own. */
  readonly paths: readonly string[];
}

type IconStack = Stack<TagChannels<"path">>;

const isPerPath = (
  animation: IconProps["animation"],
): animation is (d: string, each: Each) => IconStack => typeof animation === "function";

export interface IconProps {
  readonly icon: IconData;
  /** The top-left corner. */
  readonly x?: number;
  readonly y?: number;
  /** Side of the icon in px. Default the icon's own grid. */
  readonly size?: number;
  /** Stroke icons only. Default `currentColor`. */
  readonly stroke?: Paint;
  /** Fill icons only. Default `currentColor`. */
  readonly fill?: Paint;
  /** Stroke icons only, in grid units, so it scales with `size`. Default 2. */
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly filter?: Ref<"filter">;
  readonly class?: string;
  /** What assistive tech reads. Without it the icon is hidden from it. */
  readonly alt?: string;
  /**
   * Runs on every path. Pass a function to vary it by path; its second argument says where the path is in the icon
   * and cascades it, as in `(d, each) => draw(each.stagger(span(0, 0.6), 0.1))`.
   * To move the whole icon as one, wrap it in an animated `<g>`.
   */
  readonly animation?: IconStack | ((d: string, each: Each) => IconStack);
}

/** An icon drawn as one path per piece, on a group scaled from its grid to `size`. */
export function Icon({
  icon,
  x = 0,
  y = 0,
  size = icon.grid,
  stroke,
  fill,
  strokeWidth = 2,
  opacity,
  filter,
  class: className,
  alt,
  animation,
}: IconProps): SvgNode {
  const scale = size / icon.grid;

  const transform = [
    x || y ? `translate(${num(x)} ${num(y)})` : "",
    scale === 1 ? "" : `scale(${num(scale, 4)})`,
  ]
    .filter(Boolean)
    .join(" ");

  const paint =
    icon.kind === "stroke"
      ? ({
          fill: "none",
          stroke: stroke ?? "currentColor",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth,
        } as const)
      : ({ fill: fill ?? "currentColor" } as const);

  return (
    <g
      transform={transform || undefined}
      {...paint}
      opacity={opacity}
      filter={filter}
      class={className}
      {...(alt === undefined ? { "aria-hidden": "true" } : { role: "img", "aria-label": alt })}
    >
      {icon.paths.map((d, index) => (
        <path
          d={d}
          animation={
            isPerPath(animation) ? animation(d, eachOf(index, icon.paths.length)) : animation
          }
        />
      ))}
    </g>
  );
}
