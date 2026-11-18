import { SceneError } from "../model/scene-error";
import { named, whereOf } from "./names";
import { num } from "../model/format";
import { EPSILON, type Seconds } from "../model/time";
import { checkWindow, span, type Span } from "./span";
import { matched, mixGeometry } from "../model/geometry";
import { isPlaced, placedLike } from "./identity";
import type {
  Authored,
  Effect,
  Lane,
  Animated,
  Geometry,
  GroupNode,
  Layer,
  Paint,
  SceneNode,
  ShapeNode,
  Stroke,
  TextLine,
  TextNode,
  TextRun,
  Vec,
} from "../model/ir";
import { isLane, pair } from "../model/lane";
import { flat, type Child, type SceneElement } from "./nodes";
import { ease, isSpring, type Curve } from "./spring";
import {
  Passage,
  laneOf,
  mixNumber,
  mixVec,
  noMix,
  same,
  type Mix,
  type Timing,
} from "../model/steps";
import { blendable, isGradient, mixPaint } from "./paint";
import type { LayerValues } from "./track";

export interface MorphOptions {
  readonly curve?: Curve;
  readonly enter?: LayerValues;
  readonly exit?: LayerValues;
  readonly stagger?: Seconds;
}

export interface MorphElement {
  readonly type: "morph";
  readonly states: readonly (readonly SceneElement[])[];
  readonly spans: readonly Span[];
  readonly options: MorphOptions;
  readonly only?: number;
}

const between = (
  states: readonly Child[],
  spans: readonly Span[],
  options: MorphOptions = {},
): SceneElement => {
  if (states.length < 2)
    throw new SceneError(`morph.between() needs two states or more, got ${states.length}.`);

  if (spans.length !== states.length - 1)
    throw new SceneError(
      `morph.between() takes one span per transition: ${states.length} states need ${states.length - 1} spans, got ${spans.length}.`,
    );

  spans.forEach(({ start, over }, i) => {
    checkWindow(start, over, "morph()");
    const before = spans[i - 1];

    if (before && start < before.start + before.over - EPSILON)
      throw new SceneError(
        `morph.between()'s spans must follow one another: span ${i + 1} starts at ${num(start)}s, before span ${i} ends at ${num(before.start + before.over)}s.`,
      );
  });

  const { stagger = 0 } = options;

  if (!(stagger >= 0 && Number.isFinite(stagger)))
    throw new SceneError(`morph() needs a stagger of 0 or more seconds, got ${stagger}.`);

  return { type: "morph", states: states.map(flat), spans, options };
};

export const morph = Object.assign(
  (before: Child, after: Child, when: Span, options: MorphOptions = {}): SceneElement =>
    between([before, after], [when], options),
  { between },
);

interface Entry {
  readonly key: string;
  readonly present: readonly boolean[];
  readonly filled: readonly SceneNode[];
  readonly children: readonly Entry[];
}

const keysOf = (nodes: readonly SceneNode[]): string[] => nodes.map((node) => node.key);

const ordered = (before: readonly string[], after: readonly string[]): string[] => {
  const out = [...after];
  const kept = new Set(after);
  let anchor = -1;

  for (const key of before)
    if (kept.has(key)) anchor = out.indexOf(key);
    else out.splice(++anchor, 0, key);

  return out;
};

const parentOf = (key: string): string => key.slice(0, Math.max(0, key.lastIndexOf("/")));

const placeNote = (key: string, nodes: readonly SceneNode[]): string =>
  nodes.some(isPlaced)
    ? ` It has no key, so it is matched by its place among its siblings: give each version a key, as in <Shape key="…" />.`
    : ` Give the two versions different keys, so one exits as the other enters.`;

