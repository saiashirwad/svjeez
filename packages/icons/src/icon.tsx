/** @jsxImportSource svjeez */
import { Group, Instance, Shape, pathData, symbol } from "svjeez";
import type { Anim, Geometry, Paint, SceneElement, Vec } from "svjeez";
import {
  SceneError,
  type Color,
  type Common,
  type Framed,
  type Model,
  type SceneSymbol,
} from "svjeez/tools";

export interface IconData {
  readonly grid: number;
  readonly kind: "stroke" | "fill";
  readonly paths: readonly string[];
}

type PerPiece = (piece: number, pieces: number) => Anim<Vec>;

export type IconTrim = Anim<Vec> | PerPiece;

interface Base extends Common, Framed {
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

const shares = new WeakMap<IconData, Map<Color, Map<string, SceneSymbol>>>();

const isOutline = (geometry: Geometry): geometry is Model.Geometry => "kind" in geometry;

const scaled = (d: string, by: number): Geometry => {
  const geometry = pathData(d);

  if (by === 1 || !isOutline(geometry) || geometry.kind !== "path") return geometry;
  const grow = ([x, y]: Vec): Vec => [x * by, y * by];

  return {
    ...geometry,
    contours: geometry.contours.map((contour) => ({
      ...contour,
      start: grow(contour.start),
      curves: contour.curves.map(([a, b, to]): Model.Cubic => [grow(a), grow(b), grow(to)]),
    })),
  };
};

interface PieceProps {
  readonly key: string;
  readonly icon: IconData;
  readonly index: number;
  readonly color: Anim<Paint>;
  readonly width: number;
  readonly by: number;
  readonly trim: Anim<Vec> | undefined;
}

const Piece = ({ icon, index, color, width, by, trim }: PieceProps): SceneElement => (
  <Shape
    geometry={scaled(icon.paths[index]!, by)}
    fill={icon.kind === "stroke" ? undefined : color}
    stroke={icon.kind === "stroke" ? { color, width, cap: "round", join: "round" } : undefined}
    trim={trim}
  />
);

const drawn = (
  icon: IconData,
  color: Anim<Paint>,
  width: number,
  by: number,
  trim: IconTrim | undefined,
): SceneElement[] =>
  icon.paths.map((_, index) => (
    <Piece
      key={`piece-${index + 1}`}
      icon={icon}
      index={index}
      color={color}
      width={width}
      by={by}
      trim={isPerPiece(trim) ? trim(index, icon.paths.length) : trim}
    />
  ));

const sharedSymbol = (icon: IconData, color: Color, width: number, by: number): SceneSymbol => {
  const byColor = shares.get(icon) ?? new Map<Color, Map<string, SceneSymbol>>();
  const bySize = byColor.get(color) ?? new Map<string, SceneSymbol>();
  const name = `${width}/${by}`;

  const made =
    bySize.get(name) ?? symbol(() => <Group>{drawn(icon, color, width, by, undefined)}</Group>);

  bySize.set(name, made);
  byColor.set(color, bySize);
  shares.set(icon, byColor);

  return made;
};

export function Icon(props: IconProps): SceneElement {
  const { icon, size = icon?.grid, width, color: _c, trim: _t, shared: _s, ...placement } = props;

  check(icon, size, props);
  const by = size / icon.grid;
  const stroke = (width ?? WIDTH) * by;

  if (props.shared)
    return <Instance {...placement} of={sharedSymbol(icon, props.color, stroke, by)} />;

  return <Group {...placement}>{drawn(icon, props.color, stroke, by, props.trim)}</Group>;
}
