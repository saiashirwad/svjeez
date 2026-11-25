import { outlineBoxOf } from "../model/geometry";
import type {
  Animated,
  Box,
  Geometry,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  TextNode,
  Vec,
} from "../model/ir";
import { isLane } from "../model/lane";
import { isColor } from "../model/painted";
import { placed, reachOf } from "../model/reach";
import { mixNumber } from "../model/steps";
import type { Seconds } from "../model/time";
import type { Placed } from "./boxes";
import { valueAt } from "../model/sample";
import { add, isGone, isLeaf, label, shownBoxes, spoken, type Survey } from "./inspect-context";
import {
  between,
  clearThroughout,
  colorAt,
  covers,
  isUpright,
  movingAt,
  ownHidden,
  paintName,
  rgbaIn,
  runsOf,
  scaleOf,
  schemesOf,
  strokeReachAt,
  textOf,
  units,
  zerosOf,
  type Entry,
  type Scheme,
  type Stretch,
} from "./survey";

type VisibilitySurvey = Survey & { readonly gone: Set<string> };

const flatAxes = (geometry: Geometry): readonly [across: boolean, down: boolean] => {
  switch (geometry.kind) {
    case "rect":
      return [geometry.size[0] === 0, geometry.size[1] === 0];
    case "ellipse":
      return [geometry.radius[0] === 0, geometry.radius[1] === 0];
    case "arc": {
      const none = geometry.radius === 0 || geometry.sweep === 0;

      return [none, none];
    }

    default: {
      const { width, height } = outlineBoxOf(geometry);
      const point = width === 0 && height === 0;

      return [point, point];
    }
  }
};

const flatThroughout = (geometry: Animated<Geometry>): boolean => {
  const keys = isLane(geometry) ? geometry.keys.map((key) => key.value) : [geometry];
  const axes = keys.map(flatAxes);

  return axes.every(([x]) => x) || axes.every(([, y]) => y);
};

const describeGeometry = (geometry: Geometry): string => {
  switch (geometry.kind) {
    case "rect":
      return `a rect ${units(geometry.size[0])} by ${units(geometry.size[1])}`;
    case "ellipse":
      return `an ellipse of radius ${units(geometry.radius[0])} by ${units(geometry.radius[1])}`;
    case "arc":
      return `an arc of radius ${units(geometry.radius)} sweeping ${units(geometry.sweep)}°`;
    default:
      return `a ${geometry.kind} that is a single point`;
  }
};

const trimmedAway = (trim: Animated<Vec> | undefined): boolean => {
  if (trim === undefined) return false;
  const keys = isLane(trim) ? trim.keys.map((key) => key.value) : [trim];

  return keys.every(([from, to]) => from === to);
};

const unpainted = (
  scene: Scene,
  node: ShapeNode,
  duration: Seconds,
  schemes: readonly Scheme[],
): string | undefined => {
  const fillClear =
    clearThroughout(scene, node.fill, schemes) ||
    (node.fillOpacity !== undefined && covers(zerosOf(node.fillOpacity, duration), 0, duration));

  if (!fillClear) return undefined;
  const fill = node.fill === undefined ? "no fill" : "a fill that is fully transparent";
  const { stroke } = node;

  if (!stroke) return `it has ${fill} and no stroke`;

  if (clearThroughout(scene, stroke.color, schemes))
    return `it has ${fill} and a stroke that is fully transparent`;

  if (covers(zerosOf(stroke.width, duration), 0, duration))
    return `it has ${fill} and a stroke 0 wide`;

  if (trimmedAway(node.trim)) return `it has ${fill} and its stroke is trimmed to nothing`;

  return undefined;
};

const unwritten = (
  scene: Scene,
  node: TextNode,
  duration: Seconds,
  schemes: readonly Scheme[],
): string | undefined => {
  const runs = runsOf(node).filter((run) => run.text.trim() !== "");

  if (runs.length === 0) return undefined;

  const stroked =
    node.stroke !== undefined &&
    !clearThroughout(scene, node.stroke.color, schemes) &&
    !covers(zerosOf(node.stroke.width, duration), 0, duration) &&
    !trimmedAway(node.trim);

  if (stroked) return undefined;

  if (node.fillOpacity !== undefined && covers(zerosOf(node.fillOpacity, duration), 0, duration))
    return "its fillOpacity is 0 at every time";

  if (runs.every((run) => clearThroughout(scene, run.fill, schemes)))
    return "every run's fill is fully transparent";

  if (
    runs.every(
      (run) =>
        clearThroughout(scene, run.fill, schemes) ||
        (run.opacity !== undefined && covers(zerosOf(run.opacity, duration), 0, duration)),
    )
  )
    return "every run's opacity is 0 at every time";

  return undefined;
};

