import { nodeName } from "../model/naming";
import type { Seconds } from "../model/time";
import { FEATURES, diagnose, type Backend } from "../model/backend";
import { valueAt, type Placed } from "./boxes";
import { contoursOf, mixGeometry } from "../model/geometry";
import type {
  Animated,
  Box,
  Geometry,
  Paint,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  Source,
  TextNode,
  Vec,
} from "../model/ir";
import { isLane } from "../model/lane";
import { FontBook, charName } from "../author/runs";
import { placed, reachOf } from "../model/reach";
import { mixNumber, mixVec, same } from "../model/steps";
import {
  SCHEMES,
  area,
  between,
  changesOf,
  clearThroughout,
  colorAt,
  covers,
  entriesOf,
  framesOf,
  hiddenOf,
  inside,
  isUpright,
  momentsOf,
  movingAt,
  ownHidden,
  paintName,
  rgbaIn,
  runsOf,
  scaleOf,
  seconds,
  sharedArea,
  shownOf,
  merged,
  namesOf,
  sourcesOf,
  strokeReachAt,
  textOf,
  units,
  valuesOf,
  zerosOf,
  type Entry,
  type Named,
  type Scheme,
  type Stretch,
} from "./survey";
import { boxOf } from "../author/values";

export const RULES = {
  "compile-error": "The scene threw while it was built.",
  "compile-warning": "The old compiler warned while it wrote an SVG string.",
  "never-visible": "A node can't be seen at any time: hidden, painting nothing, or covered.",
  "zero-size": "A node's geometry, text or image has no size at any time.",
  "off-canvas": "Outside the canvas at every time, or cut by its edge at rest.",
  "text-overflow": "Text past the canvas at rest, or a line wider than the width it wraps to.",
  overlap: "Two texts drawn over each other while both are fully shown.",
  "missing-glyph": "Characters the text's face has no glyph for.",
  "low-contrast": "Text or a thin line too close in color to the flat color behind it.",
  "loop-seam": "A looping scene jumps when it starts again.",
  "visible-at-zero": "Shown at 0s and cut straight back in, or filled while its stroke draws in.",
  "nothing-enters": "Everything is on screen from 0s and nothing ever enters.",
  "wasted-motion": "A value changes before the node is first seen, or after it is gone for good.",
  static: "Nothing in the scene moves, or a value changes only after the scene ends.",
  "unused-symbol": "A symbol no instance draws.",
  "layout-overlap": "Two children of a <Stack> or <Grid> overlap: motion carried one onto another.",
  "word-cut": "A word wider than the width its text wraps to, cut across two lines.",
  "unattached-ref": "A ref the scene made that no node takes.",
  "hidden-target": "A timeline moves a node that is never visible.",
  unsupported: "A feature the chosen backend can't draw.",
  approximate: "A feature the chosen backend draws differently from the model.",
} as const;

export type Code = keyof typeof RULES;

export type Severity = "error" | "warning" | "info";

export interface Related {
  readonly key: string;
  readonly source?: Source;
}

export interface Finding {
  readonly code: Code;
  readonly severity: Severity;
  readonly key: string;
  readonly source?: Source;
  readonly message: string;
  readonly hint: string;
  readonly times?: readonly Seconds[];
  readonly related?: readonly Related[];
}

export interface InspectOptions {
  readonly backend?: Pick<Backend<never>, "name" | "supports">;
  readonly times?: readonly Seconds[];
}

interface Survey {
  readonly scene: Scene;
  readonly entries: readonly Entry[];
  readonly sources: ReadonlyMap<string, Source>;
  readonly times: readonly Seconds[];
  readonly frames: readonly ReadonlyMap<string, Placed>[];
  readonly hidden: ReadonlyMap<string, readonly Stretch[]>;
  readonly gone: Set<string>;
  readonly out: Finding[];
}

const label = (node: SceneNode): string => nodeName(node);

const spoken = (node: SceneNode, length = 40): string =>
  node.kind !== "text" || /^\d+$/.test(node.key.split("/").at(-1) ?? "")
    ? label(node)
    : `${label(node)} ("${short(textOf(node), length)}")`;

const VISIBLE = 0.05;

const add = (
  survey: Survey,
  finding: Omit<Finding, "source" | "related"> & { readonly related?: readonly string[] },
): void => {
  const source = survey.sources.get(finding.key);
  const { related, ...rest } = finding;

  survey.out.push({
    ...rest,
    ...(source && { source }),
    ...(related &&
      related.length > 0 && {
        related: related.map((key): Related => {
          const at = survey.sources.get(key);

          return at ? { key, source: at } : { key };
        }),
      }),
  });
};

const isGone = (survey: Survey, entry: Entry): boolean =>
  [...entry.ancestors, entry.node].some((node) => survey.gone.has(node.key));

const isLeaf = (entry: Entry): boolean => entry.node.kind !== "group";

const shown = (
  survey: Survey,
  entry: Entry,
): { readonly t: Seconds; readonly placed: Placed; readonly box: Box }[] =>
  survey.times.flatMap((t, i) => {
    const at = survey.frames[i]!.get(entry.node.key);

    return at && at.opacity > VISIBLE && !inside(survey.hidden.get(entry.node.key) ?? [], t)
      ? [{ t, placed: at, box: at.box }]
      : [];
  });

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
      const { width, height } = boxOf(geometry);
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