const entries = (lists: readonly (readonly SceneNode[])[]): Entry[] => {
  const counts = lists.map((list) => list.filter(isPlaced).length);
  const where = lists.flat()[0];

  if (where && counts.some((count) => count !== counts[0])) {
    const parent = parentOf(where.key);

    throw new SceneError(
      `morph() matches nodes by key, and ${parent ? `inside ${named(parent)}` : "at the top"} the states have ${counts.join(", ")} nodes with no key, so they would pair up by their place. Give each node that comes, goes or changes a key, as in <Shape key="…" />.`,
    );
  }

  const order = lists.map(keysOf).reduce(ordered);

  return order.map((key) => {
    const found = lists.map((list) => list.find((node) => node.key === key));
    const nodes = found.filter((node): node is SceneNode => node !== undefined);
    const kinds = [...new Set(nodes.map((node) => node.kind))];

    if (kinds.length > 1)
      throw new SceneError(
        `morph() can't turn the node keyed "${key.split("/").at(-1)}" from a ${kinds[0]} into a ${kinds[1]}: a node keeps its kind across states.${placeNote(key, nodes)}`,
      );

    const filled = found.map((node, s) => {
      if (node) return node;
      const before = found.slice(0, s).findLast((other) => other !== undefined);

      return before ?? found.slice(s).find((other) => other !== undefined)!;
    });

    return {
      key,
      present: found.map((node) => node !== undefined),
      filled,
      children: kinds[0] === "group" ? entries(filled.map((node) => childrenOf(node))) : [],
    };
  });
};

const childrenOf = (node: SceneNode): readonly SceneNode[] =>
  node.kind === "group" ? node.children : [];

const drawing = (node: SceneNode): string => {
  const { source: _source, box: _box, ...rest } = node;

  return JSON.stringify(node.kind === "group" ? { ...rest, children: [] } : rest);
};

const changes = (entry: Entry, i: number): boolean =>
  entry.present[i] !== entry.present[i + 1] ||
  drawing(entry.filled[i]!) !== drawing(entry.filled[i + 1]!);

const changesWithin = (entry: Entry, i: number): boolean =>
  changes(entry, i) || entry.children.some((child) => changesWithin(child, i));

const units = (list: readonly Entry[], i: number): Entry[] => {
  const moving = list.filter((entry) => changesWithin(entry, i));
  const [only] = moving;

  return moving.length === 1 && only && !changes(only, i) ? units(only.children, i) : moving;
};

const preorder = (list: readonly Entry[]): Entry[] =>
  list.flatMap((entry) => [entry, ...preorder(entry.children)]);

interface Window {
  readonly start: Seconds;
  readonly over: Seconds;
}

interface Plan {
  readonly timing: Timing;
  readonly curve: Curve;
  readonly enter: Fixed;
  readonly exit: Fixed;
  readonly windows: ReadonlyMap<Entry, readonly Window[]>;
}

interface Fixed {
  readonly offset: Vec;
  readonly rotate: number;
  readonly scale: Vec;
  readonly opacity: number;
}

const IDLE: Fixed = { offset: [0, 0], rotate: 0, scale: [1, 1], opacity: 1 };

const layerOf = (values: LayerValues): Fixed => ({
  offset: values.offset ?? [0, 0],
  rotate: values.rotate ?? 0,
  scale: pair(values.scale ?? 1),
  opacity: values.opacity ?? 1,
});

const travel = <T>(
  plan: Plan,
  windows: readonly Window[],
  initial: T,
  from: readonly T[],
  to: readonly T[],
  mix: Mix<T>,
  where: string,
  curve: Curve = plan.curve,
): Animated<T> => {
  let passage = new Passage<{ readonly value: T }>({ initial: { value: initial }, steps: [] });
  let current = initial;

  windows.forEach(({ start, over }, i) => {
    if (!same(current, from[i]!)) passage = passage.set({ value: from[i]! }, { start });

    if (!same(from[i]!, to[i]!)) passage = passage.to({ value: to[i]! }, span(start, over), curve);
    current = to[i]!;
  });

  return laneOf(passage.data, initial, plan.timing, mix, where);
};

const blend = <T>(
  plan: Plan,
  entry: Entry,
  values: readonly Animated<T>[],
  mix: Mix<T>,
  what: string,
  curve?: Curve,
): Animated<T> => {
  const [first] = values;

  if (values.every((value) => same(value, first))) return first!;

  if (values.some(isLane))
    throw new SceneError(
      `morph() can't blend the ${what} of ${named(entry.key)}: it moves in a state (a track or a recipe) and also differs between states. Write it the same in every state, or let the morph move it.`,
    );

  // SAFETY: no value is a lane, so each is a T.
  const fixed = values as readonly T[];

  return travel(
    plan,
    plan.windows.get(entry)!,
    fixed[0]!,
    fixed.slice(0, -1),
    fixed.slice(1),
    mix,
    `${what} on ${named(entry.key)} in morph()`,
    curve,
  );
};

