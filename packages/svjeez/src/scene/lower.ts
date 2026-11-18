import { regularFace, type FontValue } from "../font/font";
import { num } from "../format";
import { EPSILON, type Seconds } from "../motion";
import { checkWindow } from "../span";
import { matched, mixGeometry } from "./geometry";
import { identified } from "./identity";
import type {
  Animated,
  Box,
  Color,
  Geometry as Outline,
  GroupNode,
  ImageNode,
  InstanceNode,
  Layer,
  Scene,
  SceneNode,
  ShapeNode,
  TextNode,
  TokenValue,
  Vec,
} from "./ir";
import { isLane, pair } from "./lane";
import { morphed } from "./morph";
import {
  flat,
  sceneElement,
  within,
  type Common,
  type ImageProps,
  type InstanceProps,
  type SceneElement,
  type SceneSymbol,
  type ShapeProps,
  type TextProps,
} from "./nodes";
import { isAnchor } from "./refs";
import { arrangeState, around, note, notes, settle, type Notes } from "./settle";
import {
  laneOf,
  mapped,
  mixNumber,
  mixVec,
  noMix,
  same,
  touches,
  type Mix,
  type Timing,
} from "./steps";
import { isTrack, layersOf, passageOf, type Anim, type LayerMotion } from "./track";
import { derivedOf, isDerived } from "./derived";
import { collect, type Cues } from "./timeline";
import {
  boxOf,
  outlineOf,
  rgbaOf,
  type Geometry,
  type Hex,
  type Paint,
  type Theme,
} from "./values";
import { layoutText } from "./text";

export interface SceneOptions {
  readonly size: Vec;
  readonly duration: Seconds;
  readonly title: string;
  readonly desc?: string;
  /** Tokens to declare whether or not the scene uses them, so a page can restyle it. */
  readonly theme?: Theme;
  /** False plays the scene once and holds its last frame. Default true. */
  readonly loop?: boolean;
  /** The frame held for a viewer who asked for reduced motion. Default: 85% through. */
  readonly reducedMotion?: { readonly at: Seconds } | false;
}

interface Ctx {
  readonly tokens: Map<string, TokenValue>;
  readonly fonts: Map<string, FontValue>;
  readonly size: Vec;
  readonly duration: Seconds;
  /** Each symbol an instance has placed, lowered once. */
  readonly symbols: Map<string, SymbolEntry>;
  /** What the second pass places: anchors, layout and connectors. */
  readonly notes: Notes;
  /** The timelines the scene made, applied node by node. */
  readonly cues: Cues;
}

interface SymbolEntry {
  readonly of: SceneSymbol;
  /** Absent while the symbol's own content is being lowered. */
  node?: GroupNode;
  moves?: boolean;
}

