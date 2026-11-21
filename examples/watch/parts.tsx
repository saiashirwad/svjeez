import { Group, Shape, circle, path, subtract, tokens, type SceneElement, type Vec } from "svjeez";
import {
  FORK,
  PIN,
  PITCH,
  REACH,
  TEETH,
  entry,
  exit,
  polar,
  tooth,
  turn,
  type P,
} from "../escapement/mechanism";

// The escapement's drawings, from examples/escapement, in its own units: the escape wheel's arbor at [0, 0].

export const BRASS_EDGE = "#6E5626";
export const GILT = "#D9BC7A";
export const STEEL = "#B4BCC8";
export const STEEL_EDGE = "#4E5663";
export const RUBY = "#E0356A";
export const RUBY_EDGE = "#7C1236";
export const BLUED = "#5B7FE0";

const shadow = tokens({ light: { shade: "#0000001A" }, dark: { shade: "#00000052" } });

const n = (v: number, places = 1): string => String(Number(v.toFixed(places)));
const pt = (p: P, places = 1): string => n(p[0], places) + " " + n(p[1], places);

export const add = ([x, y]: P, [dx, dy]: P): Vec => [x + dx, y + dy];

const windows = (
  inner: number,
  outer: number,
  spokes: number,
  width: number,
  a: number,
): string[] => {
  const half = (radius: number): number => (Math.asin(width / 2 / radius) * 180) / Math.PI;
  const at = (radius: number, deg: number): string => pt(polar(radius, deg), 2);

  return Array.from({ length: spokes }, (_, i) => {
    const from = a + (i * 360) / spokes;
    const to = from + 360 / spokes;

    return (
      "M" +
      at(inner, from + half(inner)) +
      "L" +
      at(outer, from + half(outer)) +
      "A" +
      n(outer) +
      " " +
      n(outer) +
      " 0 0 1 " +
      at(outer, to - half(outer)) +
      "L" +
      at(inner, to - half(inner)) +
      "A" +
      n(inner) +
      " " +
      n(inner) +
      " 0 0 0 " +
      at(inner, from + half(inner)) +
      "Z"
    );
  });
};

/** An arc of a spiral from radius `from` to `to`, between two angles. */
export const spiral = (from: number, to: number, a0: number, a1: number): string => {
  const count = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 30));
  const radius = (u: number): number => from + (to - from) * u;
  let d = "M" + pt(polar(from, a0), 2);

  for (let i = 1; i <= count; i++) {
    const r = n(radius((i - 0.5) / count), 2);
    d +=
      "A" +
      r +
      " " +
      r +
      " 0 0 " +
      (a1 > a0 ? 1 : 0) +
      " " +
      pt(polar(radius(i / count), a0 + ((a1 - a0) * i) / count), 2);
  }

  return d;
};

/** Five spokes, so the wheel looks the same every three teeth. */
export const escapeWheel = (() => {
  const [toe, heel, backOf, neckBack, rootBack, rootFront, neckFront] = tooth;
  const at = (q: P, k: number): string => pt(turn(q, k * PITCH), 2);
  let d = "";

  for (let k = 0; k < TEETH; k++)
    d +=
      (k ? "L" : "M") +
      [rootBack, neckBack, backOf, heel, toe, neckFront, rootFront].map((q) => at(q, k)).join("L") +
      "A42 42 0 0 1 " +
      at(rootBack, k + 1);

  return subtract(path.parse(d + "Z"), ...windows(8.5, 36.5, 5, 4.2, 0).map(path.parse));
})();

export const balanceWheel = subtract(circle(88), ...windows(9, 77, 3, 7, 30).map(path.parse));

/** The pallet fork around its own arbor: the lever, the anchor that carries the stones, and the two stones. */
export const fork = (() => {
  const top = -(REACH - PIN);
  const q = (x: number, y: number): string => pt([x, y], 2);

  const lever = path.parse(
    "M" +
      [
        q(-4.6, 0),
        q(-2.6, top + 16),
        q(-7.4, top + 5),
        q(-7.4, top - 4.5),
        q(-2.5, top - 4.5),
        q(-2.5, top + 3.2),
        q(2.5, top + 3.2),
        q(2.5, top - 4.5),
        q(7.4, top - 4.5),
        q(7.4, top + 5),
        q(2.6, top + 16),
        q(4.6, 0),
      ].join("L") +
      "Z",
  );

  const local = (p: P): P => [p[0] - FORK[0], p[1] - FORK[1]];
  const mid = (s: typeof entry): P => local([(s[2][0] + s[3][0]) / 2, (s[2][1] + s[3][1]) / 2]);

  const anchor = path.parse(
    "M" +
      q(...mid(entry)) +
      "Q" +
      q(-14, -3) +
      " " +
      q(0, 0) +
      "Q" +
      q(14, -3) +
      " " +
      q(...mid(exit)),
  );

  const stone = (s: readonly P[]) =>
    path.parse("M" + s.map((p) => pt(local(p), 2)).join("L") + "Z");

  return { lever, anchor, entry: stone(entry), exit: stone(exit) };
})();

export const Jewel = ({ c, r = 4.2 }: { readonly c: Vec; readonly r?: number }): SceneElement => (
  <Group offset={c}>
    <Shape geometry={circle(r * 1.7)} fill={GILT} stroke={{ color: BRASS_EDGE, width: 0.4 }} />
    <Shape geometry={circle(r)} fill={RUBY} stroke={{ color: RUBY_EDGE, width: 0.5 }} />
    <Shape geometry={circle(r * 0.36)} fill={STEEL} />
  </Group>
);

export const Pin = ({ c }: { readonly c: Vec }): SceneElement => (
  <Shape
    geometry={circle(2.2)}
    at={c}
    anchor="center"
    fill={STEEL}
    stroke={{ color: STEEL_EDGE, width: 0.4 }}
  />
);

export const Shade = ({ c, r }: { readonly c: Vec; readonly r: number }): SceneElement => (
  <Shape
    geometry={circle(r * 0.94)}
    at={add(c, [2.5, 4])}
    anchor="center"
    stroke={{ color: shadow.shade, width: r * 0.14 }}
  />
);