const agreed = <T>(entry: Entry, read: (node: SceneNode) => T, what: string): T => {
  const values = entry.filled.filter((_, s) => entry.present[s]).map(read);
  const other = values.find((value) => !same(value, values[0]));

  if (other !== undefined)
    throw new SceneError(
      `morph() can't blend ${named(entry.key)}: its ${what} differs between states, and ${what} doesn't animate.${placeNote(entry.key, entry.filled)}`,
    );

  return values[0]!;
};

const rotateScale = (rotate: number, [sx, sy]: Vec, [x, y]: Vec): Vec => {
  const angle = (rotate * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];

  return [cos * sx * x - sin * sy * y, sin * sx * x + cos * sy * y];
};

const rebased = (entry: Entry, node: SceneNode, origin: Vec): readonly Layer[] => {
  const [dx, dy] = [node.origin[0] - origin[0], node.origin[1] - origin[1]];

  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return node.layers;

  return node.layers.map((layer) => {
    if (isLane(layer.rotate) || isLane(layer.scale))
      throw new SceneError(
        `morph() can't blend ${named(entry.key)}: it turns or scales in a state, and its origin moves between states. Give it the same origin in every state, as in origin={[x, y]}.`,
      );
    const [mx, my] = rotateScale(layer.rotate, layer.scale, [dx, dy]);
    const shift: Vec = [dx - mx, dy - my];
    const move = (offset: Vec): Vec => [offset[0] + shift[0], offset[1] + shift[1]];

    return {
      ...layer,
      offset: isLane(layer.offset) ? shifted(layer.offset, move) : move(layer.offset),
    };
  });
};

const shifted = (lane: Lane<Vec>, move: (value: Vec) => Vec): Lane<Vec> => {
  const [head, next, ...rest] = lane.keys.map((key) => ({
    ...key,
    value: move(key.value),
    ...(key.via && { via: [move(key.via[0]), move(key.via[1])] as const }),
  }));

  return { ...lane, keys: [head!, next!, ...rest] };
};

const presence = (plan: Plan, entry: Entry, enter: Fixed, exit: Fixed): Layer | undefined => {
  const { present } = entry;

  if (present.every(Boolean)) return undefined;
  const windows = plan.windows.get(entry)!;
  const from: Fixed[] = [];
  const to: Fixed[] = [];
  let current = present[0] ? IDLE : enter;

  windows.forEach((_, i) => {
    const [now, next] = [present[i]!, present[i + 1]!];
    const start = now ? IDLE : next ? enter : current;
    const end = next ? IDLE : now ? exit : start;

    from.push(start);
    to.push(end);
    current = end;
  });

  const initial = present[0] ? IDLE : enter;
  const where = `entering or exiting on ${named(entry.key)} in morph()`;

  const field = <T>(read: (layer: Fixed) => T, mix: Mix<T>): Animated<T> =>
    travel(plan, windows, read(initial), from.map(read), to.map(read), mix, where);

  return {
    offset: field((layer) => layer.offset, mixVec),
    rotate: field((layer) => layer.rotate, mixNumber),
    scale: field((layer) => layer.scale, mixVec),
    opacity: field((layer) => layer.opacity, mixNumber),
  };
};

const layersOf = (plan: Plan, entry: Entry, origin: Vec): Layer[] => {
  const stacks = entry.filled.map((node) => rebased(entry, node, origin));
  const depth = Math.max(...stacks.map((stack) => stack.length));

  const padded = stacks.map((stack) => [
    ...stack,
    ...Array<Layer>(depth - stack.length).fill(IDLE),
  ]);

  return Array.from({ length: depth }, (_, i): Layer => {
    const at = padded.map((stack) => stack[i]!);

    return {
      offset: blend(
        plan,
        entry,
        at.map((layer) => layer.offset),
        mixVec,
        "offset",
      ),
      rotate: blend(
        plan,
        entry,
        at.map((layer) => layer.rotate),
        mixNumber,
        "rotate",
      ),
      scale: blend(
        plan,
        entry,
        at.map((layer) => layer.scale),
        mixVec,
        "scale",
      ),
      opacity: blend(
        plan,
        entry,
        at.map((layer) => layer.opacity),
        mixNumber,
        "opacity",
      ),
    };
  }).filter((layer) => !same(layer, IDLE));
};

