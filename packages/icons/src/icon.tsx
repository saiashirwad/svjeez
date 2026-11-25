/** @jsxImportSource svjeez */
import { Group, Shape, path, through } from "svjeez";
import type { Anim, Geometry, Paint, SceneElement, Vec } from "svjeez";
import { SceneError, type Common, type Model, type StrokeProps } from "svjeez/tools";

export interface IconData {
  readonly grid: number;
  readonly kind: "outline" | "solid";
  readonly paths: readonly string[];
}

type PerPiece = (piece: number, pieces: number) => Anim<number>;

export type IconDraw = Anim<number> | PerPiece;

interface Base extends Common {
  readonly icon: IconData;
  readonly size?: number;
  /** Over the default outline, whose width is in the icon's own grid units. */
  readonly stroke?: Partial<StrokeProps>;
}

export interface IconProps extends Base {
  readonly color: Anim<Paint>;
  readonly draw?: IconDraw;
}

const WIDTH = 2;

const positive = (value: number): boolean => Number.isFinite(value) && value > 0;

const isPerPiece = (draw: IconDraw | undefined): draw is PerPiece => typeof draw === "function";

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

  if (icon.kind !== "outline" && icon.kind !== "solid")
    throw new SceneError(
      `<Icon> has an icon whose kind is ${JSON.stringify(icon.kind)}.`,
      'The kind is "outline" or "solid".',
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

  if (props.stroke !== undefined && icon.kind === "solid")
    throw new SceneError(
      "<Icon> is given a stroke, but its icon is solid, so it has no outline to style.",
      "Drop stroke, or use an outline icon.",
    );

  if (props.stroke?.width !== undefined)
    through(props.stroke.width, (width) => {
      if (!positive(width))
        throw new SceneError(
          `<Icon> has a stroke width of ${String(width)}.`,
          "Give it a positive width in the icon's own units, such as 2.",
        );
    });

  if (props.draw !== undefined && icon.kind === "solid")
    throw new SceneError(
      "<Icon> is given a draw, but its icon is solid, so it has no outline to draw.",
      "Bring it in with motion, such as enter(), or use an outline icon.",
    );
};

const isOutline = (geometry: Geometry): geometry is Model.Geometry => "kind" in geometry;

const scaled = (d: string, by: number): Geometry => {
  const geometry = path.parse(d);

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
  readonly stroke: StrokeProps;
  readonly by: number;
  readonly draw: Anim<number> | undefined;
}

const Piece = ({ icon, index, color, stroke, by, draw }: PieceProps): SceneElement => (
  <Shape
    geometry={scaled(icon.paths[index]!, by)}
    fill={icon.kind === "outline" ? undefined : color}
    stroke={icon.kind === "outline" ? stroke : undefined}
    draw={draw}
  />
);

const drawn = (
  icon: IconData,
  color: Anim<Paint>,
  stroke: StrokeProps,
  by: number,
  draw: IconDraw | undefined,
): SceneElement[] =>
  icon.paths.map((_, index) => (
    <Piece
      key={`piece-${index + 1}`}
      icon={icon}
      index={index}
      color={color}
      stroke={stroke}
      by={by}
      draw={isPerPiece(draw) ? draw(index, icon.paths.length) : draw}
    />
  ));

export function Icon(props: IconProps): SceneElement {
  const { icon, size = icon?.grid, stroke: custom, color: _c, draw: _d, ...placement } = props;

  check(icon, size, props);
  const by = size / icon.grid;

  const stroke: StrokeProps = {
    color: props.color,
    cap: "round",
    join: "round",
    ...custom,
    width: through(custom?.width ?? WIDTH, (width) => width * by),
  };

  return <Group {...placement}>{drawn(icon, props.color, stroke, by, props.draw)}</Group>;
}
