import type { Seconds } from "../model/time";
import { mixGeometry } from "../model/geometry";
import type { Animated, Box, Geometry, Layer, Scene, SceneNode, Source, Vec } from "../model/ir";
import { valueAt as sampleAt } from "../model/sample";
import { mixNumber, mixVec, type Mix } from "../model/steps";
import { boxOf } from "../author/values";
import { lookOf, paintedBoxOf } from "../model/painted";

/**
 * Where every node of a scene is, by the transform rule at the top of ir.ts: what an editor needs to draw handles
 * and to find the node under a point. Pure math on the model, so it runs anywhere, a worker included.
 */

/** An affine map: x' = a·x + c·y + e, y' = b·x + d·y + f, as SVG writes one. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

/** One node, placed in the scene. Plain data, so it survives a worker's message. */
export interface Placed {
  readonly key: string;
  readonly kind: SceneNode["kind"];
  readonly source?: Source;
  /** The smallest upright box around the node, in the scene's coordinates. A group's holds its children. */
  readonly box: Box;
  /** The node's box in its own frame. */
  readonly frame: Box;
  /** From the node's own frame to the scene's. */
  readonly matrix: Matrix;
  /** How opaque it is, with every group around it: 0 is hidden. */
  readonly opacity: number;
  /** 0 for the root, 1 for its children, and so on. */
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

/** What an animated value is at `t` seconds on the scene's clock, as a backend would draw it. */
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

const corners = ({ x, y, width, height }: Box): Vec[] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

const around = (points: readonly Vec[]): Box => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const geometryAt = (geometry: Animated<Geometry>, t: Seconds, where: string): Box =>
  boxOf(valueAt(geometry, t, mixGeometry, where));

/** What a node covers in its frame at `t`: what it paints, a stroke included, cut to its clip's box when it has one. */
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

/** `content` cut to the box of `node`'s clip at `t`: a box test is as far as a hit test goes. */
const clipped = (node: SceneNode, content: Box, t: Seconds): Box => {
  if (node.clip === undefined) return content;
  const clip = geometryAt(node.clip, t, `clip on "${node.key}"`);
  const [x, y] = [Math.max(content.x, clip.x), Math.max(content.y, clip.y)];
  const right = Math.min(content.x + content.width, clip.x + clip.width);
  const bottom = Math.min(content.y + content.height, clip.y + clip.height);

  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
};

/**
 * Every node of `scene` at `at` seconds (0, the picture at rest, unless you say), placed in the scene, in the order
 * they paint: each group before what it holds, the root first. A symbol's content is not listed; its instances are.
 */
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

    out.push({
      key: node.key,
      kind: node.kind,
      ...(node.source && { source: node.source }),
      box: around(corners(frame).map((point) => apply(own, point))),
      frame,
      matrix: own,
      opacity,
      depth,
    });

    if (node.kind !== "group" || node.children.length === 0) return out[index]!;
    const inside = node.children.map((child) => visit(child, own, opacity, depth + 1));
    const back = inverse(own);

    // The root's box is the canvas; another group's holds wherever its children are now, in its frame too, so a
    // group whose children have moved away is hit where they are, not where they were.
    if (depth > 0) {
      const held = around(inside.flatMap((child) => corners(child.box)));

      const frame =
        back &&
        clipped(
          node,
          around(
            inside.flatMap((child) =>
              corners(child.frame).map((point) => apply(back, apply(child.matrix, point))),
            ),
          ),
          at,
        );

      out[index] = {
        ...out[index]!,
        // A clip cuts what the group holds, so its box in the scene is its cut frame's.
        box:
          frame && node.clip !== undefined
            ? around(corners(frame).map((p) => apply(own, p)))
            : held,
        ...(frame && { frame }),
      };
    }

    return out[index]!;
  };

  visit(scene.root, IDENTITY, 1, 0);

  return out;
};

/** Each node's box in the scene's coordinates at `at` seconds, by key. */
export const boxesOf = (scene: Scene, at: Seconds = 0): Record<string, Box> =>
  Object.fromEntries(placements(scene, at).map((placed) => [placed.key, placed.box]));

const inside = ({ x, y, width, height }: Box, [px, py]: Vec): boolean =>
  px >= x && px <= x + width && py >= y && py <= y + height;

/**
 * The deepest, topmost node whose box holds `point` (in the scene's coordinates), with its key and where it was
 * written: what a click on the picture selects. Hidden nodes and the root are never hit. Takes a scene, or the
 * placements a worker sent, which are already at a time.
 */
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