const unpainted = (scene: Scene, node: ShapeNode, duration: Seconds): string | undefined => {
  if (!clearThroughout(scene, node.fill)) return undefined;
  const fill = node.fill === undefined ? "no fill" : "a fill that is fully transparent";
  const { stroke } = node;

  if (!stroke) return `it has ${fill} and no stroke`;

  if (clearThroughout(scene, stroke.color))
    return `it has ${fill} and a stroke that is fully transparent`;

  if (covers(zerosOf(stroke.width, duration), 0, duration))
    return `it has ${fill} and a stroke 0 wide`;

  if (trimmedAway(node.trim)) return `it has ${fill} and its stroke is trimmed to nothing`;

  return undefined;
};

const unwritten = (scene: Scene, node: TextNode, duration: Seconds): string | undefined => {
  const runs = runsOf(node).filter((run) => run.text.trim() !== "");

  if (runs.length === 0) return undefined;

  if (runs.every((run) => clearThroughout(scene, run.fill)))
    return "every run's fill is fully transparent";

  if (
    runs.every(
      (run) =>
        clearThroughout(scene, run.fill) ||
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

const neverVisible = (survey: Survey): void => {
  const { scene } = survey;
  const { duration } = scene;

  for (const entry of survey.entries.slice(1)) {
    if (isGone(survey, entry)) continue;
    const { node } = entry;
    const hide = "Give it an opacity and a scale above 0 at some time, or remove it.";

    const why =
      hiddenWhy(survey, entry) ??
      (node.kind === "shape" ? unpainted(scene, node, duration) : undefined) ??
      (node.kind === "text" ? unwritten(scene, node, duration) : undefined);

    if (why) {
      survey.gone.add(node.key);
      add(survey, {
        code: "never-visible",
        severity: "warning",
        key: node.key,
        message: `${label(node)} is never visible: ${why}.`,
        hint:
          why.includes("fill") || why.includes("stroke")
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
        hint: "Give the clip a size, or remove the clip.",
      });
      continue;
    }

    const flat =
      (node.kind === "shape" &&
        flatThroughout(node.geometry) &&
        describeGeometry(isLane(node.geometry) ? node.geometry.keys[0].value : node.geometry)) ||
      (node.kind === "text" && textOf(node) === "" && "a text with no characters") ||
      (node.kind === "image" &&
        (node.size[0] === 0 || node.size[1] === 0) &&
        `an image ${units(node.size[0])} by ${units(node.size[1])}`);

    if (flat) {
      survey.gone.add(node.key);
      add(survey, {
        code: "zero-size",
        severity: "warning",
        key: node.key,
        message: `${label(node)} has no size at any time (${flat}), so it draws nothing.`,
        hint:
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
    const own = placed(reachOf(entry.node, survey.scene.symbols, "inspect"), entry.node);

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

  if (!SCHEMES.every((scheme) => opaque(survey.scene, node.fill, scheme))) return undefined;

  if (![...entry.ancestors, node].every(isPlain)) return undefined;
  const at = survey.frames[0]!.get(node.key);

  if (!at || !isUpright(at.matrix) || at.matrix[0] <= 0 || at.matrix[3] <= 0) return undefined;

  return {
    entry,
    box: at.box,
    radius: Math.max(...node.geometry.radius) * Math.max(at.matrix[0], at.matrix[3]),
  };
};

const opaque = (scene: Scene, paint: ShapeNode["fill"], scheme: Scheme): boolean => {
  if (paint === undefined || isLane(paint) || "stops" in paint) return false;

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

const covered = (survey: Survey): void => {
  const covers = survey.entries.flatMap((entry) => {
    const cover = coverOf(survey, entry);

    return cover ? [cover] : [];
  });

  for (const entry of survey.entries) {
    if (!isLeaf(entry) || isGone(survey, entry)) continue;
    const later = covers.filter((cover) => cover.entry.order > entry.order);

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
      hint: `Draw it after "${cover.entry.node.key}" (later among its siblings), or move it out from under it.`,
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

const offCanvas = (survey: Survey): void => {
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
        hint: "Move it onto the canvas, or remove it.",
      });
    }
  }

  for (const entry of survey.entries) {
    if (!isLeaf(entry) || isGone(survey, entry) || clippedAround(entry)) continue;
    const seen = shown(survey, entry);

    if (seen.length === 0 || !still(seen.map((s) => s.box))) continue;
    const { box } = seen[0]!;
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
        hint: "Move it inside, shorten it, give it a width to wrap to, or shrink its size.",
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
      hint: "Move it inside, or let it bleed well past the edge if the crop is meant.",
      times: seen.map((s) => s.t),
    });
  }
};

const short = (text: string, length = 40): string =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

const wideLines = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || isGone(survey, entry)) continue;

    const widest = Math.max(
      0,
      ...node.lines.map((line) => {
        const ends = line.runs.map(
          (run) => run.at[0] + run.advances.reduce((sum, a) => sum + a, 0),
        );

        return ends.length === 0 ? 0 : Math.max(...ends) - node.box.x;
      }),
    );

    if (widest <= node.box.width + 0.5) continue;
    add(survey, {
      code: "text-overflow",
      severity: "warning",
      key: node.key,
      message: `${spoken(node)} has a line ${units(widest)} wide in a column ${units(node.box.width)} wide: a single character is wider than the width it wraps to.`,
      hint: "Give it a wider width to wrap to, or a smaller size.",
    });
  }
};

const ink = (box: Box): Box => ({ ...box, y: box.y + box.height / 4, height: box.height / 2 });

const travelling = (entry: Entry, t: Seconds): boolean =>
  [...entry.ancestors, entry.node].some(
    (node) =>
      movingAt(node.at, t) ||
      node.layers.some(
        (layer) =>
          movingAt(layer.offset, t) || movingAt(layer.rotate, t) || movingAt(layer.scale, t),
      ),
  );

const fading = (entry: Entry, t: Seconds): boolean =>
  [...entry.ancestors, entry.node].some((node) =>
    node.layers.some((layer) => movingAt(layer.opacity, t) || movingAt(layer.scale, t)),
  );

const overlap = (survey: Survey): void => {
  const texts = survey.entries.filter(
    (entry) =>
      entry.node.kind === "text" &&
      !isGone(survey, entry) &&
      ![...entry.ancestors, entry.node].some((node) => node.mask !== undefined),
  );

  const pairs = new Map<
    string,
    { readonly a: Entry; readonly b: Entry; readonly times: Seconds[] }
  >();

  survey.times.forEach((t, i) => {
    const frame = survey.frames[i]!;

    const up = texts.flatMap((entry) => {
      const at = frame.get(entry.node.key);

      return at && at.opacity > VISIBLE && !fading(entry, t) && !travelling(entry, t)
        ? [{ entry, box: ink(at.box) }]
        : [];
    });

    for (let x = 0; x < up.length; x++)
      for (let y = x + 1; y < up.length; y++) {
        const [a, b] = [up[x]!, up[y]!];

        if (a.entry.node.kind !== "text" || b.entry.node.kind !== "text") continue;

        if (textOf(a.entry.node) === textOf(b.entry.node)) continue;
        const shared = sharedArea(a.box, b.box);

        if (shared <= 0.3 * Math.min(area(a.box), area(b.box))) continue;

        if (hiddenBetween(survey, frame, a.entry, b.entry, t)) continue;
        const key = `${a.entry.node.key}\u0000${b.entry.node.key}`;
        const known = pairs.get(key) ?? { a: a.entry, b: b.entry, times: [] };

        known.times.push(t);
        pairs.set(key, known);
      }
  });

  for (const { a, b, times } of pairs.values()) {
    if (a.node.kind !== "text" || b.node.kind !== "text") continue;
    add(survey, {
      code: "overlap",
      severity: "warning",
      key: a.node.key,
      message: `${spoken(a.node, 24)} and ${spoken(b.node, 24)} overlap while both are shown, at ${list(times)}.`,
      hint: "Move one, or hide one while the other shows.",
      times,
      related: [b.node.key],
    });
  }
};

const hiddenBetween = (
  survey: Survey,
  frame: ReadonlyMap<string, Placed>,
  a: Entry,
  b: Entry,
  t: Seconds,
): boolean => {
  const [lower, upper] = a.order < b.order ? [a, b] : [b, a];
  const box = frame.get(lower.node.key)?.box;

  if (!box) return false;

  return survey.entries.slice(lower.order + 1, upper.order).some((entry) => {
    const at = frame.get(entry.node.key);

    return (
      entry.node.kind === "shape" &&
      at !== undefined &&
      at.opacity > 0.95 &&
      flatAt(survey, entry, at, t) !== undefined &&
      sharedArea(at.box, box) > 0.8 * area(box)
    );
  });
};

const list = (times: readonly Seconds[]): string => {
  const shown = times.slice(0, 4).map(seconds).join(", ");

  return times.length > 4 ? `${shown} and ${times.length - 4} more` : shown;
};

const missingGlyphs = (survey: Survey): void => {
  const { fonts } = survey.scene;

  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || isGone(survey, entry)) continue;
    const missing = new Map<string, Set<string>>();

    for (const run of runsOf(node)) {
      const family = fonts[run.face.family];

      if (!family) continue;

      const face =
        family.faces.find((f) => f.weight === run.face.weight && f.style === run.face.style) ??
        family.face(run.face.weight, run.face.style);

      for (const char of FontBook.missing(face, run.text)) {
        const name = `${run.face.family} ${run.face.weight}${run.face.style === "italic" ? " italic" : ""}`;
        missing.set(name, (missing.get(name) ?? new Set()).add(char));
      }
    }

    for (const [face, chars] of missing) {
      const shown = [...chars].map(charName);

      add(survey, {
        code: "missing-glyph",
        severity: "error",
        key: node.key,
        message: `${spoken(node)} uses ${shown.join(", ")}, which ${face} has no glyph for, so each target draws something different there.`,
        hint: "Load a face that has these characters, or write the text without them.",
      });
    }
  }
};

