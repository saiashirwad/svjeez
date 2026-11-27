import { basename } from "node:path";
import { boundsOfPoints, boxCorners } from "../model/geometry";
import { culledOf, merged, outside } from "../model/dark";
import type { Animated, Box, Effect, SceneNode, Source, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import { reachOf } from "../model/reach";
import type { Seconds } from "../model/time";
import { apply, inverse, type Matrix, type Placed } from "./boxes";
import { add, isGone, label, type Survey } from "./inspect-context";
import { changesOf, inside, seconds, units, valuesOf, type Entry, type Stretch } from "./survey";

/** What a filter reads: its own parameters. Anything else that moves under it makes it run again. */
const PARAMETERS = /^(blur|adjust|displace|shadow|noise)\b/;

/** What of a filtered node itself is redrawn through its filter (placing and fading it are not). */
const OWN = new Set([
  "geometry",
  "fill",
  "stroke color",
  "stroke width",
  "trim",
  "text fill",
  "text opacity",
]);

/** The parts of a transform that make Chromium raster a filter again: turning, scaling, shearing. Moving it is free. */
const TURNS = new Set(["rotate", "scale", "skew"]);

/**
 * What one pixel of each effect costs to raster, relative to noise, from `svjeez perf` probes: full-canvas layers of
 * each kind under an animated scale, counting how many it takes to drop frames in desktop Chrome.
 */
export const WEIGHTS: Readonly<Record<Effect["kind"], number>> = {
  noise: 1,
  emboss: 1.5,
  blur: 0.6,
  shadow: 0.6,
  displace: 0.5,
  adjust: 0.3,
};

/** How much more a filter costs when its space is turned or sheared on the canvas: Chromium rasters it in its own space and resamples it. */
export const TURNED = 2.5;

/** Units² of noise-equivalent filter raster a 60 fps frame has room for, in desktop Chrome. */
export const BUDGET = 21e6;

/** How long the work has to stay over the budget to drop frames anyone sees. */
const SUSTAIN = 0.5;

/**
 * How much more a filter re-run every frame costs the still filters it is drawn over, per unit² it covers, than
 * unfiltered motion does: fit to the lace and watercolour shots, where pedalling birds and a pelican under a filter
 * dropped frames over textured layers that the same motion unfiltered did not.
 */
export const FILTERED = 10;

/** A filter's share of the work over budget that it is named as a cause in a warning. */
const NAMED = 0.1;

/** A still filter that moving content dirties is reported only when it costs this share of the budget. */
const DIRTY = 0.1;

export type Cause =
  | { readonly kind: "params"; readonly name: string }
  | { readonly kind: "inside"; readonly node: SceneNode }
  | { readonly kind: "ancestor"; readonly node: SceneNode; readonly what: string }
  | { readonly kind: "over"; readonly node: SceneNode; readonly filtered: boolean };

export interface FilterWork {
  readonly entry: Entry;
  /** Units² of noise-equivalent raster per frame, at each sampled moment. */
  work: number[];
  /** Why it is rastered at each sampled moment it is, the first cause found. */
  causes: (Cause | undefined)[];
  /** The canvas share its region covers, at its largest. */
  share: number;
  readonly reach: Box;
  /** The stretches of motion that make it re-run, where it is drawn: exact, where `work` is sampled. */
  readonly stretches: Stretch[];
}

export interface Work {
  readonly times: readonly Seconds[];
  /** Seconds each sampled moment stands for. */
  readonly weights: readonly number[];
  /** Total units² a frame at each moment. */
  readonly total: readonly number[];
  readonly filters: readonly FilterWork[];
  /** The work the scene keeps up for SUSTAIN seconds or more: what decides whether it drops frames. */
  readonly sustained: number;
}

const area = (box: Box): number => Math.max(0, box.width) * Math.max(0, box.height);

const meet = (a: Box, b: Box): Box | undefined => {
  const [x, y] = [Math.max(a.x, b.x), Math.max(a.y, b.y)];
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return right <= x || bottom <= y ? undefined : { x, y, width: right - x, height: bottom - y };
};

const mapped = (m: Matrix, box: Box): Box =>
  boundsOfPoints(boxCorners(box).map((p) => apply(m, p)));

/**
 * Device units² a filter rasters to fill `clip` (a canvas box): the filter runs in the node's own space, so a turned
 * filter fills the box, in its own space, around the clip turned back.
 */
const rastered = (m: Matrix, region: Box, clip: Box): number => {
  const back = inverse(m);

  if (!back) return 0;
  const local = meet(mapped(back, clip), region);

  return local ? area(local) * Math.abs(m[0] * m[3] - m[1] * m[2]) : 0;
};

const isTurned = (m: Matrix): boolean => {
  const scale = Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]), 1e-9);

  return (
    Math.min(Math.abs(m[0]), Math.abs(m[1])) / scale > 1e-3 ||
    Math.min(Math.abs(m[2]), Math.abs(m[3])) / scale > 1e-3
  );
};