const firstPresent = (entry: Entry): SceneNode => entry.filled[entry.present.indexOf(true)]!;

const placed = (plan: Plan, entry: Entry, enter: Fixed = plan.enter, exit: Fixed = plan.exit) => {
  const rest = firstPresent(entry);
  const shown = presence(plan, entry, enter, exit);
  const clip = clipOf(plan, entry);
  const mask = agreed(entry, (node) => node.mask, "mask");
  const mode = agreed(entry, (node) => node.blend ?? "normal", "blend");

  return {
    key: entry.key,
    ...(rest.name !== undefined && { name: rest.name }),
    ...(rest.source && { source: rest.source }),
    box: rest.box,
    at: blend(
      plan,
      entry,
      entry.filled.map((node) => node.at),
      mixVec,
      "at",
    ),
    origin: rest.origin,
    layers: [...(shown ? [shown] : []), ...layersOf(plan, entry, rest.origin)],
    ...(clip && { clip }),
    ...(mask && { mask }),
    ...(mode !== "normal" && { blend: mode }),
    effects: effectsOf(plan, entry),
  };
};

const clipOf = (plan: Plan, entry: Entry): Animated<Geometry> | undefined => {
  const clips = entry.filled.map((node) => node.clip);

  if (clips.every((clip) => clip === undefined)) return undefined;

  const given = clips.flatMap((clip) => (clip === undefined ? [] : [clip]));

  if (given.length < clips.length)
    throw new SceneError(
      `morph() can't blend ${named(entry.key)}: it has a clip in one state and none in another, and no outline blends into drawing everything. Give it a clip in every state, as large as the node where it should show all of it.`,
    );

  return outlinesOf(plan, entry, given, "clip");
};

const absent = (effect: Effect): Effect =>
  effect.kind === "blur" ? { kind: "blur", radius: 0 } : { ...effect, opacity: 0 };

const kinds = (effects: readonly Effect[]): string =>
  effects.map((effect) => effect.kind).join(", ");

const effectsOf = (plan: Plan, entry: Entry): Effect[] => {
  const lists = entry.filled.map((node) => node.effects);
  const template = lists.reduce((most, list) => (list.length > most.length ? list : most));
  const odd = lists.find((list) => list.length > 0 && kinds(list) !== kinds(template));

  if (odd)
    throw new SceneError(
      `morph() can't blend the effects of ${named(entry.key)}: one state has ${kinds(odd)} and another ${kinds(template)}. List the same effects in the same order in every state, or none.`,
    );
  const filled = lists.map((list) => (list.length === 0 ? template.map(absent) : list));
  const what = (name: string) => `${name} of an effect`;

  return template.map((effect, i): Effect => {
    const states = filled.map((list) => list[i]!);

    if (effect.kind === "blur")
      return {
        kind: "blur",
        radius: blend(
          plan,
          entry,
          states.map((each) => (each.kind === "blur" ? each.radius : 0)),
          mixNumber,
          what("blur radius"),
        ),
      };
    const shadows = states.flatMap((each) => (each.kind === "shadow" ? [each] : []));

    return {
      kind: "shadow",
      offset: blend(
        plan,
        entry,
        shadows.map((each) => each.offset),
        mixVec,
        what("shadow offset"),
      ),
      blur: blend(
        plan,
        entry,
        shadows.map((each) => each.blur),
        mixNumber,
        what("shadow blur"),
      ),
      color: blend(
        plan,
        entry,
        shadows.map((each) => each.color),
        noMix,
        what("shadow color"),
        paintCurve(plan),
      ),
      opacity: blend(
        plan,
        entry,
        shadows.map((each) => each.opacity),
        mixNumber,
        what("shadow opacity"),
      ),
    };
  });
};

const NONE: Paint = [0, 0, 0, 0];