const luminance = ([r, g, b]: Rgba): number => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a: Rgba, b: Rgba): number => {
  const [x, y] = [luminance(a), luminance(b)];

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const over = (top: Rgba, alpha: number, under: Rgba): Rgba => {
  const a = top[3] * alpha;
  const mix = (i: 0 | 1 | 2) => top[i] * a + under[i] * (1 - a);

  return [mix(0), mix(1), mix(2), 1];
};

interface Flat {
  readonly name: string;
  readonly color: Readonly<Record<Scheme, Rgba>>;
}

const flatAt = (
  survey: Survey,
  entry: Entry,
  at: Placed,
  t: Seconds,
  box?: Box,
): Flat | undefined => {
  const { node } = entry;

  if (node.kind !== "shape" || node.fill === undefined || at.opacity < 0.999) return undefined;

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

  if (!light || !dark || light[3] < 0.999 || dark[3] < 0.999) return undefined;
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

    const held = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ].every(([x, y]) => rx > 0 && ry > 0 && ((x! - cx) / rx) ** 2 + ((y! - cy) / ry) ** 2 <= 1);

    return held ? flat : undefined;
  }

  return undefined;
};

const behind = (
  survey: Survey,
  entry: Entry,
  frame: ReadonlyMap<string, Placed>,
  box: Box,
  t: Seconds,
): { readonly key: string; readonly flat: Flat } | undefined => {
  for (let i = entry.order - 1; i > 0; i--) {
    const under = survey.entries[i]!;

    if (!isLeaf(under) || survey.gone.has(under.node.key)) continue;
    const at = frame.get(under.node.key);

    if (!at || at.opacity <= 1e-3 || inside(survey.hidden.get(under.node.key) ?? [], t)) continue;

    if (sharedArea(at.box, box) <= 0) continue;
    const flat = flatAt(survey, under, at, t, box);

    return flat && { key: under.node.key, flat };
  }

  return undefined;
};

