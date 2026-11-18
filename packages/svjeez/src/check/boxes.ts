import type { Seconds } from "../model/time";
import { boundsOfPoints, boxCorners, mixGeometry, outlineBoxOf } from "../model/geometry";
import type { Animated, Box, Geometry, Layer, Scene, SceneNode, Source, Vec } from "../model/ir";
import { valueAt as sampleAt } from "../model/sample";
import { mixNumber, mixVec, type Mix } from "../model/steps";
import { lookOf, paintedBoxOf } from "../model/painted";

export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export interface Placed {
  readonly key: string;
  readonly kind: SceneNode["kind"];
  readonly source?: Source;
  readonly box: Box;
  readonly frame: Box;
  readonly matrix: Matrix;
  readonly opacity: number;
  readonly depth: number;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const moveBy = ([x, y]: Vec): Matrix => [1, 0, 0, 1, x, y];

const apply = (m: Matrix, [x, y]: Vec): Vec => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

const inverse = (m: Matrix): Matrix | undefined => {
  const det = m[0] * m[3] - m[1] * m[2];

  if (Math.abs(det) < 1e-12) return undefined;

  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
};

export const valueAt = <T>(value: Animated<T>, t: Seconds, mix: Mix<T>, where = "a lane"): T =>
  sampleAt(value, t, (a, b, amount) => mix(a, b, amount, where));

const number = (value: Animated<number>, t: Seconds): number => valueAt(value, t, mixNumber);

const vec = (value: Animated<Vec>, t: Seconds): Vec => valueAt(value, t, mixVec);

const layerMatrix = (layer: Layer, origin: Vec, t: Seconds): Matrix => {
  const angle = (number(layer.rotate, t) * Math.PI) / 180;
  const [sx, sy] = vec(layer.scale, t);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const turn: Matrix = [cos * sx, sin * sx, -sin * sy, cos * sy, 0, 0];
  const [ox, oy] = origin;

  return [moveBy(vec(layer.offset, t)), moveBy(origin), turn, moveBy([-ox, -oy])].reduce(times);
};

const geometryAt = (geometry: Animated<Geometry>, t: Seconds, where: string): Box =>
  outlineBoxOf(valueAt(geometry, t, mixGeometry, where));

const frameAt = (node: SceneNode, t: Seconds): Box =>
  clipped(
    node,
    node.kind === "shape"
      ? paintedBoxOf(
          valueAt(node.geometry, t, mixGeometry, `"${node.key}"`),
          lookOf(node, node.stroke && number(node.stroke.width, t)),
        )
      : node.box,
    t,
  );

const clipped = (node: SceneNode, content: Box, t: Seconds): Box => {
  if (node.clip === undefined) return content;
  const clip = geometryAt(node.clip, t, `clip on "${node.key}"`);
  const [x, y] = [Math.max(content.x, clip.x), Math.max(content.y, clip.y)];
  const right = Math.min(content.x + content.width, clip.x + clip.width);
  const bottom = Math.min(content.y + content.height, clip.y + clip.height);

  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
};

export const placements = (scene: Scene, at: Seconds = 0): Placed[] => {
  const out: Placed[] = [];

  const visit = (node: SceneNode, parent: Matrix, shown: number, depth: number): Placed => {
    const own = node.layers.reduce(
      (matrix, layer) => times(matrix, layerMatrix(layer, node.origin, at)),
      times(parent, moveBy(vec(node.at, at))),
    );

    const opacity = node.layers.reduce((sum, layer) => sum * number(layer.opacity, at), shown);
    const frame = frameAt(node, at);
    const index = out.length;

    const initial: Placed = {
      key: node.key,
      kind: node.kind,
      ...(node.source && { source: node.source }),
      box: boundsOfPoints(boxCorners(frame).map((point) => apply(own, point))),
      frame,
      matrix: own,
      opacity,
      depth,
    };

    out.push(initial);

    if (node.kind !== "group" || node.children.length === 0) return initial;
    const children = node.children.map((child) => visit(child, own, opacity, depth + 1));

    if (depth === 0 || node.authored?.count) return initial;

    const back = inverse(own);
    const childBounds = boundsOfPoints(children.flatMap((child) => boxCorners(child.box)));

    const groupFrame =
      back &&
      clipped(
        node,
        boundsOfPoints(
          children.flatMap((child) =>
            boxCorners(child.frame).map((point) => apply(back, apply(child.matrix, point))),
          ),
        ),
        at,
      );

    const finalized: Placed = {
      ...initial,
      box:
        groupFrame && node.clip !== undefined
          ? boundsOfPoints(boxCorners(groupFrame).map((point) => apply(own, point)))
          : childBounds,
      ...(groupFrame && { frame: groupFrame }),
    };

    out[index] = finalized;

    return finalized;
  };

  visit(scene.root, IDENTITY, 1, 0);

  return out;
};

export const boxesOf = (scene: Scene, at: Seconds = 0): Record<string, Box> =>
  Object.fromEntries(placements(scene, at).map((placed) => [placed.key, placed.box]));

const inside = ({ x, y, width, height }: Box, [px, py]: Vec): boolean =>
  px >= x && px <= x + width && py >= y && py <= y + height;

export const hitTest = (
  scene: Scene | readonly Placed[],
  point: Vec,
  at: Seconds = 0,
): Placed | undefined => {
  const list = isPlacedList(scene) ? scene : placements(scene, at);

  return list.findLast((placed) => {
    if (placed.depth === 0 || placed.opacity <= 1e-6) return false;
    const back = inverse(placed.matrix);

    return back !== undefined && inside(placed.frame, apply(back, point));
  });
};

const isPlacedList = (value: Scene | readonly Placed[]): value is readonly Placed[] =>
  Array.isArray(value);