const clear = (like: Animated<Paint> | undefined): Paint =>
  like !== undefined && !isLane(like) && isGradient(like)
    ? { ...like, stops: like.stops.map((stop) => ({ ...stop, color: NONE })) }
    : NONE;

const paintCurve = (plan: Plan): Curve | undefined =>
  isSpring(plan.curve) ? ease.inOut : undefined;

const paints = (
  plan: Plan,
  entry: Entry,
  values: readonly (Animated<Paint> | undefined)[],
  what: string,
): Animated<Paint> | undefined => {
  if (values.every((value) => value === undefined)) return undefined;
  const none = clear(values.find((value) => value !== undefined));

  return blendable(
    blend(
      plan,
      entry,
      values.map((value) => value ?? none),
      mixPaint,
      what,
      paintCurve(plan),
    ),
    `${what} on ${named(entry.key)} in morph()`,
  );
};

const numbersOf = (geometry: Geometry): number[] => {
  switch (geometry.kind) {
    case "rect":
      return [...geometry.size, ...geometry.radius];
    case "ellipse":
      return [...geometry.radius];
    case "arc":
      return [geometry.radius, geometry.start, geometry.sweep];
    case "line":
      return [...geometry.from, ...geometry.to];
    case "polygon":
      return geometry.points.flat();
    case "path":
      return geometry.contours.flatMap((contour) => [...contour.start, ...contour.curves.flat(2)]);
  }
};

const rebuilt = (template: Geometry, values: readonly number[]): Geometry => {
  let next = 0;
  const take = (): number => values[next++]!;
  const point = (): Vec => [take(), take()];

  switch (template.kind) {
    case "rect":
      return { kind: "rect", size: point(), radius: [take(), take(), take(), take()] };
    case "ellipse":
      return { kind: "ellipse", radius: point() };
    case "arc":
      return { kind: "arc", radius: take(), start: take(), sweep: take() };
    case "line":
      return { kind: "line", from: point(), to: point() };
    case "polygon":
      return { kind: "polygon", points: template.points.map(point), closed: template.closed };
    case "path":
      return {
        kind: "path",
        rule: template.rule,
        contours: template.contours.map((contour) => ({
          start: point(),
          curves: contour.curves.map(() => [point(), point(), point()] as const),
          closed: contour.closed,
        })),
      };
  }
};

const geometryMix = (template: Geometry): Mix<Geometry> =>
  Object.assign(
    (a: Geometry, b: Geometry, amount: number, where: string) => mixGeometry(a, b, amount, where),
    {
      parts: { split: numbersOf, join: (values: readonly number[]) => rebuilt(template, values) },
    },
  );

const geometryOf = (plan: Plan, entry: Entry, shapes: readonly ShapeNode[]): Animated<Geometry> =>
  outlinesOf(
    plan,
    entry,
    shapes.map((node) => node.geometry),
    "geometry",
  );

const outlinesOf = (
  plan: Plan,
  entry: Entry,
  values: readonly Animated<Geometry>[],
  what: string,
): Animated<Geometry> => {
  const [first] = values;

  if (values.every((value) => same(value, first))) return first!;

  if (values.some(isLane))
    throw new SceneError(
      `morph() can't blend the ${what} of ${named(entry.key)}: it moves in a state (a track) and also differs between states. Write it the same in every state, or let the morph reshape it.`,
    );

  // SAFETY: no value is a lane, so each is a geometry.
  const outlines = matched(
    values as readonly Geometry[],
    `${what} on ${named(entry.key)} in morph()`,
  );

  return blend(plan, entry, outlines, geometryMix(outlines[0]!), what);
};