const hiddenWhy = (survey: Survey, entry: Entry): string | undefined => {
  const { duration } = survey.scene;
  const { node } = entry;

  if (!covers(survey.hidden.get(node.key) ?? [], 0, duration)) return undefined;

  const own = (pick: (layer: SceneNode["layers"][number]) => Stretch[]): boolean =>
    node.layers.some((layer) => covers(pick(layer), 0, duration));

  if (own((layer) => zerosOf(layer.opacity, duration))) return "its opacity is 0 at every time";

  if (covers(ownHidden(node, duration), 0, duration))
    return "its opacity or scale is 0 at every time";

  return "it and the groups around it are hidden at every time between them";
};

export const neverVisible = (survey: VisibilitySurvey): void => {
  const { scene } = survey;
  const { duration } = scene;

  for (const entry of survey.entries.slice(1)) {
    if (isGone(survey, entry)) continue;
    const { node } = entry;
    const hide = "Give it an opacity and a scale above 0 at some time, or remove it.";

    const schemes = schemesOf(entry);

    const why =
      (schemes.length === 0
        ? `it shows only in the ${node.scheme} scheme, inside a group that shows only in the other`
        : undefined) ??
      hiddenWhy(survey, entry) ??
      (node.kind === "shape" ? unpainted(scene, node, duration, schemes) : undefined) ??
      (node.kind === "text" ? unwritten(scene, node, duration, schemes) : undefined);

    if (why) {
      survey.gone.add(node.key);
      add(survey, {
        code: "never-visible",
        severity: "warning",
        key: node.key,
        message: `${label(node)} is never visible: ${why}.`,
        fix:
          schemes.length === 0
            ? "Give it the scheme of the group around it, or move it out of that group."
            : why.includes("fill") || why.includes("stroke")
              ? "Give it a fill, or a stroke with a color and a width above 0, or remove it."
              : hide,
      });
      continue;
    }

    if (node.clip !== undefined && flatThroughout(node.clip)) {
      survey.gone.add(node.key);
      add(survey, {
        code: "never-visible",
        severity: "warning",
        key: node.key,
        message: `${label(node)} is never visible: its clip has no area at any time, so it cuts everything away.`,
        fix: "Give the clip a size, or remove the clip.",
      });
      continue;
    }

    const flat =
      (node.kind === "shape" &&
        flatThroughout(node.geometry) &&
        describeGeometry(isLane(node.geometry) ? node.geometry.keys[0].value : node.geometry)) ||
      (node.kind === "text" && textOf(node) === "" && "a text with no characters") ||
      (node.kind === "picture" &&
        (node.size[0] === 0 || node.size[1] === 0) &&
        `an image ${units(node.size[0])} by ${units(node.size[1])}`);

    if (flat) {
      survey.gone.add(node.key);
      add(survey, {
        code: "zero-size",
        severity: "warning",
        key: node.key,
        message: `${label(node)} has no size at any time (${flat}), so it draws nothing.`,
        fix:
          node.kind === "text"
            ? "Give it some text, or remove it."
            : "Give it a width and a height above 0 at some time, or remove it.",
      });
    }
  }

  covered(survey);
};

const reachInScene = (survey: Survey, entry: Entry): Box | undefined => {
  try {
    const own = placed(reachOf(entry.node, "inspect"), entry.node);

    return [...entry.ancestors]
      .reverse()
      .reduce<Box | undefined>((box, group) => placed(box, group), own);
  } catch {
    return undefined;
  }
};

const isPlain = (node: SceneNode): boolean =>
  !isLane(node.at) &&
  node.clip === undefined &&
  node.mask === undefined &&
  node.effects.length === 0 &&
  node.layers.every(
    (layer) =>
      !isLane(layer.offset) &&
      !isLane(layer.rotate) &&
      !isLane(layer.scale) &&
      layer.skew === 0 &&
      layer.opacity === 1 &&
      layer.scale[0] !== 0 &&
      layer.scale[1] !== 0,
  );

