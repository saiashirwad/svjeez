import { contoursOf, mixGeometry, outlineBoxOf } from "../model/geometry";
import type { Animated, Geometry, Paint, Scene, SceneNode, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import { nodeName } from "../model/naming";
import { mixNumber, mixVec, same, type Mix } from "../model/steps";
import type { Seconds } from "../model/time";
import { layerMatrix, times, valueAt, type Matrix, type Placed } from "./boxes";
import { VISIBLE, add, isGone, isLeaf, label, type Survey } from "./inspect-context";
import {
  SCHEMES,
  between,
  changesOf,
  clearThroughout,
  colorAt,
  countAt,
  countOf,
  frameAt,
  inCount,
  inside,
  merged,
  paintName,
  runsOf,
  scaleOf,
  seconds,
  shownOf,
  textOf,
  units,
  valuesOf,
  type Entry,
  type Named,
  type Stretch,
} from "./survey";

const gap = (
  survey: Survey,
  entry: Entry,
  named: Named,
  [then, now]: readonly [Seconds, Seconds],
  scale: number,
): string | undefined => {
  const where = nodeName(entry.node);

  switch (named.kind) {
    case "number":
      return numberGap(
        named.name,
        valueAt(named.value, then, mixNumber),
        valueAt(named.value, now, mixNumber),
        scale,
      );

    case "vec":
      return vecGap(
        named.name,
        valueAt(named.value, then, mixVec),
        valueAt(named.value, now, mixVec),
        scale,
      );

    case "geometry": {
      const a = valueAt(named.value, now, mixGeometry, `geometry on ${where}`);
      const b = valueAt(named.value, then, mixGeometry, `geometry on ${where}`);

      if (outlineGap(a, b) * scale <= 0.5) return undefined;
      const [x, y] = [outlineBoxOf(a), outlineBoxOf(b)];

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

        return ([0, 1, 2, 3] as const).some((i) => Math.abs(x[i] - y[i]) > 2 / 255);
      });

      return changed
        ? `its ${named.name} jumps from ${paintName(b)} to ${paintName(a)}`
        : undefined;
    }
  }
};

/** How a number jumps from `b` to `a`, if it does. */
const numberGap = (name: string, b: number, a: number, scale: number): string | undefined => {
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

  return Math.abs(a - b) > limit ? `its ${name} jumps from ${units(b)} to ${units(a)}` : undefined;
};

/** How a point jumps from `b` to `a`, if it does. */
const vecGap = (name: string, b: Vec, a: Vec, scale: number): string | undefined => {
  const [dx, dy] = [a[0] - b[0], a[1] - b[1]];

  if (name === "scale" || name === "trim") {
    if (name === "trim" && (a[0] === a[1] || b[0] === b[1])) return undefined;

    return Math.max(Math.abs(dx), Math.abs(dy)) > 0.01
      ? `its ${name} jumps from ${b.map(units).join(", ")} to ${a.map(units).join(", ")}`
      : undefined;
  }

  const by = Math.hypot(dx, dy) * scale;

  return by > 0.5 ? `its ${name} moves it ${units(by)}` : undefined;
};

/** A value as the seam sees it: a lane that loops on its own period counts as its value at 0. */
const seamAt = <T>(value: Animated<T>, t: Seconds, mix: Mix<T>): T =>
  valueAt(value, isLane(value) && value.period !== undefined ? 0 : t, mix);

/** What all of a node's layers come to at `t`: the transform they make, and each kind of value combined. */
const composed = (node: SceneNode, t: Seconds) => {
  const at = <T>(value: Animated<T>, mix: Mix<T>): T => seamAt(value, t, mix);

  const still = node.layers.map((layer) => ({
    offset: at(layer.offset, mixVec),
    rotate: at(layer.rotate, mixNumber),
    scale: at(layer.scale, mixVec),
    skew: at(layer.skew, mixNumber),
    opacity: at(layer.opacity, mixNumber),
  }));

  return {
    matrix: still.map((layer) => layerMatrix(layer, node.origin, 0)).reduce(times, IDENTITY),
    offset: still.reduce<Vec>((sum, { offset: [x, y] }) => [sum[0] + x, sum[1] + y], [0, 0]),
    rotate: still.reduce((sum, { rotate }) => sum + rotate, 0),
    scale: still.reduce<Vec>(
      (product, { scale: [x, y] }) => [product[0] * x, product[1] * y],
      [1, 1],
    ),
    skew: still.reduce((sum, { skew }) => sum + skew, 0),
    opacity: still.reduce((product, { opacity }) => product * opacity, 1),
  };
};

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * How a node's layers jump at the seam, judged on what they come to together, so an enter() and an exit() on the
 * same value that end where they start are no jump.
 */