const most = (value: Animated<number>): number =>
  isLane(value) ? Math.max(...value.keys.map((key) => Math.abs(key.value))) : Math.abs(value);

const farthest = (value: Animated<Vec>): number =>
  isLane(value)
    ? Math.max(...value.keys.map((key) => Math.hypot(...key.value)))
    : Math.hypot(...value);

/** How far, in the node's own units, its effects spread past what it draws. */
const spreadOf = (node: SceneNode): number =>
  node.effects.reduce((sum, effect) => {
    if (effect.kind === "blur") return sum + 3 * most(effect.radius);

    if (effect.kind === "shadow") return sum + farthest(effect.offset) + 3 * most(effect.blur);

    return effect.kind === "displace" ? sum + most(effect.scale) : sum;
  }, 0);

/** Where on the canvas a filter's output lands: what its content draws there, spread by its effects, inside its region. */
const landsOf = (node: SceneNode, placed: Placed, region: Box): Box | undefined => {
  const by =
    spreadOf(node) *
    Math.sqrt(Math.abs(placed.matrix[0] * placed.matrix[3] - placed.matrix[1] * placed.matrix[2]));

  const drawn = {
    x: placed.box.x - by,
    y: placed.box.y - by,
    width: placed.box.width + 2 * by,
    height: placed.box.height + 2 * by,
  };

  return meet(drawn, mapped(placed.matrix, region));
};

const weightOf = (node: SceneNode, m: Matrix): number =>
  node.effects.reduce((sum, effect) => sum + WEIGHTS[effect.kind], 0) * (isTurned(m) ? TURNED : 1);

/** Seconds each moment stands for: half the gap to each neighbour, inside the scene. */
const weightsOf = (times: readonly Seconds[], duration: Seconds): number[] =>
  times.map((t, i) => {
    const before = i === 0 ? 0 : (t + times[i - 1]!) / 2;
    const after = i === times.length - 1 ? Math.max(duration, t) : (t + times[i + 1]!) / 2;

    return Math.max(0, after - before);
  });

/**
 * The level the work stays at or over for SUSTAIN seconds (or the whole scene, when it is shorter). Between two
 * sampled moments the work is taken as the lower of the two, so a change that lasts one sample gap counts for that gap.
 */
const sustainedOf = (times: readonly Seconds[], total: readonly number[], duration: Seconds) => {
  if (times.length === 1) return total[0] ?? 0;
  const need = Math.min(SUSTAIN, Math.max(duration, 1e-6) * 0.999);

  const gaps = times.slice(1).map((t, i) => ({
    level: Math.min(total[i]!, total[i + 1]!),
    length: t - times[i]!,
  }));

  let held = 0;

  for (const { level, length } of gaps.sort((a, b) => b.level - a.level)) {
    held += length;

    if (held >= need - 1e-9) return level;
  }

  return 0;
};