interface Cover {
  readonly entry: Entry;
  readonly box: Box;
  readonly radius: number;
}

const coverOf = (survey: Survey, entry: Entry): Cover | undefined => {
  const { node } = entry;

  if (node.kind !== "shape" || isLane(node.geometry) || node.geometry.kind !== "rect")
    return undefined;

  if (node.fill === undefined || isLane(node.fill)) return undefined;

  if (node.fillOpacity !== undefined && (isLane(node.fillOpacity) || node.fillOpacity < 1))
    return undefined;

  if (!schemesOf(entry).every((scheme) => opaque(survey.scene, node.fill, scheme)))
    return undefined;

  if (![...entry.ancestors, node].every(isPlain)) return undefined;
  const at = survey.frames[0]?.frame.get(node.key);

  if (!at || !isUpright(at.matrix) || at.matrix[0] <= 0 || at.matrix[3] <= 0) return undefined;

  return {
    entry,
    box: at.box,
    radius: Math.max(...node.geometry.radius) * Math.max(at.matrix[0], at.matrix[3]),
  };
};

const opaque = (scene: Scene, paint: ShapeNode["fill"], scheme: Scheme): boolean => {
  if (paint === undefined || isLane(paint) || !isColor(paint)) return false;

  return rgbaIn(scene, paint, scheme)[3] >= 1;
};

const within = (box: Box, outer: Box, by = 0): boolean =>
  box.x >= outer.x - by - 1e-6 &&
  box.y >= outer.y - by - 1e-6 &&
  box.x + box.width <= outer.x + outer.width + by + 1e-6 &&
  box.y + box.height <= outer.y + outer.height + by + 1e-6;

const hides = (cover: Box, radius: number, box: Box): boolean =>
  within(box, { ...cover, x: cover.x + radius, width: cover.width - radius * 2 }) ||
  within(box, { ...cover, y: cover.y + radius, height: cover.height - radius * 2 });

const covered = (survey: VisibilitySurvey): void => {
  const covers = survey.entries.flatMap((entry) => {
    const cover = coverOf(survey, entry);

    return cover ? [cover] : [];
  });

  for (const entry of survey.entries) {
    if (!isLeaf(entry) || isGone(survey, entry)) continue;
    const schemes = schemesOf(entry);

    const later = covers.filter(
      (cover) =>
        cover.entry.order > entry.order &&
        schemes.every((scheme) => schemesOf(cover.entry).includes(scheme)),
    );

    if (later.length === 0) continue;
    const reach = reachInScene(survey, entry);

    if (!reach) continue;
    const cover = later.find((c) => hides(c.box, c.radius, reach));

    if (!cover) continue;
    survey.gone.add(entry.node.key);
    add(survey, {
      code: "never-visible",
      severity: "warning",
      key: entry.node.key,
      message: `${label(entry.node)} is never visible: ${label(cover.entry.node)}, an opaque rect drawn after it, covers it at every time.`,
      fix: `Draw it after "${cover.entry.node.key}" (later among its siblings), or move it out from under it.`,
      related: [cover.entry.node.key],
    });
  }
};

const EDGES = ["left", "top", "right", "bottom"] as const;

const past = (box: Box, [width, height]: Vec): readonly number[] => [
  -box.x,
  -box.y,
  box.x + box.width - width,
  box.y + box.height - height,
];

const still = (boxes: readonly Box[]): boolean =>
  boxes.every((box) =>
    (["x", "y", "width", "height"] as const).every(
      (side) => Math.abs(box[side] - boxes[0]![side]) < 0.5,
    ),
  );

const clippedAround = (entry: Entry): boolean =>
  entry.ancestors.some((group) => group.clip !== undefined || group.mask !== undefined);