const layersGap = (node: SceneNode, [then, now]: readonly [Seconds, Seconds], scale: number) => {
  if (node.layers.length === 0) return [];
  const [b, a] = [composed(node, then), composed(node, now)];
  const linear = [0, 1, 2, 3].some((i) => Math.abs(a.matrix[i]! - b.matrix[i]!) > 0.01);
  const moved = Math.hypot(a.matrix[4] - b.matrix[4], a.matrix[5] - b.matrix[5]) * scale > 0.5;

  if (!linear && !moved && Math.abs(a.opacity - b.opacity) <= 0.02) return [];

  const said = [
    vecGap("offset", b.offset, a.offset, scale),
    numberGap("rotate", b.rotate, a.rotate, scale),
    vecGap("scale", b.scale, a.scale, scale),
    numberGap("skew", b.skew, a.skew, scale),
    numberGap("opacity", b.opacity, a.opacity, scale),
  ].filter((each) => each !== undefined);

  return said.length > 0 ? said : ["its motion layers jump"];
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

/** Whether none of what a node draws at `t` is on the canvas: its visible leaves all lie outside it. */
const beyond = (
  survey: Survey,
  node: SceneNode,
  frame: ReadonlyMap<string, Placed>,
  t: Seconds,
): boolean => {
  const [width, height] = survey.scene.size;

  return !survey.entries.some((entry) => {
    if (!isLeaf(entry) || (entry.node !== node && !entry.ancestors.includes(node))) return false;
    const placed = frame.get(entry.node.key);

    return (
      placed !== undefined &&
      placed.opacity > VISIBLE &&
      !inside(survey.hidden.get(entry.node.key) ?? [], t) &&
      placed.box.x + placed.box.width > 0 &&
      placed.box.y + placed.box.height > 0 &&
      placed.box.x < width &&
      placed.box.y < height
    );
  });
};

export const loopSeam = (survey: Survey): void => {
  const { scene } = survey;
  const { duration } = scene;

  if (!scene.loop || duration <= 0) return;
  const end = duration - Math.max(1e-6, duration * 1e-7);
  const [first, last] = [frameAt(scene, 0), frameAt(scene, end)];
  const seams = new Set<string>();
  const byKey = new Map(survey.entries.map((each) => [each.node.key, each.node]));

  for (const entry of survey.entries.slice(1)) {
    if (isGone(survey, entry) || inCount(entry)) continue;
    const { node } = entry;
    const [a, b] = [first.get(node.key), last.get(node.key)];

    const hidden = survey.hidden.get(node.key) ?? [];
    const above = entry.ancestors.at(-1);
    const count = countOf(node);

    if (
      count &&
      a &&
      b &&
      a.opacity > VISIBLE &&
      b.opacity > VISIBLE &&
      !inside(hidden, 0) &&
      !inside(hidden, end) &&
      countAt(count, end) !== countAt(count, 0)
    )
      add(survey, {
        code: "loop-seam",
        severity: "warning",
        key: node.key,
        message: `${label(node)} shows ${JSON.stringify(countAt(count, end))} at the end and jumps to ${JSON.stringify(countAt(count, 0))} when the loop starts again at 0s.`,
        fix: "Count back to where it starts (.rewind() on its track), or fade it out before the end.",
        times: [Number(end.toFixed(3)), 0],
      });

    if (
      b &&
      b.opacity > VISIBLE &&
      !inside(hidden, end) &&
      !beyond(survey, node, last, end) &&
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
        fix: "Let it leave before the end (exit(), a fade, or .rewind() on its track), or have it on screen from 0s.",
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
      inside(hidden, end) ||
      (beyond(survey, node, first, 0) && beyond(survey, node, last, end))
    )
      continue;
    const parent = entry.ancestors.at(-1);
    const scale = parent ? scaleOf(first.get(parent.key)?.matrix ?? [1, 0, 0, 1, 0, 0]) : 1;

    const layered = new Set<unknown>(
      node.layers.flatMap((layer) => [
        layer.offset,
        layer.rotate,
        layer.scale,
        layer.skew,
        layer.opacity,
      ]),
    );

    const jumps = [
      ...valuesOf(node).flatMap((named) => {
        const said =
          isLane(named.value) && named.value.period === undefined && !layered.has(named.value)
            ? gap(survey, entry, named, [end, 0], scale)
            : undefined;

        return said ? [said] : [];
      }),
      ...layersGap(node, [end, 0], scale),
    ];

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
          fix: `End the loop with ${names} as it starts (exit() it, or .rewind() its track), or bring the arrow in after its ends settle and take it out before the end.`,
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
      fix: "End each of its motions where it starts (.rewind() closes a loop), or fade it out before the end.",
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

export const timing = (survey: Survey): void => {
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
          fix: "Move the motion into the scene's duration, or make the scene longer.",
        });
    }

    const pop = popsIn(node, duration);

    if (pop)
      add(survey, {
        code: "visible-at-zero",
        severity: "error",
        key: node.key,
        message: `${label(node)} shows from 0s, cuts to hidden at ${seconds(pop[0])}, and comes straight back by ${seconds(pop[1])}.`,
        fix: "Start its track from the hidden values, as in motion={{ opacity: track(0).to(1, span(…)) }}, so it is hidden from 0s.",
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
          fix: "Drop the fill, or fade the fill in after the draw.",
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
      fix: "Animate something, or make it a still picture with a duration of 0.",
    });
  else if (moves && !enters)
    add(survey, {
      code: "nothing-enters",
      severity: "info",
      key: scene.root.key,
      message: "Everything is on screen from 0s, and nothing ever enters.",
      fix: "Let the main parts enter in turn (enter(), a fade or a draw), unless the loop is meant to start mid-motion.",
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
      fix: "Start it with the values it should show, or move the change to when it is visible.",
    });

  if (after.size > 0)
    add(survey, {
      code: "wasted-motion",
      severity: "info",
      key: entry.node.key,
      message: `${label(entry.node)} changes its ${said(after)} after it is gone for good at ${seconds(last)}, where no one sees it.`,
      fix: "Drop the change, or show the node while it happens.",
    });
};