/** Predicts the filter raster each sampled frame needs: what re-runs every filter, and how much of it. */
export const workOf = (survey: Survey): Work => {
  const { scene } = survey;
  const [width, height] = scene.size;
  const canvas: Box = { x: 0, y: 0, width, height };
  const culls = new Map<SceneNode, Stretch[]>();
  const children = new Map<SceneNode, Entry[]>();

  for (const entry of survey.entries)
    for (const ancestor of entry.ancestors)
      children.set(ancestor, [...(children.get(ancestor) ?? []), entry]);

  /** When the SVG stops drawing `node`, as svg.emit culls it. */
  const culled = (node: SceneNode, chain: readonly SceneNode[]): Stretch[] => {
    const known = culls.get(node);

    if (known) return known;

    const found = culledOf(node, scene, {
      moves: (children.get(node) ?? []).some((inner) =>
        valuesOf(inner.node).some(({ value }) => isLane(value)),
      ),
      clocked: chain.some((each) => each.clock !== undefined),
    });

    culls.set(node, found);

    return found;
  };

  const dark = new Map<Entry, Stretch[]>();

  const darkOf = (entry: Entry): Stretch[] => {
    const known = dark.get(entry);

    if (known) return known;
    const chain = [...entry.ancestors, entry.node];

    const found = merged(chain.flatMap((node, index) => culled(node, chain.slice(0, index + 1))));

    dark.set(entry, found);

    return found;
  };

  /** What of `stretches` the entry is drawn for: the SVG skips it while it or a group above it is culled. */
  const shown = (entry: Entry, stretches: readonly Stretch[]): Stretch[] =>
    outside(stretches, darkOf(entry)).filter(([a, b]) => b - a > 1e-6);

  /** When each node changes, split by what changes. */
  const motion = new Map<
    SceneNode,
    {
      readonly any: Stretch[];
      readonly turns: Stretch[];
      readonly own: { name: string; stretches: Stretch[] }[];
    }
  >();

  for (const entry of survey.entries) {
    if (isGone(survey, entry)) continue;
    const any: Stretch[] = [];
    const turns: Stretch[] = [];
    const own: { name: string; stretches: Stretch[] }[] = [];

    for (const { name, value } of valuesOf(entry.node)) {
      if (!isLane(value)) continue;
      const stretches = shown(entry, changesOf(value, scene.duration));

      if (stretches.length === 0) continue;
      any.push(...stretches);

      if (TURNS.has(name)) turns.push(...stretches);

      if (PARAMETERS.test(name) || OWN.has(name)) own.push({ name, stretches });
    }

    if (any.length > 0) motion.set(entry.node, { any: merged(any), turns: merged(turns), own });
  }

  const times = survey.frames.map(({ t }) => t);
  const weights = weightsOf(times, scene.duration);
  const regions = new Map<SceneNode, Box | undefined>();

  const regionOf = (node: SceneNode): Box | undefined => {
    if (!regions.has(node)) regions.set(node, reachOf(node, "inspect"));

    return regions.get(node);
  };

  const filtered = survey.entries.filter(
    (entry) => entry.node.effects.length > 0 && !isGone(survey, entry) && regionOf(entry.node),
  );

  const isFiltered = new Set(filtered.map((entry) => entry.node));

  /** The last paint order inside each filtered node: what is drawn after it is drawn over it. */
  const ends = new Map(
    filtered.map((entry) => [
      entry.node,
      Math.max(entry.order, ...(children.get(entry.node) ?? []).map((each) => each.order)),
    ]),
  );

  const filters: FilterWork[] = filtered.map((entry) => ({
    entry,
    work: times.map(() => 0),
    causes: times.map(() => undefined),
    share: 0,
    reach: regionOf(entry.node)!,
    stretches: [],
  }));

  survey.frames.forEach(({ t, frame }, i) => {
    const drawn = (entry: Entry): boolean => {
      const placed = frame.get(entry.node.key);

      return placed !== undefined && placed.opacity > 1e-3 && !inside(darkOf(entry), t);
    };

    const moving = (node: SceneNode): boolean => {
      const found = motion.get(node);

      return found !== undefined && inside(found.any, t);
    };

    /** Canvas boxes that repaint this frame, each with the node that dirties it, outermost first. */
    const dirty: { readonly box: Box; readonly entry: Entry; readonly filtered: boolean }[] = [];

    const outers = new Set<SceneNode>();

    for (const entry of survey.entries) {
      if (!motion.has(entry.node) || !moving(entry.node) || !drawn(entry)) continue;

      if (entry.ancestors.some((node) => moving(node))) continue;
      // A change under a filter repaints the whole filter's output, not just the box of what changed.
      const outer = [...entry.ancestors, entry.node].find((node) => isFiltered.has(node));

      if (outer) {
        const placed = frame.get(outer.key);
        const lands = placed && landsOf(outer, placed, regionOf(outer)!);
        const seen = lands && meet(lands, canvas);

        if (seen && !outers.has(outer)) dirty.push({ box: seen, entry, filtered: true });
        outers.add(outer);
        continue;
      }

      // Unfiltered, it repaints what it draws: each shape's box, not the box around a spread-out group.
      const leaves = entry.node.kind === "group" ? (children.get(entry.node) ?? []) : [entry];

      for (const leaf of leaves) {
        if (leaf.node.kind === "group" || !drawn(leaf)) continue;
        const placed = frame.get(leaf.node.key);
        const seen = placed && meet(placed.box, canvas);

        if (seen) dirty.push({ box: seen, entry, filtered: false });
      }
    }

    for (const filter of filters) {
      const { entry } = filter;
      const { node } = entry;

      if (!drawn(entry)) continue;
      const placed = frame.get(node.key)!;
      const region = regionOf(node)!;
      const lands = landsOf(node, placed, region);
      const seen = lands && meet(lands, canvas);

      if (!seen) continue;
      const whole = rastered(placed.matrix, region, seen);

      filter.share = Math.max(filter.share, Math.min(1, area(seen) / area(canvas)));

      const params = motion.get(node)?.own.find(({ stretches }) => inside(stretches, t));
      const inner = (children.get(node) ?? []).find((each) => moving(each.node) && drawn(each));

      const turning = [...entry.ancestors, node].find((each) => {
        const found = motion.get(each);

        return found !== undefined && inside(found.turns, t);
      });

      const cause: Cause | undefined = params
        ? { kind: "params", name: params.name }
        : inner
          ? { kind: "inside", node: inner.node }
          : turning
            ? {
                kind: "ancestor",
                node: turning,
                what: [...TURNS]
                  .filter((name) =>
                    valuesOf(turning).some(
                      (value) =>
                        value.name === name &&
                        changesOf(value.value, scene.duration).some(
                          ([a, b]) => t >= a - 1e-6 && t <= b + 1e-6,
                        ),
                    ),
                  )
                  .join(" and "),
              }
            : undefined;

      if (cause) {
        filter.work[i] = whole * weightOf(node, placed.matrix);
        filter.causes[i] = cause;

        const known = params
          ? params.stretches
          : inner
            ? motion.get(inner.node)!.any
            : motion.get(turning!)!.turns;

        const hit = known.find(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6);

        if (hit) filter.stretches.push(hit);
        continue;
      }

      // Still itself: it rasters again where something drawn over it moves, once for each moving layer.
      const box = seen;
      const end = ends.get(node)!;
      const hits = new Map<Entry, { part: number; filtered: boolean }>();

      for (const each of dirty) {
        if (each.entry.order <= end) continue;
        const shared = meet(each.box, box);

        if (!shared) continue;
        const known = hits.get(each.entry) ?? { part: 0, filtered: each.filtered };

        known.part += rastered(placed.matrix, region, shared);
        hits.set(each.entry, known);
      }

      let hit = 0;
      let by: { entry: Entry; part: number; filtered: boolean } | undefined;

      for (const [mover, { part, filtered }] of hits) {
        // A filter re-run over it repaints its whole output each frame, and costs what it covers far more than plain motion.
        const counted = Math.min(whole, part * (filtered ? FILTERED : 1));

        hit += counted;

        if (!by || counted > by.part) by = { entry: mover, part: counted, filtered };
      }

      if (hit > 0 && by) {
        filter.work[i] = hit * weightOf(node, placed.matrix);
        filter.causes[i] = { kind: "over", node: by.entry.node, filtered: by.filtered };

        const during = motion
          .get(by.entry.node)!
          .any.find(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6);

        if (during) filter.stretches.push(during);
      }
    }
  });

  for (const filter of filters)
    filter.stretches.splice(0, Infinity, ...shown(filter.entry, merged(filter.stretches)));

  const total = times.map((_, i) => filters.reduce((sum, filter) => sum + filter.work[i]!, 0));

  return {
    times,
    weights,
    total,
    filters,
    sustained: sustainedOf(times, total, scene.duration),
  };
};