export const offCanvas = (survey: VisibilitySurvey): void => {
  const { size } = survey.scene;
  const [width, height] = size;

  for (const entry of survey.entries.slice(1)) {
    if (isGone(survey, entry)) continue;
    const reach = reachInScene(survey, entry);

    if (
      reach &&
      (reach.x + reach.width <= 0 ||
        reach.y + reach.height <= 0 ||
        reach.x >= width ||
        reach.y >= height)
    ) {
      survey.gone.add(entry.node.key);
      add(survey, {
        code: "off-canvas",
        severity: "error",
        key: entry.node.key,
        message: `${label(entry.node)} is outside the ${width}×${height} canvas at every time: it stays within x ${units(reach.x)} to ${units(reach.x + reach.width)}, y ${units(reach.y)} to ${units(reach.y + reach.height)}.`,
        fix: "Move it onto the canvas, or remove it.",
      });
    }
  }

  for (const entry of survey.entries) {
    if (!isLeaf(entry) || isGone(survey, entry) || clippedAround(entry)) continue;
    const seen = shownBoxes(survey, entry);
    const [first] = seen;

    if (!first || !still(seen.map((s) => s.box))) continue;
    const { box } = first;
    const sides = past(box, size);
    const by = Math.max(...sides);

    if (
      by <= 1 ||
      box.x + box.width <= 0 ||
      box.y + box.height <= 0 ||
      box.x >= width ||
      box.y >= height
    )
      continue;
    const edge = EDGES[sides.indexOf(by)]!;
    const across = edge === "left" || edge === "right";

    if (entry.node.kind === "text") {
      add(survey, {
        code: "text-overflow",
        severity: "warning",
        key: entry.node.key,
        message: `${spoken(entry.node)} runs ${units(by)} past the ${edge} edge of the canvas while it rests.`,
        fix: "Move it inside, shorten it, give it a width to wrap to, or shrink its size.",
        times: seen.map((s) => s.t),
      });
      continue;
    }

    if (box.width >= width / 2 || box.height >= height / 2) continue;

    if (by >= (across ? box.width : box.height) / 4) continue;
    add(survey, {
      code: "off-canvas",
      severity: "warning",
      key: entry.node.key,
      message: `${label(entry.node)} is cut off ${units(by)} past the ${edge} edge of the canvas while it rests.`,
      fix: "Move it inside, or let it bleed well past the edge if the crop is meant.",
      times: seen.map((s) => s.t),
    });
  }
};

export interface Flat {
  readonly name: string;
  readonly color: Readonly<Record<Scheme, Rgba>>;
}

export const flatAt = (
  survey: Survey,
  entry: Entry,
  at: Placed,
  t: Seconds,
  box?: Box,
): Flat | undefined => {
  const { node } = entry;

  if (node.kind !== "shape" || node.fill === undefined || at.opacity < 0.999) return undefined;

  if (node.fillOpacity !== undefined && valueAt(node.fillOpacity, t, mixNumber) < 0.999)
    return undefined;

  if (
    [...entry.ancestors, node].some(
      (n) => n.clip !== undefined || n.mask !== undefined || n.effects.length > 0,
    )
  )
    return undefined;

  if (movingAt(node.geometry, t) || !isUpright(at.matrix)) return undefined;
  const { from, to, amount } = between(node.geometry, t);
  const geometry = amount >= 1 ? to : from;
  const light = colorAt(survey.scene, node.fill, t, "light");
  const dark = colorAt(survey.scene, node.fill, t, "dark");

  if (!light || !dark || schemesOf(entry).some((scheme) => ({ light, dark })[scheme][3] < 0.999))
    return undefined;
  const fill = between(node.fill, t);
  const name = paintName(fill.amount >= 0.5 ? fill.to : fill.from);
  const flat: Flat = { name, color: { light, dark } };

  if (!box) return flat;
  const stroke = 2 * strokeReachAt(node, at, t);

  const inner = {
    x: at.box.x + stroke,
    y: at.box.y + stroke,
    width: at.box.width - stroke * 2,
    height: at.box.height - stroke * 2,
  };

  if (geometry.kind === "rect")
    return hides(inner, Math.max(...geometry.radius) * scaleOf(at.matrix), box) ? flat : undefined;

  if (geometry.kind === "ellipse") {
    const [cx, cy] = [inner.x + inner.width / 2, inner.y + inner.height / 2];
    const [rx, ry] = [inner.width / 2, inner.height / 2];

    const corners: readonly Vec[] = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ];

    const held = corners.every(
      ([x, y]) => rx > 0 && ry > 0 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
    );

    return held ? flat : undefined;
  }

  return undefined;
};
