import { regularFace, type FontValue } from "../font/font";
import { num } from "../format";
import { EPSILON, type Seconds } from "../motion";
import { ringsOf } from "../paths";
import { checkWindow } from "../span";
import type {
  Animated,
  Box,
  Color,
  GroupNode,
  Layer,
  Scene,
  SceneNode,
  ShapeNode,
  TextNode,
  TokenValue,
  Vec,
} from "./ir";
import { isLane, pair } from "./lane";
import { within, type Common, type SceneElement, type ShapeProps, type TextProps } from "./nodes";
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
import { boxOf, outlineOf, rgbaOf, type Hex, type Paint, type Theme } from "./values";

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
    at: animated<Vec, Vec>(props.at ?? [0, 0], keep, timing, mixVec, `at on ${where}`),
    origin: originOf(props.origin, box),
    layers: [...layersOf(props.motion).map((layer) => layerOf(layer, timing, where)), own].filter(
      (layer) => !same(layer, IDLE),
    ),
    effects: [],
  };
};

const shape = (ctx: Ctx, props: ShapeProps, key: string, timing: Timing): ShapeNode => {
  const where = `"${key}"`;

  if (isTrack(props.geometry))
    throw new Error(
      `geometry on ${where} is a track. Animated geometry is not built yet: it lands with the next part of the scene model.`,
    );
  const geometry = outlineOf(props.geometry);
  const paint = (value: Paint) => colorOf(ctx, value, where);
  const { stroke } = props;

  return {
    ...base(props, boxOf(geometry), key, timing),
    kind: "shape",
    geometry,
    ...(props.fill !== undefined && {
      fill: animated(props.fill, paint, timing, noMix, `fill on ${where}`),
    }),
    ...(stroke && {
      stroke: {
        color: animated(stroke.color, paint, timing, noMix, `stroke on ${where}`),
        width: stroke.width ?? 1,
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

const START = { start: 0, center: -0.5, end: -1 } as const;

const text = (ctx: Ctx, props: TextProps, key: string, timing: Timing): TextNode => {
  const where = `"${key}"`;
  const face = regularFace(props.font);
  const { size } = props;

  if (!(size > 0 && Number.isFinite(size)))
    throw new Error(`Text ${where} needs a positive size, got ${size}.`);

  if (props.children.includes("\n"))
    throw new Error(`Text ${where} has a line break. Text is one line until layout lands.`);
  const width = face.measure(props.children, size);
  const x = width * START[props.align ?? "start"];
  const { ascent, descent } = face.metrics;
  const known = ctx.fonts.get(face.family);

  if (known && known !== props.font)
    throw new Error(`Two different fonts are both the family "${face.family}".`);
  ctx.fonts.set(face.family, props.font);

  const outlined = (() => {
    try {
      return face.path(props.children, { size, x });
    } catch {
      return undefined;
    }
  })();

  return {
    ...base(props, { x, y: -ascent * size, width, height: (ascent + descent) * size }, key, timing),
    kind: "text",
    family: face.family,
    size,
    lines: [
      {
        text: props.children,
        at: [x, 0],
        advances: outlined ? outlined.glyphs.map((glyph) => glyph.advance) : [width],
        ...(outlined && { outline: ringsOf(outlined.d) }),
      },
    ],
    fill: animated(
      props.fill,
      (value: Paint) => colorOf(ctx, value, where),
      timing,
      noMix,
      `fill on ${where}`,
    ),
  };
};

const around = (children: readonly SceneNode[]): Box => {
  if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const corners = children.map(({ at, box }) => {
    const [x, y] = rest(at);

    return [x + box.x, y + box.y, x + box.x + box.width, y + box.y + box.height] as const;
  });

  const [x, y] = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1]))];

  return {
    x,
    y,
    width: Math.max(...corners.map((c) => c[2])) - x,
    height: Math.max(...corners.map((c) => c[3])) - y,
  };
};

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
  elements.flatMap((el): SceneNode[] => {
    if (el.type === "fragment") return lowerAll(ctx, el.children, timing, parent, taken);

    if (el.type === "sequence")
      return lowerAll(ctx, el.children, inside(timing, el.at, el.over), parent, taken);
    const name = el.props.key ?? el.props.ref?.key;

    if (name !== undefined && taken.has(name))
      throw new Error(`Two nodes are both keyed "${name}"${parent && ` inside "${parent}"`}.`);

    if (name?.includes("/")) throw new Error(`A key can't contain "/", got "${name}".`);
    let own = name;

    for (let index = taken.size; own === undefined; index++)
      if (!taken.has(String(index))) own = String(index);
    taken.add(own);
    const key = parent ? `${parent}/${own}` : own;

    switch (el.type) {
      case "shape":
        return [shape(ctx, el.props, key, timing)];
      case "text":
        return [text(ctx, el.props, key, timing)];
      case "group": {
        const children = lowerAll(ctx, el.children, timing, key);

        return [{ ...base(el.props, around(children), key, timing), kind: "group", children }];
      }
    }
  });

const isBare = (el: SceneElement): boolean =>
  el.type === "fragment" || (el.type === "group" && Object.keys(el.props).length === 0);

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

  const ctx: Ctx = { tokens: new Map(), fonts: new Map() };

  for (const token of Object.values(options.theme ?? {})) colorOf(ctx, token, "scene()");
  const top = within(size, build);

  const children = lowerAll(
    ctx,
    isBare(top) && top.type !== "shape" && top.type !== "text" ? top.children : [top],
    { duration, clock: { offset: 0, end: duration, clips: [] } },
    "",
  );

  const root: GroupNode = {
    kind: "group",
    key: "root",
    box: { x: 0, y: 0, width: size[0], height: size[1] },
    at: [0, 0],
    origin: [size[0] / 2, size[1] / 2],
    layers: [],
    effects: [],
    children,
  };

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
    symbols: {},
    root,
  };
};