const strokeOf = (
  plan: Plan,
  entry: Entry,
  nodes: readonly (ShapeNode | TextNode)[],
): Stroke | undefined => {
  const strokes = nodes.map((node) => node.stroke);
  const given = strokes.find((stroke) => stroke !== undefined);

  if (!given) return undefined;

  const styles = strokes.flatMap((stroke) =>
    stroke
      ? [
          {
            cap: stroke.cap,
            join: stroke.join,
            dash: stroke.dash,
            nonScaling: stroke.nonScaling,
            under: stroke.under,
          },
        ]
      : [],
  );

  if (styles.some((each) => !same(each, styles[0])))
    throw new SceneError(
      `morph() can't blend ${named(entry.key)}: its stroke's cap, join, dash, nonScaling or under differs between states, and those don't animate. Give the stroke the same style in every state.`,
    );

  return {
    ...given,
    color: blendable(
      blend(
        plan,
        entry,
        strokes.map((stroke) => (stroke ?? given).color),
        mixPaint,
        "stroke color",
        paintCurve(plan),
      ),
      `stroke color on ${named(entry.key)} in morph()`,
    ),
    width: blend(
      plan,
      entry,
      strokes.map((stroke) => stroke?.width ?? 0),
      mixNumber,
      "stroke width",
    ),
    ...(strokes.some((stroke) => stroke?.dashOffset !== undefined) && {
      dashOffset: blend(
        plan,
        entry,
        strokes.map((stroke) => stroke?.dashOffset ?? 0),
        mixNumber,
        "stroke dash offset",
      ),
    }),
  };
};

const shapeOf = (plan: Plan, entry: Entry): ShapeNode => {
  const shapes = entry.filled.filter((node): node is ShapeNode => node.kind === "shape");

  const fill = paints(
    plan,
    entry,
    shapes.map((node) => node.fill),
    "fill",
  );

  const stroke = strokeOf(plan, entry, shapes);
  const trims = shapes.map((node) => node.trim);

  const trim = trims.every((value) => value === undefined)
    ? undefined
    : blend<Vec>(
        plan,
        entry,
        trims.map((value) => value ?? [0, 1]),
        mixVec,
        "trim",
      );

  return {
    ...placed(plan, entry),
    kind: "shape",
    geometry: geometryOf(plan, entry, shapes),
    ...(fill !== undefined && { fill }),
    ...(stroke && { stroke }),
    ...(trim !== undefined && { trim }),
  };
};

const wording = (node: TextNode): string =>
  JSON.stringify([
    node.size,
    node.lines.map((line) => [
      line.at,
      line.runs.map(({ text, at, advances, face }) => [text, at, advances, face]),
    ]),
  ]);

const blendedLines = (plan: Plan, entry: Entry, states: readonly TextNode[]): TextLine[] =>
  states[0]!.lines.map((line, l) => ({
    at: line.at,
    runs: line.runs.map((run, r): TextRun => {
      const runs = states.map((node) => node.lines[l]!.runs[r]!);
      const { opacity: _, ...rest } = run;

      const opacity = runs.every((each) => each.opacity === undefined)
        ? undefined
        : blend(
            plan,
            entry,
            runs.map((each) => each.opacity ?? 1),
            mixNumber,
            "opacity of a run",
          );

      return {
        ...rest,
        fill: blendable(
          blend(
            plan,
            entry,
            runs.map((each) => each.fill),
            mixPaint,
            "fill",
            paintCurve(plan),
          ),
          `fill on ${named(entry.key)} in morph()`,
        ),
        ...(opacity !== undefined && opacity !== 1 && { opacity }),
      };
    }),
  }));

const FADE: Fixed = { ...IDLE, opacity: 0 };

const textOf = (plan: Plan, entry: Entry): TextNode | GroupNode => {
  const texts = entry.filled.filter((node): node is TextNode => node.kind === "text");

  if (texts.every((node) => wording(node) === wording(texts[0]!))) {
    const rest = texts[0]!;
    const stroke = strokeOf(plan, entry, texts);

    return {
      ...placed(plan, entry),
      kind: "text",
      size: rest.size,
      ...(stroke && { stroke }),
      lines: blendedLines(plan, entry, texts),
    };
  }

  const runs = texts.map((node) => texts.findIndex((other) => wording(other) === wording(node)));

  const children = [...new Set(runs)].map((run): TextNode => {
    const own = texts[run]!;
    const inRun = texts.map((node, s) => (runs[s] === run ? node : undefined));

    const filled = inRun.map(
      (node, s) => node ?? inRun.slice(0, s).findLast((other) => other !== undefined) ?? own,
    );

    const part: Entry = {
      key: `${entry.key}/${run}`,
      present: runs.map((each) => each === run),
      filled,
      children: [],
    };

    const windows = plan.windows.get(entry)!;
    const local: Plan = { ...plan, windows: new Map([[part, windows]]) };
    const shown = presence(local, part, FADE, FADE);

    return {
      kind: "text",
      key: part.key,
      ...(own.name !== undefined && { name: own.name }),
      ...(own.source && { source: own.source }),
      box: own.box,
      at: [0, 0],
      origin: own.origin,
      layers: shown ? [shown] : [],
      effects: [],
      size: own.size,
      ...(own.stroke && { stroke: own.stroke }),
      lines: blendedLines(local, part, filled),
    };
  });

  return { ...placed(plan, entry), kind: "group", children };
};