interface Contrast {
  readonly ratio: number;
  readonly scheme: Scheme;
  readonly other: number;
  readonly color: string;
  readonly under: string;
  readonly key: string;
}

const lowContrast = (survey: Survey): void => {
  const { scene } = survey;

  for (const entry of survey.entries) {
    const { node } = entry;

    if (isGone(survey, entry)) continue;
    const paints = paintsOf(scene, node);

    if (paints.length === 0) continue;
    let worst: Contrast | undefined;
    const low: Seconds[] = [];
    let need = 0;

    survey.times.forEach((t, i) => {
      const frame = survey.frames[i]!;
      const at = frame.get(node.key);

      if (!at || at.opacity < 0.99 || fading(entry, t)) return;
      const { box } = at;
      const back = behind(survey, entry, frame, box, t);

      if (!back) return;
      const size = node.kind === "text" ? node.size * scaleOf(at.matrix) : 0;
      const bold = node.kind === "text" && runsOf(node).every((run) => run.face.weight >= 700);

      const threshold =
        node.kind === "text" ? (size >= 24 || (bold && size >= 18.66) ? 3 : 4.5) : 3;

      let found: Contrast | undefined;

      for (const { paint, alpha, steady } of paints) {
        if (movingAt(paint, t) || !steady(t) || alpha(t) < 0.99) continue;

        const by = SCHEMES.flatMap((scheme) => {
          const color = colorAt(scene, paint, t, scheme);

          return color
            ? [
                {
                  scheme,
                  value: ratio(
                    over(color, alpha(t), back.flat.color[scheme]),
                    back.flat.color[scheme],
                  ),
                },
              ]
            : [];
        });

        if (by.length < 2) continue;
        const [lo, hi] = by[0]!.value <= by[1]!.value ? [by[0]!, by[1]!] : [by[1]!, by[0]!];
        const value = between(paint, t);

        if (!found || lo.value < found.ratio)
          found = {
            ratio: lo.value,
            scheme: lo.scheme,
            other: hi.value,
            color: paintName(value.amount >= 0.5 ? value.to : value.from),
            under: back.flat.name,
            key: back.key,
          };
      }

      if (!found || found.ratio >= threshold) return;
      low.push(t);
      need = Math.max(need, threshold);

      if (!worst || found.ratio < worst.ratio) worst = found;
    });

    if (!worst) continue;
    const text = node.kind === "text";
    const floor = text ? 3 : 1.5;

    const what = text ? `${spoken(node, 24)}` : `the stroke of ${label(node)}`;

    const other = worst.scheme === "light" ? "dark" : "light";

    add(survey, {
      code: "low-contrast",
      severity: worst.ratio < floor ? "warning" : "info",
      key: node.key,
      message: `${what} is hard to see: ${worst.color} on ${worst.under} is ${worst.ratio.toFixed(2)}:1 in the ${worst.scheme} scheme (${worst.other.toFixed(2)}:1 in ${other}), under the ${need}:1 ${text ? "text this size needs" : "a thin line needs"}.`,
      hint: `Pick a ${text ? "fill" : "stroke color"} farther from ${worst.under} in both schemes${text ? ", or make the text larger" : ", or make the line wider"}.`,
      times: low,
      related: [worst.key],
    });
  }
};

const paintsOf = (
  scene: Scene,
  node: SceneNode,
): {
  readonly paint: Animated<Paint>;
  readonly alpha: (t: Seconds) => number;
  readonly steady: (t: Seconds) => boolean;
}[] => {
  if (node.kind === "text")
    return runsOf(node)
      .filter((run) => run.text.trim() !== "")
      .map((run) => ({
        paint: run.fill,
        alpha: (t: Seconds) => {
          if (run.opacity === undefined) return 1;
          const { from, to, amount } = between(run.opacity, t);

          return from + (to - from) * amount;
        },
        steady: (t: Seconds) => run.opacity === undefined || !movingAt(run.opacity, t),
      }));

  if (node.kind !== "shape" || !node.stroke || !clearThroughout(scene, node.fill)) return [];

  const width = isLane(node.stroke.width)
    ? Math.max(...node.stroke.width.keys.map((key) => key.value))
    : node.stroke.width;

  return width > 0 && width <= 2
    ? [{ paint: node.stroke.color, alpha: () => 1, steady: () => true }]
    : [];
};