/** A value's first key: what it is at rest, for measuring. */
const rest = <T>(value: Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

const keep = <T>(value: T): T => value;

const animated = <A, T>(
  value: Anim<A>,
  change: (value: A) => T,
  timing: Timing,
  mix: Mix<T>,
  where: string,
): Animated<T> => {
  if (isDerived(value)) return derivedOf(value, change, timing, where);

  if (!isTrack(value)) return change(value);
  // SAFETY: a value that is not undefined is an A, and undefined is itself one when A allows it, so change() takes it either way.
  const data = mapped(passageOf(value).data, "value", (given) => change(given as A));

  return laneOf(data, data.initial.value!, timing, mix, where);
};

const colorOf = (ctx: Ctx, paint: Paint, where: string): Color => {
  if (isHex(paint)) return rgbaOf(paint, where);
  const value = { light: rgbaOf(paint.light, where), dark: rgbaOf(paint.dark, where) };
  const known = ctx.tokens.get(paint.name);

  if (known && !same(known, value))
    throw new Error(`Two tokens are both named "${paint.name}", with different colors.`);
  ctx.tokens.set(paint.name, value);

  return { kind: "token", name: paint.name };
};

const isHex = (paint: Paint): paint is Hex => typeof paint === "string";

const layerOf = ({ passage }: LayerMotion, timing: Timing, where: string): Layer => {
  const { data } = passage;

  const slot = <K extends "offset" | "rotate" | "scale" | "opacity", T>(
    name: K,
    change: (value: Exclude<Parameters<LayerMotion["to"]>[0][K], undefined>) => T,
    atRest: T,
    mix: Mix<T>,
  ): Animated<T> =>
    touches(data, name)
      ? laneOf(mapped(data, name, change), atRest, timing, mix, `${name} on ${where}`)
      : atRest;

  return {
    offset: slot("offset", keep, [0, 0], mixVec),
    rotate: slot("rotate", keep, 0, mixNumber),
    scale: slot("scale", pair, [1, 1], mixVec),
    opacity: slot("opacity", keep, 1, mixNumber),
  };
};

/** Where a node placed in the second pass waits during the first. */
const NOWHERE: Vec = [0, 0];

const IDLE: Layer = { offset: [0, 0], rotate: 0, scale: [1, 1], opacity: 1 };

const originOf = (origin: Common["origin"], box: Box): Vec => {
  if (origin === undefined || origin === "center")
    return [box.x + box.width / 2, box.y + box.height / 2];

  return origin === "top-left" ? [box.x, box.y] : origin;
};

const base = (props: Common, box: Box, key: string, timing: Timing) => {
  const where = `"${key}"`;

  const own: Layer = {
    offset: [0, 0],
    rotate: animated(props.rotate ?? 0, keep, timing, mixNumber, `rotate on ${where}`),
    scale: animated<number | Vec, Vec>(props.scale ?? 1, pair, timing, mixVec, `scale on ${where}`),
    opacity: animated(props.opacity ?? 1, keep, timing, mixNumber, `opacity on ${where}`),
  };

  return {
    key,
    box,
    at: isAnchor(props.at)
      ? NOWHERE
      : animated<Vec, Vec>(props.at ?? [0, 0], keep, timing, mixVec, `at on ${where}`),
    origin: originOf(props.origin, box),
    layers: [...layersOf(props.motion).map((layer) => layerOf(layer, timing, where)), own].filter(
      (layer) => !same(layer, IDLE),
    ),
    effects: [],
  };
};

/**
 * A geometry track as a lane whose keys all blend: `matched` keeps keys of one kind as they are and turns any other
 * mix into paths with the same points. A key written twice becomes one value, so a shape that comes back is the same.
 */
const geometryOf = (
  value: ShapeProps["geometry"],
  timing: Timing,
  where: string,
): Animated<Outline> => {
  if (isDerived(value)) return derivedOf(value, outlineOf, timing, `geometry on ${where}`);

  if (!isTrack(value)) return outlineOf(value);
  const { data } = passageOf(value);

  const authored = [data.initial, ...data.steps.map((step) => step.values)].flatMap(
    (values): Geometry[] => (values.value === undefined ? [] : [values.value]),
  );

  const blended = matched(authored.map(outlineOf), `geometry on ${where}`);
  const lowered = new Map(authored.map((given, i) => [given, blended[i]!]));
  const lane = mapped(data, "value", (given) => lowered.get(given)!);

  return laneOf(lane, lane.initial.value!, timing, mixGeometry, `geometry on ${where}`);
};

const shape = (ctx: Ctx, props: ShapeProps, key: string, timing: Timing): ShapeNode => {
  const where = `"${key}"`;
  const geometry = geometryOf(props.geometry, timing, where);
  const paint = (value: Paint) => colorOf(ctx, value, where);
  const { stroke } = props;

  return {
    ...base(props, boxOf(rest(geometry)), key, timing),
    kind: "shape",
    geometry,
    ...(props.fill !== undefined && {
      fill: animated(props.fill, paint, timing, noMix, `fill on ${where}`),
    }),
    ...(stroke && {
      stroke: {
        color: animated(stroke.color, paint, timing, noMix, `stroke on ${where}`),
        width: animated(stroke.width ?? 1, keep, timing, mixNumber, `stroke width on ${where}`),
        cap: stroke.cap ?? "butt",
        join: stroke.join ?? "miter",
        ...(stroke.dash && { dash: stroke.dash }),
        nonScaling: stroke.nonScaling ?? false,
      },
    }),
    ...(props.trim !== undefined && {
      trim: animated<Vec, Vec>(props.trim, keep, timing, mixVec, `trim on ${where}`),
    }),
  };
};

const text = (ctx: Ctx, props: TextProps, key: string, timing: Timing): TextNode => {
  const where = `"${key}"`;
  const face = regularFace(props.font);
  const known = ctx.fonts.get(face.family);

  if (known && known !== props.font)
    throw new Error(`Two different fonts are both the family "${face.family}".`);
  ctx.fonts.set(face.family, props.font);

  const { lines, box } = layoutText(
    face,
    props.children,
    {
      size: props.size,
      ...(props.width !== undefined && { width: props.width }),
      ...(props.lineHeight !== undefined && { lineHeight: props.lineHeight }),
      ...(props.align !== undefined && { align: props.align }),
    },
    where,
  );

  return {
    ...base(props, box, key, timing),
    kind: "text",
    family: face.family,
    size: props.size,
    lines,
    fill: animated(
      props.fill,
      (value: Paint) => colorOf(ctx, value, where),
      timing,
      noMix,
      `fill on ${where}`,
    ),
  };
};

const image = (props: ImageProps, key: string, timing: Timing): ImageNode => {
  const { src } = props;
  const ratio = src.width / src.height;
  const width = props.width ?? (props.height === undefined ? src.width : props.height * ratio);
  const height = props.height ?? (props.width === undefined ? src.height : props.width / ratio);

  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
    throw new Error(`Image "${key}" needs a positive width and height, got ${width} by ${height}.`);

  return {
    ...base(props, { x: 0, y: 0, width, height }, key, timing),
    kind: "image",
    size: [width, height],
    data: src.href,
  };
};

/** Whether anything in a lowered tree moves. */
const moves = (node: SceneNode): boolean => JSON.stringify(node).includes('"kind":"lane"');

const instance = (ctx: Ctx, props: InstanceProps, key: string, timing: Timing): InstanceNode => {
  const { of } = props;
  const known = ctx.symbols.get(of.name);

  if (known && known.of !== of)
    throw new Error(`Two different symbols are both named "${of.name}". Give one another name.`);

  if (known && !known.node)
    throw new Error(`Symbol "${of.name}" places an instance of itself, so it would never end.`);

  if (!known) {
    const entry: SymbolEntry = { of };

    ctx.symbols.set(of.name, entry);
    const root = `#${of.name}`;

    // A symbol is drawn once and shared, so it is lowered on the scene's own clock, wherever an instance sits.
    const children = lowerAll(
      ctx,
      within(ctx.size, () => flat(of.build())),
      sceneTiming(ctx),
      root,
    );

    entry.node = {
      kind: "group",
      key: root,
      box: around(children),
      at: [0, 0],
      origin: [0, 0],
      layers: [],
      effects: [],
      children,
    };
    entry.moves = moves(entry.node);
  }

  const { node, moves: moving } = ctx.symbols.get(of.name)!;
  const clip = timing.clock.clips.at(-1);

  if (moving && timing.clock.offset > EPSILON)
    throw new Error(
      `Instance "${key}" of symbol "${of.name}" sits inside ${clip?.label ?? "a sequence"}, but the symbol moves, and a symbol's tracks run on the scene's clock for every instance. Move the instance instead, or draw the content without a symbol.`,
    );

  return { ...base(props, node!.box, key, timing), kind: "instance", symbol: of.name };
};

const sceneTiming = ({ duration }: Ctx): Timing => ({
  duration,
  clock: { offset: 0, end: duration, clips: [] },
});

const label = (at: Seconds, over: Seconds | undefined): string =>
  `<Sequence at={${num(at)}}${over === undefined ? "" : ` over={${num(over)}}`}>`;

const inside = (timing: Timing, at: Seconds, over: Seconds | undefined): Timing => {
  checkWindow(at, over ?? 1, "<Sequence>");
  const parent = timing.clock;
  const start = parent.offset + at;
  const end = over === undefined ? parent.end : start + over;
  const name = label(at, over);

  if (start > parent.end + EPSILON || end > parent.end + EPSILON)
    throw new Error(
      `A ${name} runs until ${num(end - parent.offset)}s, past the ${num(parent.end - parent.offset)}s ${parent.clips.at(-1)?.label ?? "scene"}.`,
    );

  return {
    ...timing,
    clock: {
      offset: start,
      end,
      clips: [...parent.clips, { label: name, start, end, open: over === undefined }],
    },
  };
};

const lowerAll = (
  ctx: Ctx,
  elements: readonly SceneElement[],
  timing: Timing,
  parent: string,
  taken: Set<string> = new Set(),
): SceneNode[] =>
  elements.flatMap((element): SceneNode[] => {
    const given = sceneElement(element, parent ? `"${parent}"` : "The scene");

    if (given.type === "fragment") return lowerAll(ctx, given.children, timing, parent, taken);

    if (given.type === "sequence") {
      const clocked = inside(timing, given.at, given.over);

      if (given.timeline) ctx.cues.claim(given.timeline, clocked.clock);

      return lowerAll(ctx, given.children, clocked, parent, taken);
    }

    if (given.type === "morph")
      return morphed(given, timing, taken, (state, names) =>
        arrangeState(lowerAll(ctx, state, timing, parent, names), ctx.notes),
      );
    const name = given.props.key ?? given.props.ref?.key;

    if (name !== undefined && taken.has(name))
      throw new Error(`Two nodes are both keyed "${name}"${parent && ` inside "${parent}"`}.`);

    if (name?.includes("/")) throw new Error(`A key can't contain "/", got "${name}".`);
    let own = name;

    for (let index = taken.size; own === undefined; index++)
      if (!taken.has(String(index))) own = String(index);
    taken.add(own);
    const key = parent ? `${parent}/${own}` : own;
    const el = ctx.cues.apply(given, key, timing, ctx.notes, parent);

    note(ctx.notes, key, el.props, el.type === "group" ? el.settle : undefined);

    switch (el.type) {
      case "shape":
        return [identified(given, name, shape(ctx, el.props, key, timing))];
      case "text":
        return [identified(given, name, text(ctx, el.props, key, timing))];
      case "image":
        return [identified(given, name, image(el.props, key, timing))];
      case "instance":
        return [identified(given, name, instance(ctx, el.props, key, timing))];
      case "group": {
        const children = lowerAll(ctx, el.children, timing, key);

        const node: GroupNode = {
          ...base(el.props, around(children), key, timing),
          kind: "group",
          children,
        };

        return [identified(given, name, node)];
      }
    }
  });

/** A fragment, or a group with nothing to say: no props and no layout, so it is the root itself. */
const isBare = (el: SceneElement): boolean =>
  el.type === "fragment" ||
  (el.type === "group" && Object.keys(el.props).length === 0 && el.settle === undefined);

/**
 * Runs `build`, measures and lowers what it returns, and gives back the scene model. A bare `<Group>` at the top is
 * the scene's root itself.
 */
export const scene = (options: SceneOptions, build: () => SceneElement): Scene => {
  const { size, duration } = options;

  if (!size.every((side) => side > 0 && side < Infinity))
    throw new Error(`scene() needs a positive width and height, got ${size[0]} by ${size[1]}.`);

  if (!(duration > 0 && duration < Infinity))
    throw new Error(`scene() needs a positive duration, got ${duration}.`);

  if (options.reducedMotion && !Number.isFinite(options.reducedMotion.at))
    throw new Error(`scene() needs a finite reducedMotion.at, got ${options.reducedMotion.at}.`);

  const [top, cues] = collect(() => sceneElement(within(size, build), "scene()'s callback"));

  const ctx: Ctx = {
    tokens: new Map(),
    fonts: new Map(),
    size,
    duration,
    symbols: new Map(),
    notes: notes(),
    cues,
  };

  for (const token of Object.values(options.theme ?? {})) colorOf(ctx, token, "scene()");

  const children = lowerAll(
    ctx,
    isBare(top) && (top.type === "fragment" || top.type === "group") ? top.children : [top],
    sceneTiming(ctx),
    "",
  );

  const drafted: GroupNode = {
    kind: "group",
    key: "root",
    box: { x: 0, y: 0, width: size[0], height: size[1] },
    at: [0, 0],
    origin: [size[0] / 2, size[1] / 2],
    layers: [],
    effects: [],
    children,
  };

  cues.finish();
  const root = settle(drafted, ctx.notes, duration);

  const still =
    options.reducedMotion === false
      ? undefined
      : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));

  return {
    size,
    duration,
    title: options.title,
    ...(options.desc !== undefined && { desc: options.desc }),
    loop: options.loop ?? true,
    ...(still !== undefined && { still }),
    tokens: Object.fromEntries(ctx.tokens),
    fonts: Object.fromEntries(ctx.fonts),
    symbols: Object.fromEntries([...ctx.symbols].map(([name, entry]) => [name, entry.node!])),
    root,
  };
};