const where = (survey: Survey, node: SceneNode): string => {
  const entry = survey.entries.find((each) => each.node === node);

  const source: Source | undefined = [node, ...(entry?.ancestors.toReversed() ?? [])]
    .map((each) => survey.sources.get(each.key) ?? each.source)
    .find((found) => found !== undefined);

  return source ? ` at ${basename(source.file)}:${source.line}` : "";
};

/** What a cause says in a message, and what to change. */
interface Told {
  readonly why: string;
  readonly fix: string;
}

const describe = (survey: Survey, cause: Cause): Told => {
  switch (cause.kind) {
    case "params":
      return PARAMETERS.test(cause.name)
        ? {
            why: `its ${cause.name} changes`,
            fix: "Keep the effect's parameters still and move, fade or scale the node itself, or crossfade a sharp and a blurred copy.",
          }
        : {
            why: `its ${cause.name} changes under the effect`,
            fix: "Keep the filtered shape still and move something unfiltered, or crossfade two still filtered copies.",
          };
    case "inside":
      return {
        why: `${label(cause.node)}${where(survey, cause.node)} inside it moves`,
        fix: "Keep the filtered layer still and move something unfiltered over it: take the moving part out of the filtered group, or fake the effect on it with offset copies (a dark copy for a shadow, a pale one for a lit edge).",
      };
    case "ancestor":
      return {
        why: `${label(cause.node)}${where(survey, cause.node)} above it animates its ${cause.what}, so the filter is rastered again at every new ${cause.what}`,
        fix: "Move the transform below the filter (animate what is inside the filtered group, not a group around it), or keep the filtered layer still; moving it (offset/at) is free.",
      };
    case "over":
      return cause.filtered
        ? {
            why: `${label(cause.node)}${where(survey, cause.node)} moves inside a filter drawn over its region, so that filter re-runs every frame and this one is rastered again under it`,
            fix: "Drop the filter from the moving layer (fake a shadow or lit edge with offset copies), or keep the layer under it free of filters and textures.",
          }
        : {
            why: `${label(cause.node)}${where(survey, cause.node)} moves over its region, so the filter is rastered again where it repaints`,
            fix: "Keep large motion off filtered layers: make the moving layer smaller, move fewer full-frame layers over it, or drop the filter from the layer under the motion.",
          };
  }
};