const gap = (
  survey: Survey,
  entry: Entry,
  named: Named,
  [then, now]: readonly [Seconds, Seconds],
  scale: number,
): string | undefined => {
  const where = nodeName(entry.node);

  switch (named.kind) {
    case "number": {
      const [a, b] = [valueAt(named.value, now, mixNumber), valueAt(named.value, then, mixNumber)];
      const { name } = named;

      if (name === "rotate") {
        const turn = Math.abs(((a - b) % 360) + 360) % 360;
        const by = Math.min(turn, 360 - turn);

        return by > 0.5 ? `its rotate jumps ${units(by)}°` : undefined;
      }

      const limit = name.includes("opacity")
        ? 0.02
        : name === "stroke width"
          ? 0.25
          : 0.5 / Math.max(scale, 1e-6);

      return Math.abs(a - b) > limit
        ? `its ${name} jumps from ${units(b)} to ${units(a)}`
        : undefined;
    }

    case "vec": {
      const [a, b] = [valueAt(named.value, now, mixVec), valueAt(named.value, then, mixVec)];
      const [dx, dy] = [a[0] - b[0], a[1] - b[1]];
      const { name } = named;

      if (name === "scale" || name === "trim") {
        if (name === "trim" && (a[0] === a[1] || b[0] === b[1])) return undefined;

        return Math.max(Math.abs(dx), Math.abs(dy)) > 0.01
          ? `its ${name} jumps from ${b.map(units).join(", ")} to ${a.map(units).join(", ")}`
          : undefined;
      }

      const by = Math.hypot(dx, dy) * scale;

      return by > 0.5 ? `its ${name} moves it ${units(by)}` : undefined;
    }

    case "geometry": {
      const a = valueAt(named.value, now, mixGeometry, `geometry on ${where}`);
      const b = valueAt(named.value, then, mixGeometry, `geometry on ${where}`);

      if (outlineGap(a, b) * scale <= 0.5) return undefined;
      const [x, y] = [boxOf(a), boxOf(b)];

      if (Math.abs(x.width - y.width) * scale > 0.5 || Math.abs(x.height - y.height) * scale > 0.5)
        return `its ${named.name} jumps from ${units(y.width)} by ${units(y.height)} to ${units(x.width)} by ${units(x.height)}`;

      return `its ${named.name} jumps to another outline`;
    }

    case "paint": {
      const [a, b] = [paintAt(named.value, now), paintAt(named.value, then)];

      const changed = SCHEMES.some((scheme) => {
        const [x, y] = [
          colorAt(survey.scene, named.value, now, scheme),
          colorAt(survey.scene, named.value, then, scheme),
        ];

        if (!x || !y) return !same(a, b);

        return x.some((c, i) => Math.abs(c - y[i]!) > 2 / 255);
      });

      return changed
        ? `its ${named.name} jumps from ${paintName(b)} to ${paintName(a)}`
        : undefined;
    }
  }
};

const paintAt = (value: Animated<Paint>, t: Seconds): Paint => {
  const { from, to, amount } = between(value, t);

  return amount < 0.5 ? from : to;
};

const traced = (geometry: Geometry): Vec[][] =>
  contoursOf(geometry).map((contour) => {
    const points: Vec[] = [contour.start];
    let from = contour.start;

    for (const [c1, c2, to] of contour.curves) {
      for (let i = 1; i <= 16; i++) {
        const u = i / 16;
        const v = 1 - u;

        points.push([
          v ** 3 * from[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * to[0],
          v ** 3 * from[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * to[1],
        ]);
      }

      from = to;
    }

    return points;
  });

const toSegment = ([px, py]: Vec, [ax, ay]: Vec, [bx, by]: Vec): number => {
  const [dx, dy] = [bx - ax, by - ay];
  const span = dx * dx + dy * dy;
  const u = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));

  return Math.hypot(px - ax - dx * u, py - ay - dy * u);
};

const outlineGap = (a: Geometry, b: Geometry): number => {
  const [x, y] = [traced(a), traced(b)];

  const oneWay = (from: Vec[][], to: Vec[][]): number =>
    Math.max(
      0,
      ...from
        .flat()
        .map((point) =>
          Math.min(
            ...to.flatMap((line) =>
              line.length === 1
                ? [Math.hypot(point[0] - line[0]![0], point[1] - line[0]![1])]
                : line.slice(1).map((end, i) => toSegment(point, line[i]!, end)),
            ),
          ),
        ),
    );

  return x.length === 0 || y.length === 0
    ? x.length === y.length
      ? 0
      : Infinity
    : Math.max(oneWay(x, y), oneWay(y, x));
};

const restarts = (
  survey: Survey,
  { node, ancestors }: Entry,
  first: ReadonlyMap<string, Placed>,
  end: Seconds,
): boolean => {
  if (node.kind !== "text") return false;
  const words = textOf(node);

  return survey.entries.some(
    (other) =>
      other.node !== node &&
      other.node.kind === "text" &&
      other.ancestors.at(-1) === ancestors.at(-1) &&
      textOf(other.node) === words &&
      (first.get(other.node.key)?.opacity ?? 0) > VISIBLE &&
      !inside(survey.hidden.get(other.node.key) ?? [], 0) &&
      inside(survey.hidden.get(other.node.key) ?? [], end),
  );
};

