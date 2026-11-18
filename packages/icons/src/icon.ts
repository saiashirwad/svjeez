import { Group, Instance, Shape, pathData, symbol } from "svjeez";
import type { Anim, Paint, SceneElement, Vec } from "svjeez";
import { SceneError, type Color, type Common, type SceneSymbol } from "svjeez/tools";

export interface IconData {
  readonly grid: number;
  readonly kind: "stroke" | "fill";
  readonly paths: readonly string[];
}

type PerPiece = (piece: number, pieces: number) => Anim<Vec>;

export type IconTrim = Anim<Vec> | PerPiece;

interface Base extends Common {
  readonly icon: IconData;
  readonly size?: number;
  readonly width?: number;
}

export interface OwnIconProps extends Base {
  readonly color: Anim<Paint>;
  readonly trim?: IconTrim;
  readonly shared?: false;
}

export interface SharedIconProps extends Base {
  readonly color: Color;
  readonly shared: true;
  readonly trim?: undefined;
}

export type IconProps = OwnIconProps | SharedIconProps;

const WIDTH = 2;

const isColor = (color: Anim<Paint>): color is Color =>
  typeof color === "string" ||
  (typeof color === "object" && "kind" in color && color.kind === "token");

const positive = (value: number): boolean => Number.isFinite(value) && value > 0;

const isPerPiece = (trim: IconTrim | undefined): trim is PerPiece => typeof trim === "function";

const check = (icon: IconData, size: number, props: IconProps): void => {
  if (!icon || !Array.isArray(icon.paths))
    throw new SceneError(
      "<Icon> has no icon to draw.",
      'Import one, as in import { rocket } from "@svjeez/icons/tabler", or pass { grid, kind, paths } of your own.',
    );

  if (!positive(icon.grid))
    throw new SceneError(
      `<Icon> has an icon whose grid is ${String(icon.grid)}.`,
      "The grid is the positive side of the icon's square, such as 24.",
    );

  if (icon.kind !== "stroke" && icon.kind !== "fill")
    throw new SceneError(
      `<Icon> has an icon whose kind is ${JSON.stringify(icon.kind)}.`,
      'The kind is "stroke" for an outline or "fill" for a solid icon.',
    );

  if (!icon.paths.length || icon.paths.some((d) => !/^\s*[Mm]/.test(d)))
    throw new SceneError(
      "<Icon> has an icon whose paths are empty or are not path data.",
      'Give paths a list of path data strings, each starting with M, as in ["M4 12h16"].',
    );

  if (!positive(size))
    throw new SceneError(
      `<Icon> has a size of ${String(size)}.`,
      "Give it a positive size in pixels.",
    );

  if (props.width !== undefined && icon.kind === "fill")
    throw new SceneError(
      "<Icon> is given a width, but its icon is solid, so it has no outline to size.",
      "Drop width, or use an outline icon.",
    );

  if (props.width !== undefined && !positive(props.width))
    throw new SceneError(
      `<Icon> has a width of ${String(props.width)}.`,
      "Give it a positive width in the icon's own units, such as 2.",
    );

  if (props.trim !== undefined && icon.kind === "fill")
    throw new SceneError(
      "<Icon> is given a trim, but its icon is solid, so it has no outline to draw.",
      "Bring it in with motion, such as enter(), or use an outline icon.",
    );

  if (props.shared && !isColor(props.color))
    throw new SceneError(
      "<Icon> is shared, so it is drawn once for every use, but its color changes over time or is a gradient.",
      "Give it a hex color or a token, or drop shared.",
    );
};

const shares = new WeakMap<IconData, Map<Color, Map<number, SceneSymbol>>>();

const piece = (
  icon: IconData,
  d: string,
  index: number,
  color: Anim<Paint>,
  width: number,
  trim: Anim<Vec> | undefined,
): SceneElement =>
  Shape({
    key: `piece-${index + 1}`,
    geometry: pathData(d),
    ...(icon.kind === "stroke"
      ? { stroke: { color, width, cap: "round", join: "round" } }
      : { fill: color }),
    ...(trim !== undefined && { trim }),
  });

const drawn = (
  icon: IconData,
  color: Anim<Paint>,
  width: number,
  trim: IconTrim | undefined,
): SceneElement[] =>
  icon.paths.map((d, index) =>
    piece(icon, d, index, color, width, isPerPiece(trim) ? trim(index, icon.paths.length) : trim),
  );

const sharedSymbol = (icon: IconData, color: Color, width: number): SceneSymbol => {
  const byColor = shares.get(icon) ?? new Map<Color, Map<number, SceneSymbol>>();
  const byWidth = byColor.get(color) ?? new Map<number, SceneSymbol>();

  const made =
    byWidth.get(width) ?? symbol(() => Group({ children: drawn(icon, color, width, undefined) }));

  byWidth.set(width, made);
  byColor.set(color, byWidth);
  shares.set(icon, byColor);

  return made;
};

export function Icon(props: IconProps): SceneElement {
  const { icon, size = icon?.grid, width, color: _c, trim: _t, shared: _s, ...placement } = props;

  check(icon, size, props);
  const scale = size / icon.grid;
  const stroke = width ?? WIDTH;

  const body = props.shared
    ? Instance({ of: sharedSymbol(icon, props.color, stroke), scale, origin: [0, 0] })
    : Group({ scale, origin: [0, 0], children: drawn(icon, props.color, stroke, props.trim) });

  return Group({ ...placement, children: [body] });
}
