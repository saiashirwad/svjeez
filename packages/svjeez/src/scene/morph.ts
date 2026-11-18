import { num } from "../format";
import { EPSILON, type Seconds } from "../motion";
import { checkWindow, span, type Span } from "../span";
import { matched, mixGeometry } from "./geometry";
import { isPlaced, placedLike } from "./identity";
import type {
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
  TextNode,
  Vec,
} from "./ir";
import { isLane, pair } from "./lane";
import { flat, type Child, type SceneElement } from "./nodes";
import { ease, isSpring, type Curve } from "./spring";
import { Passage, laneOf, mixNumber, mixVec, same, type Mix, type Timing } from "./steps";
import { blendable, isGradient, mixPaint } from "./paint";
import type { LayerValues } from "./track";

/**
 * State-to-state morphing. Each state is a whole picture; `morph` lowers every state in the same place and merges
 * them by key, so a node in two states moves, resizes, reshapes and recolors between them, one in a later state
 * enters, and one that leaves exits. Keys are what match, so give every node that changes a `key` (or a `ref`):
 * an unkeyed node is matched by its place among its siblings, which breaks as soon as a sibling comes or goes.
 */
export interface MorphOptions {
  /** How each transition moves. A spring moves numbers, points and geometry; colors take `ease.inOut` over the span. Default `ease.inOut`. */
  readonly curve?: Curve;
  /** Where an entering node comes from, as `enter()` takes it. Default `{ opacity: 0 }`, a fade. */
  readonly enter?: LayerValues;
  /** Where an exiting node goes, as `exit()` takes it. Default `{ opacity: 0 }`, a fade. */
  readonly exit?: LayerValues;
  /**
   * Seconds between one changing node's start and the next's, in paint order, within each transition. Every node
   * still ends by the end of the span, so each takes the span less the stagger it waits for at most. Default 0.
   */
  readonly stagger?: Seconds;
}

/** What `morph` builds: lowering merges the states into one tree of nodes. */
export interface MorphElement {
  readonly type: "morph";
  readonly states: readonly (readonly SceneElement[])[];
  readonly spans: readonly Span[];
  readonly options: MorphOptions;
}

const between = (
  states: readonly Child[],
  spans: readonly Span[],
  options: MorphOptions = {},
): SceneElement => {
  if (states.length < 2)
    throw new Error(`morph.between() needs two states or more, got ${states.length}.`);

  if (spans.length !== states.length - 1)
    throw new Error(
      `morph.between() takes one span per transition: ${states.length} states need ${states.length - 1} spans, got ${spans.length}.`,
    );

  spans.forEach(({ at, over }, i) => {
    checkWindow(at, over, "morph()");
    const before = spans[i - 1];

    if (before && at < before.at + before.over - EPSILON)
      throw new Error(
        `morph.between()'s spans must follow one another: span ${i + 1} starts at ${num(at)}s, before span ${i} ends at ${num(before.at + before.over)}s.`,
      );
  });

  const { stagger = 0 } = options;

  if (!(stagger >= 0 && Number.isFinite(stagger)))
    throw new Error(`morph() needs a stagger of 0 or more seconds, got ${stagger}.`);

  return { type: "morph", states: states.map(flat), spans, options };
};

/**
 * One element that is `before` until `when`, then becomes `after` over it. `morph.between([a, b, c], [s1, s2])`
 * goes through a chain of states, one span per transition.
 */
export const morph = Object.assign(
  (before: Child, after: Child, when: Span, options: MorphOptions = {}): SceneElement =>
    between([before, after], [when], options),
  { between },
);

/** One key across the states: the node in each state where it is, and in the others the nearest one that is. */
interface Entry {
  readonly key: string;
  readonly present: readonly boolean[];
  readonly filled: readonly SceneNode[];
  readonly children: readonly Entry[];
}

const keysOf = (nodes: readonly SceneNode[]): string[] => nodes.map((node) => node.key);