const loopSeam = (survey: Survey): void => {
  const { scene } = survey;
  const { duration } = scene;

  if (!scene.loop || duration <= 0) return;
  const end = duration - Math.max(1e-6, duration * 1e-7);
  const [first, last] = [framesOf(scene, [0])[0]!, framesOf(scene, [end])[0]!];
  const seams = new Set<string>();
  const byKey = new Map(survey.entries.map((each) => [each.node.key, each.node]));

  for (const entry of survey.entries.slice(1)) {
    if (isGone(survey, entry)) continue;
    const { node } = entry;
    const [a, b] = [first.get(node.key), last.get(node.key)];

    const hidden = survey.hidden.get(node.key) ?? [];
    const above = entry.ancestors.at(-1);

    if (
      b &&
      b.opacity > VISIBLE &&
      !inside(hidden, end) &&
      (!a || a.opacity <= VISIBLE || inside(hidden, 0)) &&
      !(above && above !== scene.root && inside(survey.hidden.get(above.key) ?? [], 0)) &&
      !restarts(survey, entry, first, end)
    ) {
      const entered = merged(hidden).find(([from]) => from <= 1e-6)?.[1] ?? 0;

      add(survey, {
        code: "loop-seam",
        severity: "warning",
        key: node.key,
        message: `${label(node)} enters at ${seconds(entered)} and never leaves, so it vanishes when the loop starts again at 0s.`,
        hint: "Let it leave before the end (exit(), a fade, or .rewind() on its timeline), or have it on screen from 0s.",
        times: [Number(end.toFixed(3)), 0],
      });
      continue;
    }

    if (
      !a ||
      !b ||
      a.opacity <= VISIBLE ||
      b.opacity <= VISIBLE ||
      inside(hidden, 0) ||
      inside(hidden, end)
    )
      continue;
    const parent = entry.ancestors.at(-1);
    const scale = parent ? scaleOf(first.get(parent.key)?.matrix ?? [1, 0, 0, 1, 0, 0]) : 1;

    const jumps = valuesOf(node).flatMap((named) => {
      const said =
        isLane(named.value) && named.value.period === undefined
          ? gap(survey, entry, named, [end, 0], scale)
          : undefined;

      return said ? [said] : [];
    });

    if (jumps.length === 0) continue;
    const connector = [...entry.ancestors, node].reverse().find((each) => each.authored?.ends);

    if (connector) {
      const moved = (connector.authored?.ends ?? []).filter((key) => {
        const [from, to] = [first.get(key), last.get(key)];

        return (
          !from ||
          !to ||
          Math.abs(from.opacity - to.opacity) > VISIBLE ||
          Math.max(
            Math.abs(from.box.x - to.box.x),
            Math.abs(from.box.y - to.box.y),
            Math.abs(from.box.width - to.box.width),
            Math.abs(from.box.height - to.box.height),
          ) > 0.5
        );
      });

      if (seams.has(connector.key)) continue;
      seams.add(connector.key);

      if (moved.length > 0) {
        const names = moved.map((key) => nodeName(byKey.get(key) ?? connector)).join(" and ");

        add(survey, {
          code: "loop-seam",
          severity: "warning",
          key: connector.key,
          message: `${label(connector)} jumps when the loop starts again, from ${seconds(duration)} back to 0s, because its ends follow ${names}, which is not at 0s where it is at the end: it scales, fades or moves in. The arrow is redrawn to match, so it jumps too.`,
          hint: `End the loop with ${names} as it starts (exit() it, or .rewind() its motion), or bring the arrow in after its ends settle and take it out before the end.`,
          times: [Number(end.toFixed(3)), 0],
        });
        continue;
      }
    }

    add(survey, {
      code: "loop-seam",
      severity: "warning",
      key: node.key,
      message: `${label(node)} jumps when the loop starts again, from ${seconds(duration)} back to 0s: ${[...new Set(jumps)].join(", ")}.`,
      hint: "End each of its motions where it starts (.rewind() closes a loop), or fade it out before the end.",
      times: [Number(end.toFixed(3)), 0],
    });
  }
};

const ownOpacity = (node: SceneNode, t: Seconds): number =>
  node.layers.reduce((product, layer) => {
    const { from, to, amount } = between(layer.opacity, t);

    return product * (from + (to - from) * amount);
  }, 1);

const HOLD = 0.1;

const STEP = 0.005;

const popsIn = (
  node: SceneNode,
  duration: Seconds,
): readonly [cut: Seconds, back: Seconds] | undefined => {
  if (!node.layers.some((layer) => isLane(layer.opacity))) return undefined;
  const start = ownOpacity(node, 0);

  if (start <= 0.5) return undefined;
  const count = Math.ceil(duration / STEP);
  let cut: Seconds | undefined;

  for (let i = 1; i <= count; i++) {
    const t = Math.min(duration, i * STEP);
    const value = ownOpacity(node, t);

    if (cut === undefined) {
      if (value <= VISIBLE) cut = t;
      else if (Math.abs(value - start) > 0.01) return undefined;
    } else if (value > VISIBLE) return t - cut < HOLD ? [cut, t] : undefined;
  }

  return undefined;
};

const length = ([from, to]: Vec): number => Math.abs(to - from);

const arrives = (scene: Scene, node: SceneNode): boolean => {
  if (node.kind === "shape") return node.trim !== undefined && isLane(node.trim);

  if (node.kind !== "text") return false;

  return runsOf(node).some(
    (run) =>
      (run.opacity !== undefined && isLane(run.opacity)) ||
      (isLane(run.fill) && run.fill.keys.some((key) => clearThroughout(scene, key.value))),
  );
};

const timing = (survey: Survey): void => {
  const { scene } = survey;
  const { duration } = scene;
  let enters = false;
  let moves = false;

  for (const entry of survey.entries) {
    const { node } = entry;
    const named = valuesOf(node);

    if (named.some(({ value }) => isLane(value))) moves = true;

    if (isGone(survey, entry)) continue;
    const hidden = survey.hidden.get(node.key) ?? [];

    if (isLeaf(entry) && (hidden.length > 0 || arrives(scene, node))) enters = true;

    for (const { name, value } of named) {
      if (!isLane(value) || value.period !== undefined) continue;
      const changes = changesOf(value, duration);

      if (changes.length > 0 && changes.every(([from]) => from >= duration - 1e-6))
        add(survey, {
          code: "static",
          severity: "warning",
          key: node.key,
          message: `${label(node)}'s ${name} changes only at ${seconds(changes[0]![0])}, after the scene ends at ${seconds(duration)}, so it never moves.`,
          hint: "Move the motion into the scene's duration, or make the scene longer.",
        });
    }

    const pop = popsIn(node, duration);

    if (pop)
      add(survey, {
        code: "visible-at-zero",
        severity: "error",
        key: node.key,
        message: `${label(node)} shows from 0s, cuts to hidden at ${seconds(pop[0])}, and comes straight back by ${seconds(pop[1])}.`,
        hint: "Start its motion from the hidden values, as in motion({ opacity: 0 }), so it is hidden from 0s.",
        times: [0, pop[0], pop[1]],
      });

    if (
      node.kind === "shape" &&
      node.trim !== undefined &&
      isLane(node.trim) &&
      !isLane(node.fill ?? [0, 0, 0, 0]) &&
      !clearThroughout(scene, node.fill)
    ) {
      const trim = node.trim;
      const atZero = between(trim, 0);
      const drawn = trim.keys.findIndex((key) => length(key.value) >= 0.99);

      if (length(atZero.from) < 0.01 && drawn > 0 && !inside(hidden, 0))
        add(survey, {
          code: "visible-at-zero",
          severity: "error",
          key: node.key,
          message: `${label(node)} has its fill showing at 0s while its stroke only draws in by ${seconds(trim.keys[drawn]!.t)}.`,
          hint: "Drop the fill, or fade the fill in after the draw.",
          times: [0],
        });
    }

    wasted(survey, entry, hidden, named);
  }

  if (!moves && duration > 0)
    add(survey, {
      code: "static",
      severity: "warning",
      key: scene.root.key,
      message: `Nothing in the scene moves in its ${seconds(duration)}.`,
      hint: "Animate something, or make it a still picture with a duration of 0.",
    });
  else if (moves && !enters)
    add(survey, {
      code: "nothing-enters",
      severity: "info",
      key: scene.root.key,
      message: "Everything is on screen from 0s, and nothing ever enters.",
      hint: "Let the main parts enter in turn (enter(), a fade or a draw), unless the loop is meant to start mid-motion.",
    });
};

