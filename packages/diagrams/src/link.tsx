/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  circle,
  line,
  path,
  polygon,
  through,
  type Anim,
  type Geometry,
} from "svjeez";
import type { SceneElement } from "svjeez";
import type { Color, StrokeProps } from "svjeez/tools";
import { curve, vec } from "./curve.ts";
import type { Point } from "./layout/box.ts";
import { Route, type Look } from "./kit.tsx";

/** What is drawn at one end of a class relationship. */
export type ClassEnd = "none" | "triangle" | "diamond" | "diamond-filled" | "arrow";

/** How many of an entity sit at one end of an ER relationship. */
export type ErCard = "one" | "zero-one" | "one-many" | "zero-many";

export type End = ClassEnd | ErCard;

const REACH = 18;

interface Marker {
  readonly strokes: Geometry | undefined;
  readonly shape?: { readonly geometry: Geometry; readonly filled: boolean };
  readonly ring?: Point;
}

const markerOf = (end: End, tip: Point, ux: number, uy: number): Marker => {
  const at = (back: number, side: number): Point => ({
    x: tip.x - ux * back - uy * side,
    y: tip.y - uy * back + ux * side,
  });

  const v = (back: number, side: number) => vec(at(back, side));
  const bar = (back: number, half: number) => path().moveTo(v(back, -half)).lineTo(v(back, half));

  const foot = path()
    .moveTo(v(0, -6))
    .lineTo(v(10, 0))
    .lineTo(v(0, 6))
    .moveTo(v(10, 0))
    .lineTo(v(0, 0));

  switch (end) {
    case "none":
      return { strokes: undefined };
    case "triangle":
      return {
        strokes: undefined,
        shape: { geometry: polygon(v(0, 0), v(12, -6), v(12, 6)), filled: false },
      };
    case "diamond":
    case "diamond-filled":
      return {
        strokes: undefined,
        shape: {
          geometry: polygon(v(0, 0), v(8, -5), v(16, 0), v(8, 5)),
          filled: end === "diamond-filled",
        },
      };
    case "arrow":
      return { strokes: line(v(9, -5), v(0, 0), v(9, 5)) };
    case "one":
      return { strokes: bar(6, 5).moveTo(v(10, -5)).lineTo(v(10, 5)) };
    case "zero-one":
      return { strokes: bar(6, 5), ring: at(13.5, 0) };
    case "one-many":
      return { strokes: foot.moveTo(v(13.5, -5)).lineTo(v(13.5, 5)) };
    case "zero-many":
      return { strokes: foot, ring: at(14, 0) };
  }
};

export interface LinkProps {
  readonly key: string;
  readonly look: Look;
  readonly points: readonly Point[];
  readonly start: End;
  readonly end: End;
  readonly dashed?: boolean;
  readonly draw?: Anim<number>;
}

const unit = (a: Point, b: Point): [number, number] => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;

  return [(b.x - a.x) / length, (b.y - a.y) / length];
};

/** A relationship line with its markers, drawn from `start` (the first point) to `end`. */
export const Link = ({ look: l, ...e }: LinkProps): SceneElement => {
  const color: Color = l.colors.line;

  const stroke: StrokeProps = {
    color,
    width: 1.5,
    cap: "round",
    join: "round",
    ...(e.dashed && { dash: [6, 4] }),
  };

  const solid: StrokeProps = { color, width: 1.5, cap: "round", join: "round" };
  const length = new Route([e.points]).length || 1;
  const reach = Math.min(1, Math.max(0, 1 - REACH / length));
  const [first, second] = [e.points[0]!, e.points[1]!];
  const [last, before] = [e.points.at(-1)!, e.points.at(-2)!];

  const ends = [
    { key: "start", marker: markerOf(e.start, first, ...unit(second, first)), visible: 0 },
    { key: "end", marker: markerOf(e.end, last, ...unit(before, last)), visible: reach },
  ];

  const shown = (visible: number): Anim<number> | undefined =>
    e.draw === undefined
      ? undefined
      : e.dashed
        ? e.draw
        : through(e.draw, (d) => (d > 0 && d >= visible ? 1 : 0));

  return (
    <Group key={e.key}>
      <Shape
        key="line"
        geometry={curve(e.points).geometry}
        stroke={stroke}
        trim={
          e.draw !== undefined && !e.dashed
            ? through(e.draw, (d): [number, number] => [0, d])
            : undefined
        }
        opacity={e.draw !== undefined && e.dashed ? e.draw : undefined}
      />
      {ends.map(({ key, marker, visible }) => (
        <Group key={key} opacity={shown(visible)}>
          {marker.shape && (
            <Shape
              key="shape"
              geometry={marker.shape.geometry}
              fill={marker.shape.filled ? color : l.colors.background}
              stroke={solid}
            />
          )}
          {marker.strokes && <Shape key="strokes" geometry={marker.strokes} stroke={solid} />}
          {marker.ring && (
            <Shape
              key="ring"
              geometry={circle(3.5)}
              anchor="center"
              at={vec(marker.ring)}
              fill={l.colors.background}
              stroke={solid}
            />
          )}
        </Group>
      ))}
    </Group>
  );
};