/** `after`'s order, with each key only in `before` kept just after the key it followed there. */
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

    throw new Error(
      `morph() matches nodes by key, and ${parent ? `inside "${parent}"` : "at the top"} the states have ${counts.join(", ")} nodes with no key, so they would pair up by their place. Give each node that comes, goes or changes a key, as in <Shape key="…" />.`,
    );
  }

  const order = lists.map(keysOf).reduce(ordered);

  return order.map((key) => {
    const found = lists.map((list) => list.find((node) => node.key === key));
    const nodes = found.filter((node): node is SceneNode => node !== undefined);
    const kinds = [...new Set(nodes.map((node) => node.kind))];

    if (kinds.length > 1)
      throw new Error(
        `morph() can't turn "${key}" from a ${kinds[0]} into a ${kinds[1]}: a node keeps its kind across states.${placeNote(key, nodes)}`,
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

/** A node's own drawing, without what it holds or where it was written, to tell whether it changes. */
const drawing = (node: SceneNode): string => {
  const { source: _source, box: _box, ...rest } = node;

  return JSON.stringify(node.kind === "group" ? { ...rest, children: [] } : rest);
};

const changes = (entry: Entry, i: number): boolean =>
  entry.present[i] !== entry.present[i + 1] ||
  drawing(entry.filled[i]!) !== drawing(entry.filled[i + 1]!);

const changesWithin = (entry: Entry, i: number): boolean =>
  changes(entry, i) || entry.children.some((child) => changesWithin(child, i));

/**
 * What a stagger orders in transition `i`: the siblings that change, or hold something that does, each moving as
 * one with all it holds. A lone such sibling that doesn't change itself is looked into, so a chart's bars stagger
 * though one group holds them all.
 */
const units = (list: readonly Entry[], i: number): Entry[] => {
  const moving = list.filter((entry) => changesWithin(entry, i));
  const [only] = moving;

  return moving.length === 1 && only && !changes(only, i) ? units(only.children, i) : moving;
};

const preorder = (list: readonly Entry[]): Entry[] =>
  list.flatMap((entry) => [entry, ...preorder(entry.children)]);

interface Window {
  readonly at: Seconds;
  readonly over: Seconds;
}

interface Plan {
  readonly timing: Timing;
  readonly curve: Curve;
  readonly enter: Fixed;
  readonly exit: Fixed;
  /** Each entry's window for each transition, staggered. */
  readonly windows: ReadonlyMap<Entry, readonly Window[]>;
}

/** A layer with nothing moving in it. */
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

/** A value's way through the transitions: from `from[i]` to `to[i]` over window `i`, cut where one ends short of the next. */
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

  windows.forEach(({ at, over }, i) => {
    if (!same(current, from[i]!)) passage = passage.set({ value: from[i]! }, at);

    if (!same(from[i]!, to[i]!)) passage = passage.to({ value: to[i]! }, span(at, over), curve);
    current = to[i]!;
  });

  return laneOf(passage.data, initial, plan.timing, mix, where);
};

/** One value per state, as a lane through the transitions: kept as it is when every state agrees. */
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
    throw new Error(
      `morph() can't blend the ${what} of "${entry.key}": it moves in a state (a track, a recipe or a timeline) and also differs between states. Write it the same in every state, or let the morph move it.`,
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
    `${what} on "${entry.key}" in morph()`,
    curve,
  );
};

/** Asks every state to agree on something that doesn't animate. */
const agreed = <T>(entry: Entry, read: (node: SceneNode) => T, what: string): T => {
  const values = entry.filled.filter((_, s) => entry.present[s]).map(read);
  const other = values.find((value) => !same(value, values[0]));

  if (other !== undefined)
    throw new Error(
      `morph() can't blend "${entry.key}": its ${what} differs between states, and ${what} doesn't animate.${placeNote(entry.key, entry.filled)}`,
    );

  return values[0]!;
};

const rotateScale = (layer: Layer, [x, y]: Vec): Vec => {
  // SAFETY: the caller only passes layers whose rotate and scale are fixed.
  const [rotate, [sx, sy]] = [layer.rotate as number, layer.scale as Vec];
  const angle = (rotate * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];

  return [cos * sx * x - sin * sy * y, sin * sx * x + cos * sy * y];
};

/**
 * A node's layers turned around `origin` instead of its own: the same picture, since turning around one point is
 * turning around another and moving by the difference.
 */
const rebased = (entry: Entry, node: SceneNode, origin: Vec): readonly Layer[] => {
  const [dx, dy] = [node.origin[0] - origin[0], node.origin[1] - origin[1]];

  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return node.layers;

  return node.layers.map((layer) => {
    if (isLane(layer.rotate) || isLane(layer.scale))
      throw new Error(
        `morph() can't blend "${entry.key}": it turns or scales in a state, and its origin moves between states. Give it the same origin in every state, as in origin={[x, y]}.`,
      );
    const [mx, my] = rotateScale(layer, [dx, dy]);
    const shift: Vec = [dx - mx, dy - my];
    const move = (offset: Vec): Vec => [offset[0] + shift[0], offset[1] + shift[1]];

    return {
      ...layer,
      offset: isLane(layer.offset) ? shifted(layer.offset, move) : move(layer.offset),
    };
  });
};

/** A lane of points moved by `move`, a curve's controls with it. */
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
  const where = `entering or exiting on "${entry.key}" in morph()`;

  const field = <T>(read: (layer: Fixed) => T, mix: Mix<T>): Animated<T> =>
    travel(plan, windows, read(initial), from.map(read), to.map(read), mix, where);

  return {
    offset: field((layer) => layer.offset, mixVec),
    rotate: field((layer) => layer.rotate, mixNumber),
    scale: field((layer) => layer.scale, mixVec),
    opacity: field((layer) => layer.opacity, mixNumber),
  };
};