const wasted = (
  survey: Survey,
  entry: Entry,
  hidden: readonly Stretch[],
  named: readonly Named[],
): void => {
  const { duration, loop } = survey.scene;
  const visible = shownOf(hidden, duration);

  if (hidden.length === 0 || visible.length === 0) return;
  const [first, last] = [visible[0]![0], visible.at(-1)![1]];
  const before = new Map<string, Stretch[]>();
  const after = new Map<string, Stretch[]>();

  for (const item of named) {
    const { name, value } = item;

    if (!isLane(value) || value.period !== undefined) continue;

    for (const change of changesOf(value, duration)) {
      if (change[1] < first - 1e-6) before.set(name, [...(before.get(name) ?? []), change]);
      else if (change[0] > last + 1e-6 && change[0] < duration) {
        if (loop && gap(survey, entry, item, [change[1], 0], 1) === undefined) continue;
        after.set(name, [...(after.get(name) ?? []), change]);
      }
    }
  }

  const said = (map: ReadonlyMap<string, Stretch[]>): string =>
    [...map]
      .map(
        ([name, changes]) =>
          `${name} (${changes.map(([a, b]) => (a === b ? seconds(a) : `${seconds(a)} to ${seconds(b)}`)).join(", ")})`,
      )
      .join(", ");

  if (before.size > 0)
    add(survey, {
      code: "wasted-motion",
      severity: "info",
      key: entry.node.key,
      message: `${label(entry.node)} changes its ${said(before)} before it is first visible at ${seconds(first)}, where no one sees it.`,
      hint: "Start it with the values it should show, or move the change to when it is visible.",
    });

  if (after.size > 0)
    add(survey, {
      code: "wasted-motion",
      severity: "info",
      key: entry.node.key,
      message: `${label(entry.node)} changes its ${said(after)} after it is gone for good at ${seconds(last)}, where no one sees it.`,
      hint: "Drop the change, or show the node while it happens.",
    });
};

const unusedSymbols = (survey: Survey): void => {
  const used = new Set<string>();

  const visit = (node: SceneNode): void => {
    if (node.kind === "instance") used.add(node.symbol);

    if (node.kind === "group") node.children.forEach(visit);

    if (node.mask) visit(node.mask);
  };

  visit(survey.scene.root);
  Object.values(survey.scene.symbols).forEach(visit);

  for (const [name, root] of Object.entries(survey.scene.symbols))
    if (!used.has(name))
      add(survey, {
        code: "unused-symbol",
        severity: "info",
        key: root.key,
        message: `The symbol "${name}" is never drawn: no instance uses it.`,
        hint: `Draw it with <Instance symbol={...} />, or remove it.`,
      });
};

const capabilities = (survey: Survey, backend: InspectOptions["backend"]): void => {
  if (!backend) return;

  for (const found of diagnose(survey.scene, backend))
    add(survey, {
      code: found.severity === "error" ? "unsupported" : "approximate",
      severity: found.severity,
      key: found.key,
      message: found.message,
      hint:
        found.severity === "error"
          ? `Draw it without ${FEATURES[found.feature]} for ${backend.name}, or emit for a backend that has it.`
          : `Keep it if the difference is fine for ${backend.name}, or draw it without ${FEATURES[found.feature]}.`,
    });
};

const folded = (findings: readonly Finding[], names: ReadonlyMap<string, string>): Finding[] => {
  const out: Finding[] = [];
  const at = new Map<string, { index: number; more: string[]; times: Set<Seconds> }>();

  for (const finding of findings) {
    const { source, key } = finding;

    if (!source || key === "") {
      out.push(finding);
      continue;
    }

    const id = [
      finding.code,
      finding.severity,
      source.file,
      source.line,
      source.column,
      finding.message.replaceAll(names.get(key) ?? `"${key}"`, ""),
    ].join("\u0000");

    const known = at.get(id);

    if (known) {
      known.more.push(key);

      for (const t of finding.times ?? []) known.times.add(t);
    } else {
      at.set(id, { index: out.length, more: [], times: new Set(finding.times) });
      out.push(finding);
    }
  }

  for (const { index, more, times } of at.values()) {
    if (more.length === 0) continue;
    const first = out[index]!;

    out[index] = {
      ...first,
      message: first.message.replace(
        names.get(first.key) ?? `"${first.key}"`,
        (name) => `${name} (and ${more.length} more written at the same place)`,
      ),
      related: [
        ...(first.related ?? []),
        ...more.map((key): Related => ({ key, source: first.source! })),
      ],
      ...(times.size > 0 && { times: [...times].sort((a, b) => a - b) }),
    };
  }

  return out;
};

