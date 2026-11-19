import { SceneError } from "./scene-error";
import { DEFAULT_EASE, type Ease } from "./time";
import { boundsOfPoints, boxCorners, growBox, mixGeometry } from "./geometry";
import { lerpPoint } from "./curve";
import { MITER_LIMIT } from "./painted";
import type { Animated, Box, Effect, Geometry, Layer, SceneNode, Vec } from "./ir";
import { isLane } from "./lane";

const easeRange = (curve: Ease): readonly [number, number] =>
  curve.kind === "bezier"
    ? [Math.min(0, curve.points[1], curve.points[3]), Math.max(1, curve.points[1], curve.points[3])]
    : [0, 1];

const reached = <T>(value: Animated<T>, mix: (a: T, b: T, u: number) => T): T[] => {
  if (!isLane(value)) return [value];

  return value.keys.flatMap((key, i) => {
    const before = value.keys[i - 1];

    if (!before) return [key.value];
    const [low, high] = easeRange(key.ease ?? DEFAULT_EASE);

    return [
      key.value,
      ...(low < 0 ? [mix(before.value, key.value, low)] : []),
      ...(high > 1 ? [mix(before.value, key.value, high)] : []),
    ];
  });
};

const numbers = (value: Animated<number>): number[] => reached(value, (a, b, u) => a + (b - a) * u);

const points = (value: Animated<Vec>): Vec[] => [
  ...reached(value, lerpPoint),
  ...(isLane(value) ? value.keys.flatMap((key) => key.via ?? []) : []),
];

const range = (values: readonly number[]): readonly [number, number] => [
  Math.min(...values),
  Math.max(...values),
];

const union = (boxes: readonly (Box | undefined)[]): Box | undefined => {
  const all = boxes.filter((box): box is Box => box !== undefined);

  return all.length === 0 ? undefined : boundsOfPoints(all.flatMap(boxCorners));
};

const intersect = (a: Box | undefined, b: Box | undefined): Box | undefined => {
  if (!a || !b) return undefined;
  const [x, y] = [Math.max(a.x, b.x), Math.max(a.y, b.y)];
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return right < x || bottom < y ? undefined : { x, y, width: right - x, height: bottom - y };
};

const swept = (box: Box, by: readonly Vec[]): Box => {
  const [x0, x1] = range(by.map(([x]) => x));
  const [y0, y1] = range(by.map(([, y]) => y));

  return { x: box.x + x0, y: box.y + y0, width: box.width + x1 - x0, height: box.height + y1 - y0 };
};

const hull = (geometry: Geometry): Vec[] => {
  switch (geometry.kind) {
    case "rect":
      return [[0, 0], geometry.size];
    case "ellipse": {
      const [rx, ry] = geometry.radius;

      return [
        [-rx, -ry],
        [rx, ry],
      ];
    }

    case "arc":
      return [
        [-geometry.radius, -geometry.radius],
        [geometry.radius, geometry.radius],
      ];
    case "line":
      return [geometry.from, geometry.to];
    case "points":
      return [...geometry.points];
    case "path":
      return geometry.contours.flatMap((contour) => [contour.start, ...contour.curves.flat()]);
  }
};

const outlines = (value: Animated<Geometry>, where: string): Box | undefined => {
  const list = reached(value, (a, b, u) => mixGeometry(a, b, u, where)).flatMap(hull);

  return list.length === 0 ? undefined : boundsOfPoints(list);
};

const strokeReach = (node: Extract<SceneNode, { kind: "shape" }>, inside: string): number => {
  const { stroke } = node;

  if (!stroke) return 0;

  if (stroke.fixedWidth)
    throw new SceneError(
      `"${node.key}" has a fixedWidth stroke inside ${inside}, whose width in its own units depends on every scale around it, so the region can't be bounded. Drop fixedWidth there, or move the effect or mask to a node without it.`,
    );
  const width = Math.max(0, ...numbers(stroke.width).map(Math.abs));

  return (
    (width / 2) * (stroke.join === "sharp" ? MITER_LIMIT : stroke.cap === "square" ? Math.SQRT2 : 1)
  );
};

const throughLayer = (box: Box, layer: Layer, origin: Vec): Box => {
  const scales = points(layer.scale);
  const [sx0, sx1] = range(scales.map(([x]) => x));
  const [sy0, sy1] = range(scales.map(([, y]) => y));

  const [k0, k1] = range(numbers(layer.skew).map((angle) => Math.tan((angle * Math.PI) / 180)));

  const scaled = boxCorners(box).flatMap(([x, y]): Vec[] =>
    [k0, k1].flatMap((k) =>
      [sx0, sx1].flatMap((sx) =>
        [sy0, sy1].map((sy): Vec => {
          const [dx, dy] = [x - origin[0], y - origin[1]];

          return [(dx + k * dy) * sx, dy * sy];
        }),
      ),
    ),
  );

  let turned: Box;

  if (isLane(layer.rotate)) {
    const reach = Math.max(...scaled.map(([x, y]) => Math.hypot(x, y)));

    turned = { x: -reach, y: -reach, width: reach * 2, height: reach * 2 };
  } else {
    const angle = (layer.rotate * Math.PI) / 180;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];

    turned = boundsOfPoints(scaled.map(([x, y]): Vec => [x * cos - y * sin, x * sin + y * cos]));
  }

  return swept(
    { ...turned, x: turned.x + origin[0], y: turned.y + origin[1] },
    points(layer.offset),
  );
};

export const placed = (box: Box | undefined, node: SceneNode): Box | undefined =>
  box &&
  swept(
    [...node.layers]
      .reverse()
      .reduce((inner, layer) => throughLayer(inner, layer, node.origin), box),
    points(node.at),
  );

const throughEffects = (box: Box | undefined, effects: readonly Effect[]): Box | undefined =>
  effects.reduce<Box | undefined>((inner, effect) => {
    if (!inner) return inner;

    if (effect.kind === "blur") return growBox(inner, 3 * Math.max(0, ...numbers(effect.radius)));

    if (effect.kind === "adjust") return inner;

    if (effect.kind === "displace") return growBox(inner, Math.max(0, ...numbers(effect.scale)));
    const soft = 3 * Math.max(0, ...numbers(effect.blur));

    return union([inner, growBox(swept(inner, points(effect.offset)), soft)]);
  }, box);

export const reachOf = (node: SceneNode, inside: string): Box | undefined => {
  const where = `"${node.key}"`;

  const content = ((): Box | undefined => {
    switch (node.kind) {
      case "shape": {
        const outline = outlines(node.geometry, `geometry on ${where}`);

        return outline && growBox(outline, strokeReach(node, inside));
      }

      case "group":
        return union(node.children.map((child) => placed(reachOf(child, inside), child)));
      case "text":
        return growBox(node.box, node.size / 2);
      case "picture":
        return node.box;
    }
  })();

  const clipped =
    node.clip === undefined ? content : intersect(content, outlines(node.clip, `clip on ${where}`));

  const masked =
    node.mask === undefined
      ? clipped
      : intersect(clipped, placed(reachOf(node.mask, inside), node.mask));

  return throughEffects(masked, node.effects);
};