const countIn = (entry: Entry): Authored["count"] => {
  const counts = entry.filled
    .filter((_, s) => entry.present[s])
    .map((node) => (node.kind === "group" ? node.authored?.count : undefined));

  if (counts.every((count) => count === undefined)) return undefined;

  if (counts.some((count) => !same(count, counts[0])))
    throw new SceneError(
      `morph() can't blend ${named(entry.key)}: it counts, and what it counts differs between states.`,
      "Give its count() the same track in every state, or key the <Text> differently in each state so they crossfade.",
      whereOf(entry.key),
    );

  return counts[0];
};

const build = (plan: Plan, entry: Entry): SceneNode => {
  const rest = firstPresent(entry);

  const node = ((): SceneNode => {
    switch (rest.kind) {
      case "group": {
        const count = countIn(entry);

        return {
          ...placed(plan, entry),
          ...(count && { authored: { count } }),
          kind: "group",
          children: entry.children.map((child) => build(plan, child)),
        };
      }

      case "shape":
        return shapeOf(plan, entry);
      case "text":
        return textOf(plan, entry);
      case "image": {
        agreed(
          entry,
          (node) => (node.kind === "image" ? [node.size, node.data] : []),
          "picture or size",
        );

        return { ...placed(plan, entry), kind: "image", size: rest.size, data: rest.data };
      }

      case "instance":
        return {
          ...placed(plan, entry),
          kind: "instance",
          symbol: agreed(entry, (node) => (node.kind === "instance" ? node.symbol : ""), "symbol"),
        };
    }
  })();

  return placedLike(node, rest);
};

export const merge = (
  states: readonly (readonly SceneNode[])[],
  spans: readonly Span[],
  timing: Timing,
  options: MorphOptions = {},
): SceneNode[] => {
  const top = entries(states);
  const { stagger = 0 } = options;
  const windows = new Map<Entry, Window[]>();
  const all = preorder(top);

  spans.forEach(({ start, over }, i) => {
    const moving = units(top, i);
    const length = over - stagger * (moving.length - 1);

    if (moving.length > 1 && !(length > EPSILON))
      throw new SceneError(
        `morph()'s stagger of ${num(stagger)}s across the ${moving.length} things that change in transition ${i + 1} takes the whole ${num(over)}s span. Give it a longer span or a shorter stagger.`,
      );

    const rank = new Map(
      moving.flatMap((unit, r) => preorder([unit]).map((entry) => [entry, r] as const)),
    );

    for (const entry of all) {
      const own = windows.get(entry) ?? [];
      const wait = (rank.get(entry) ?? 0) * stagger;

      own.push(
        stagger > 0 && moving.length > 1 ? { start: start + wait, over: length } : { start, over },
      );
      windows.set(entry, own);
    }
  });

  const plan: Plan = {
    timing,
    curve: options.curve ?? ease.inOut,
    enter: layerOf(options.enter ?? { opacity: 0 }),
    exit: layerOf(options.exit ?? { opacity: 0 }),
    windows,
  };

  return top.map((entry) => build(plan, entry));
};

export const morphed = (
  element: MorphElement,
  timing: Timing,
  taken: Set<string>,
  lower: (state: readonly SceneElement[], names: Set<string>) => SceneNode[],
): SceneNode[] => {
  const states = element.states.map((state) => {
    const names = new Set(taken);

    return { nodes: lower(state, names), names };
  });

  for (const { names } of states) for (const name of names) taken.add(name);

  return merge(
    states.map((state) => state.nodes),
    element.spans,
    timing,
    element.options,
  );
};