const RANK: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 };

const CONTAINERS = { stack: "<Stack>", grid: "<Grid>" } as const;

const overlapOf = (a: Box, b: Box): Vec | undefined => {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  return across > 0.5 && down > 0.5 ? [across, down] : undefined;
};

const boxesShown = (survey: Survey, entry: Entry): ReadonlyMap<Seconds, Box> =>
  new Map(
    survey.times.flatMap((t, i): [Seconds, Box][] => {
      const at = survey.frames[i]!.get(entry.node.key);

      return at && at.opacity > VISIBLE && !inside(survey.hidden.get(entry.node.key) ?? [], t)
        ? [[t, at.box]]
        : [];
    }),
  );

const layoutOverlap = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;
    const container = node.authored?.layout?.container;

    if (
      node.kind !== "group" ||
      container === undefined ||
      container === "align" ||
      container === "center"
    )
      continue;

    if (isGone(survey, entry)) continue;

    const children = survey.entries
      .filter(
        (each) =>
          each.ancestors.at(-1) === node && !each.node.authored?.backdrop && !isGone(survey, each),
      )
      .map((each) => ({ entry: each, boxes: boxesShown(survey, each) }));

    children.forEach((a, i) => {
      for (const b of children.slice(i + 1)) {
        let most: Vec = [0, 0];

        const times = survey.times.filter((t) => {
          const [x, y] = [a.boxes.get(t), b.boxes.get(t)];
          const by = x && y ? overlapOf(x, y) : undefined;

          if (by && by[0] * by[1] > most[0] * most[1]) most = by;

          return by !== undefined;
        });

        if (times.length === 0) continue;
        add(survey, {
          code: "layout-overlap",
          severity: "warning",
          key: a.entry.node.key,
          message: `${label(a.entry.node)} and ${label(b.entry.node)} overlap by up to ${units(most[0])} by ${units(most[1])} in the ${CONTAINERS[container]} "${node.key}", at ${list(times)}. It placed them apart; a motion, rotate or scale carried one over the other.`,
          hint: `Give the ${CONTAINERS[container]} a larger gap, or move, turn or grow the child less.`,
          times,
          related: [b.entry.node.key],
        });
      }
    });
  }
};

const lineText = (node: TextNode, index: number): string =>
  node.lines[index]?.runs.map((run) => run.text).join("") ?? "";

const wordCuts = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || isGone(survey, entry)) continue;
    const wrap = node.authored?.wrap;

    if (!wrap || wrap.cuts.length === 0) continue;

    const words = wrap.cuts.map(
      (index) =>
        `"${lineText(node, index).split(/\s+/).at(-1)}|${lineText(node, index + 1).split(/\s+/)[0]}"`,
    );

    add(survey, {
      code: "word-cut",
      severity: "warning",
      key: node.key,
      message: `${spoken(node)} wraps to ${units(wrap.width)} wide, and a word wider than that is cut across lines where | marks: ${words.join(", ")}.`,
      hint: "Give it a wider width to wrap to, a smaller size, or a shorter word.",
    });
  }
};

const unattachedRefs = (survey: Survey): void => {
  const { root, authored } = survey.scene;

  for (const { key, attached } of authored?.refs ?? []) {
    if (attached) continue;
    add(survey, {
      code: "unattached-ref",
      severity: "warning",
      key: root.key,
      message: `ref "${key}" is made, but no node takes it as ref={…}, so it points at nothing.`,
      hint: "Give the node it is for ref={…}, or remove the ref.",
    });
  }
};

const hiddenTargets = (survey: Survey): void => {
  const byKey = new Map(survey.entries.map((entry) => [entry.node.key, entry]));
  const said = new Set<string>();

  for (const { verb, key } of survey.scene.authored?.actions ?? []) {
    const entry = byKey.get(key);

    if (!entry || !isGone(survey, entry) || said.has(`${verb}\u0000${key}`)) continue;
    said.add(`${verb}\u0000${key}`);
    add(survey, {
      code: "hidden-target",
      severity: "warning",
      key,
      message: `${verb} moves "${key}", which is never visible, so no one sees the move.`,
      hint: "Show the node at some time, or move the node that is seen.",
    });
  }
};

export const inspect = (scene: Scene, options: InspectOptions = {}): Finding[] => {
  const entries = entriesOf(scene);
  const times = momentsOf(scene, options.times);

  const survey: Survey = {
    scene,
    entries,
    sources: sourcesOf(scene),
    times,
    frames: framesOf(scene, times),
    hidden: new Map(entries.map((entry) => [entry.node.key, hiddenOf(entry, scene.duration)])),
    gone: new Set(),
    out: [],
  };

  neverVisible(survey);
  offCanvas(survey);
  wideLines(survey);
  missingGlyphs(survey);
  overlap(survey);
  lowContrast(survey);
  loopSeam(survey);
  timing(survey);
  unusedSymbols(survey);
  layoutOverlap(survey);
  wordCuts(survey);
  unattachedRefs(survey);
  hiddenTargets(survey);
  capabilities(survey, options.backend);

  const order = new Map(entries.map((entry) => [entry.node.key, entry.order]));

  return folded(survey.out, namesOf(scene))
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        RANK[a.finding.severity] - RANK[b.finding.severity] ||
        (order.get(a.finding.key) ?? Infinity) - (order.get(b.finding.key) ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ finding }) => finding);
};