/** Layers index by index, the shorter stacks padded with layers that change nothing. */
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

/** Where a node sits and how it is placed, shared by every kind: the first state it is in gives its rest. */
const placed = (plan: Plan, entry: Entry, enter: Fixed = plan.enter, exit: Fixed = plan.exit) => {
  const rest = firstPresent(entry);
  const shown = presence(plan, entry, enter, exit);
  const clip = clipOf(plan, entry);
  const mask = agreed(entry, (node) => node.mask, "mask");

  return {
    key: entry.key,
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
    effects: effectsOf(plan, entry),
  };
};

/** A clip reshapes between states as a geometry does. A state with no clip draws everything, which no outline can blend to. */
const clipOf = (plan: Plan, entry: Entry): Animated<Geometry> | undefined => {
  const clips = entry.filled.map((node) => node.clip);

  if (clips.every((clip) => clip === undefined)) return undefined;

  const given = clips.flatMap((clip) => (clip === undefined ? [] : [clip]));

  if (given.length < clips.length)
    throw new Error(
      `morph() can't blend "${entry.key}": it has a clip in one state and none in another, and no outline blends into drawing everything. Give it a clip in every state, as large as the node where it should show all of it.`,
    );

  return outlinesOf(plan, entry, given, "clip");
};

/** What an effect is when a state has none of it: a blur of 0, or the same shadow with no opacity. */
const absent = (effect: Effect): Effect =>
  effect.kind === "blur" ? { kind: "blur", radius: 0 } : { ...effect, opacity: 0 };

const kinds = (effects: readonly Effect[]): string =>
  effects.map((effect) => effect.kind).join(", ");

/**
 * Effects blend one by one between states that list the same kinds in the same order. A state with none takes the
 * others' with nothing in them, so a shadow fades in and a blur sharpens.
 */