const megapixels = (n: number): string => `${Number((n / 1e6).toFixed(1))}M`;

const kindsOf = (nodes: readonly SceneNode[]): string => {
  const kinds = [...new Set(nodes.flatMap((node) => node.effects.map((effect) => effect.kind)))];

  return kinds.length < 2 ? kinds.join("") : `${kinds.slice(0, -1).join(", ")} and ${kinds.at(-1)}`;
};

/** What one fix addresses: a transform, a mover, or one filter's own change. */
const groupOf = (filter: FilterWork, cause: Cause): string =>
  cause.kind === "ancestor" || cause.kind === "over"
    ? `${cause.kind} ${cause.node.key}`
    : `${cause.kind} ${filter.entry.node.key}`;

/** An effect that is run again every frame: its parameters move, what it filters does, a transform above it, or what repaints over it. */
export const movingFilter = (survey: Survey): number => {
  const found = workOf(survey);
  const { times, weights, total, sustained } = found;
  const { duration } = survey.scene;
  const hot = total.map((value) => sustained > BUDGET && value >= BUDGET);
  const hotCount = hot.filter(Boolean).length;

  const span = (at: readonly number[]): [Seconds, Seconds] => [
    Math.max(0, Math.min(...at.map((i) => times[i]! - (i === 0 ? 0 : weights[i]! / 2)))),
    Math.max(...at.map((i) => Math.min(times[i]! + weights[i]! / 2, duration))),
  ];

  /** Over the budget: each cause's share of the work in the frames past it. */
  const groups = new Map<
    string,
    { cause: Cause; filters: Set<FilterWork>; share: number; at: Set<number> }
  >();

  for (const filter of found.filters)
    filter.work.forEach((value, i) => {
      const cause = filter.causes[i];

      if (!hot[i] || !cause || value <= 0) return;
      const id = groupOf(filter, cause);
      const group = groups.get(id) ?? { cause, filters: new Set(), share: 0, at: new Set() };

      group.filters.add(filter);
      group.share += value / total[i]! / hotCount;
      group.at.add(i);
      groups.set(id, group);
    });

  const warned = new Set<FilterWork>();
  const over = `${megapixels(sustained)} units² of filter raster a frame, past the ${megapixels(BUDGET)} a 60 fps frame has room for`;

  for (const { cause, filters, share, at } of groups.values()) {
    if (share < NAMED) continue;
    const nodes = [...filters].map((filter) => filter.entry.node);
    const [from, to] = span([...at]);
    const during = `from ${seconds(from)} to ${seconds(to)}`;
    const part = `${Math.round(share * 100)}% of it`;
    const { fix } = describe(survey, cause);
    const many = nodes.length === 1 ? "a filter" : `${nodes.length} filters`;

    for (const filter of filters) warned.add(filter);

    const message =
      cause.kind === "ancestor"
        ? `${label(cause.node)} animates its ${cause.what} above ${many} (${kindsOf(nodes)}) ${during}, so Chromium rasters them again every frame: ${over}, ${part}.`
        : cause.kind === "over"
          ? `${label(cause.node)} moves ${cause.filtered ? "inside a filter drawn " : ""}over ${many} (${kindsOf(nodes)}) ${during}, so they are rastered again every frame where it repaints: ${over}, ${part}.`
          : `${label(nodes[0]!)} has a ${kindsOf(nodes)} rastered again every frame ${during}: ${describe(survey, cause).why}. That makes ${over}, ${part}.`;

    add(survey, {
      code: "moving-filter",
      severity: "warning",
      key: cause.kind === "ancestor" || cause.kind === "over" ? cause.node.key : nodes[0]!.key,
      message,
      fix,
      times: [from, to],
      related: nodes.map((node) => node.key).slice(0, 20),
    });
  }

  for (const filter of found.filters) {
    const { entry, work, causes } = filter;
    const { node } = entry;
    const at = work.flatMap((value, i) => (value > 0 ? [i] : []));

    if (at.length === 0 || warned.has(filter)) continue;
    const mean = at.reduce((sum, i) => sum + work[i]!, 0) / at.length;
    const lasting = at.some((i) => causes[i]?.kind !== "over");

    if (!lasting && mean < DIRTY * BUDGET) continue;
    const { stretches } = filter;

    const [from, to] =
      stretches.length > 0
        ? [Math.min(...stretches.map(([a]) => a)), Math.max(...stretches.map(([, b]) => b))]
        : span(at);

    const peak = at.reduce((best, i) => (work[i]! > work[best]! ? i : best), at[0]!);
    const cause = causes[peak]!;
    const { why, fix } = describe(survey, cause);
    const { reach } = filter;

    add(survey, {
      code: "moving-filter",
      severity: "info",
      key: node.key,
      message: `${label(node)} has a ${kindsOf([node])} that is rastered again every frame from ${seconds(from)} to ${seconds(to)} over ${units(reach.width)}×${units(reach.height)} units (${Math.round(filter.share * 100)}% of the canvas): ${why}.`,
      fix,
      times: [from, to],
      ...(cause.kind !== "params" && { related: [cause.node.key] }),
    });
  }

  return sustained;
};