const effectsOf = (plan: Plan, entry: Entry): Effect[] => {
  const lists = entry.filled.map((node) => node.effects);
  const template = lists.reduce((most, list) => (list.length > most.length ? list : most));
  const odd = lists.find((list) => list.length > 0 && kinds(list) !== kinds(template));

  if (odd)
    throw new Error(
      `morph() can't blend the effects of "${entry.key}": one state has ${kinds(odd)} and another ${kinds(template)}. List the same effects in the same order in every state, or none.`,
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
      color: agreed(
        entry,
        (node) => {
          const own = node.effects[i];

          return own?.kind === "shadow" ? own.color : effect.color;
        },
        "shadow color",
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

/** A paint with nothing showing that blends with `like`: a gradient keeps its points with every stop clear. */
const clear = (like: Animated<Paint> | undefined): Paint =>
  like !== undefined && !isLane(like) && isGradient(like)
    ? { ...like, stops: like.stops.map((stop) => ({ ...stop, color: NONE })) }
    : NONE;

/** A paint's colors never spring: under a spring they take `ease.inOut` over the span. */
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
    `${what} on "${entry.key}" in morph()`,
  );
};

/** Every number in a geometry, in order, so a spring can move them one by one. */
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

/** `numbersOf` backwards, into the structure of `template`. */
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

/** One outline per state, matched so any two blend, as a lane through the transitions. */
const outlinesOf = (
  plan: Plan,
  entry: Entry,
  values: readonly Animated<Geometry>[],
  what: string,
): Animated<Geometry> => {
  const [first] = values;

  if (values.every((value) => same(value, first))) return first!;

  if (values.some(isLane))
    throw new Error(
      `morph() can't blend the ${what} of "${entry.key}": it moves in a state (a track) and also differs between states. Write it the same in every state, or let the morph reshape it.`,
    );

  // SAFETY: no value is a lane, so each is a geometry.
  const outlines = matched(values as readonly Geometry[], `${what} on "${entry.key}" in morph()`);

  return blend(plan, entry, outlines, geometryMix(outlines[0]!), what);
};

const strokeOf = (plan: Plan, entry: Entry, shapes: readonly ShapeNode[]): Stroke | undefined => {
  const strokes = shapes.map((node) => node.stroke);
  const given = strokes.find((stroke) => stroke !== undefined);

  if (!given) return undefined;

  const styles = strokes.flatMap((stroke) =>
    stroke
      ? [{ cap: stroke.cap, join: stroke.join, dash: stroke.dash, nonScaling: stroke.nonScaling }]
      : [],
  );

  if (styles.some((each) => !same(each, styles[0])))
    throw new Error(
      `morph() can't blend "${entry.key}": its stroke's cap, join, dash or nonScaling differs between states, and those don't animate. Give the stroke the same style in every state.`,
    );

  return {
    ...given,
    // A state with no stroke draws it with no width, in the color of the others.
    color: blendable(
      blend(
        plan,
        entry,
        strokes.map((stroke) => (stroke ?? given).color),
        mixPaint,
        "stroke color",
        paintCurve(plan),
      ),
      `stroke color on "${entry.key}" in morph()`,
    ),
    width: blend(
      plan,
      entry,
      strokes.map((stroke) => stroke?.width ?? 0),
      mixNumber,
      "stroke width",
    ),
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

const wording = (node: TextNode): string => JSON.stringify([node.family, node.size, node.lines]);

const FADE: Fixed = { ...IDLE, opacity: 0 };

/**
 * Text whose words change between states can't blend letter by letter, so it crossfades: a group that moves as the
 * text would, holding one text for each run of states that say the same thing.
 */
const textOf = (plan: Plan, entry: Entry): TextNode | GroupNode => {
  const texts = entry.filled.filter((node): node is TextNode => node.kind === "text");

  const fill = (states: readonly TextNode[]) =>
    paints(
      plan,
      entry,
      states.map((node) => node.fill),
      "fill",
    );

  if (texts.every((node) => wording(node) === wording(texts[0]!))) {
    const rest = texts[0]!;

    return {
      ...placed(plan, entry),
      kind: "text",
      family: rest.family,
      size: rest.size,
      lines: rest.lines,
      ...(fill(texts) !== undefined && { fill: fill(texts) }),
    };
  }

  const runs: number[] = [];

  texts.forEach((node, s) =>
    runs.push(s > 0 && wording(node) === wording(texts[s - 1]!) ? runs.at(-1)! : s),
  );

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

    const paint = paints(
      local,
      part,
      filled.map((node) => node.fill),
      "fill",
    );

    return {
      kind: "text",
      key: part.key,
      ...(own.source && { source: own.source }),
      box: own.box,
      at: [0, 0],
      origin: own.origin,
      layers: shown ? [shown] : [],
      effects: [],
      family: own.family,
      size: own.size,
      lines: own.lines,
      ...(paint !== undefined && { fill: paint }),
    };
  });

  return { ...placed(plan, entry), kind: "group", children };
};

const build = (plan: Plan, entry: Entry): SceneNode => {
  const rest = firstPresent(entry);

  const node = ((): SceneNode => {
    switch (rest.kind) {
      case "group":
        return {
          ...placed(plan, entry),
          kind: "group",
          children: entry.children.map((child) => build(plan, child)),
        };
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

/**
 * The states' nodes merged into one list by key, each value a lane through the transitions. `spans` are on the
 * clock `timing` says, one per transition. Paint order is the last state's, with each node that has left kept
 * where it was.
 */
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

  spans.forEach(({ at, over }, i) => {
    const moving = units(top, i);
    const length = over - stagger * (moving.length - 1);

    if (moving.length > 1 && !(length > EPSILON))
      throw new Error(
        `morph()'s stagger of ${num(stagger)}s across the ${moving.length} things that change in transition ${i + 1} takes the whole ${num(over)}s span. Give it a longer span or a shorter stagger.`,
      );

    const rank = new Map(
      moving.flatMap((unit, r) => preorder([unit]).map((entry) => [entry, r] as const)),
    );

    for (const entry of all) {
      const own = windows.get(entry) ?? [];
      const wait = (rank.get(entry) ?? 0) * stagger;

      own.push(stagger > 0 && moving.length > 1 ? { at: at + wait, over: length } : { at, over });
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

/** Lowers each state of `element` in the same place, then merges them. Keys the states use are taken in the parent. */
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
