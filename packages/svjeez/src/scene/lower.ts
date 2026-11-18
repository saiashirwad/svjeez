import type { Font } from "../font/font";
import { num } from "../format";
import { EPSILON, type Seconds } from "../motion";
import { checkWindow } from "./span";
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
  Effect,
  Paint as ModelPaint,
  Scene,
  SceneNode,
  ShapeNode,
  Face,
  TextLine,
  TextNode,
  TextRun,
  TokenValue,
  Vec,
} from "./ir";
import { atRest, isLane, pair } from "./lane";
import { morphed } from "./morph";
import {
  flat,
  sceneElement,
  within,
  type Child,
  type Common,
  type ImageProps,
  type InstanceProps,
  type SceneElement,
  type SceneSymbol,
  type ShapeProps,
  type TextProps,
} from "./nodes";
import { declaring, isAnchor, type Anchor } from "./refs";
import {
  arrangeState,
  around,
  note,
  noteResized,
  notes,
  originOf,
  outsider,
  sameAnchors,
  settle,
  type Notes,
} from "./settle";
import { laneOf, mapped, mixNumber, mixVec, same, touches, type Mix, type Timing } from "./steps";
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
  type Token,
} from "./values";
import { FontBook, charName, faceOf, piecesOf, type Asked } from "./runs";
import { lookOf, paintedBoxOf } from "./painted";
import { hasCoordinates, minus, pinned } from "./pin";
import { layoutRuns } from "./text";
import { blendable, gradientOf, isWrittenGradient, mixPaint } from "./paint";
import type { Effect as EffectProps } from "./effects";

/** A run's face and paints, lowered. */
interface RunLook {
  readonly face: Face;
  readonly font: Font;
  /** The fill, lowered once the text's box is known: an `across` gradient spreads over the whole text's box. */
  readonly fill: (box: Box) => Animated<ModelPaint>;
  readonly opacity?: Animated<number>;
}

/** What a span's fill is lowered against to tell two apart before the text is laid out. Places are fractions of a box, so two `across` gradients that differ do here too. */
const PROBE: Box = { x: 0, y: 0, width: 1, height: 1 };

/** What `scene()` is told about the whole scene. */
export interface SceneOptions {
  readonly size: Vec;
  readonly duration: Seconds;
  readonly title: string;
  readonly desc?: string;
  /** Tokens to declare whether or not the scene uses them, so a page can restyle it. */
  readonly theme?: Theme;
  /** False plays the scene once and holds its last frame. Default true. */
  readonly loop?: boolean;
  /** The time, in seconds, whose frame is held for a viewer who asked for reduced motion. Default: 85% through. */
  readonly reducedMotion?: Seconds | false;
}

interface Ctx {
  readonly tokens: Map<string, TokenValue>;
  readonly fonts: FontBook;
  readonly size: Vec;
  readonly duration: Seconds;
  /** Each symbol an instance has placed, lowered once, by its name in the model. */
  readonly symbols: Map<string, SymbolEntry>;
  /** The name each symbol took when its first instance was lowered. */
  readonly named: Map<SceneSymbol, string>;
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

const keep = <T>(value: T): T => value;

const animated = <A, T>(
  value: Anim<A>,
  change: (value: A) => T,
  timing: Timing,
  mix: Mix<T>,
  where: string,
  curves = false,
): Animated<T> => {
  if (isDerived(value)) return derivedOf(value, change, timing, where, curves);

  if (!isTrack(value)) return change(value);
  // SAFETY: a value that is not undefined is an A, and undefined is itself one when A allows it, so change() takes it either way.
  const data = mapped(passageOf(value).data, "value", (given) => change(given as A));

  return laneOf(data, data.initial.value!, timing, mix, where, curves);
};

/**
 * A paint in the model: a color, or a gradient whose points `box` gives when it spreads across one. Without a box,
 * such a gradient is an error.
 */
const colorOf = (ctx: Ctx, paint: Paint, where: string, box?: Box): ModelPaint =>
  isWrittenGradient(paint)
    ? gradientOf(paint, box, (color) => solidOf(ctx, color, where), where)
    : solidOf(ctx, paint, where);

const solidOf = (ctx: Ctx, paint: Hex | Token, where: string): Color => {
  if (isHex(paint)) return rgbaOf(paint, where);
  const value = { light: rgbaOf(paint.light, where), dark: rgbaOf(paint.dark, where) };
  const known = ctx.tokens.get(paint.name);

  if (known && !same(known, value))
    throw new Error(`Two tokens are both named "${paint.name}", with different colors.`);
  ctx.tokens.set(paint.name, value);

  return { kind: "token", name: paint.name };
};

const isHex = (paint: Hex | Token): paint is Hex => typeof paint === "string";

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

/**
 * What every node has, with `home`, the point of its frame that its `at` names: `at` is moved so that point, not the
 * frame's origin, lands where the author said. A group's anchor is applied in the second pass, once its box is known.
 */
const base = (props: Omit<Common, "anchor">, box: Box, key: string, timing: Timing, home: Vec) => {
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
      : animated<Vec, Vec>(
          props.at ?? [0, 0],
          (point) => minus(point, home),
          timing,
          mixVec,
          `at on ${where}`,
          true,
        ),
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
  what = "geometry",
): Animated<Outline> => {
  if (isDerived(value)) return derivedOf(value, outlineOf, timing, `${what} on ${where}`);

  if (!isTrack(value)) return outlineOf(value);
  const { data } = passageOf(value);

  const authored = [data.initial, ...data.steps.map((step) => step.values)].flatMap(
    (values): Geometry[] => (values.value === undefined ? [] : [values.value]),
  );

  const blended = matched(authored.map(outlineOf), `${what} on ${where}`);
  const lowered = new Map(authored.map((given, i) => [given, blended[i]!]));
  const lane = mapped(data, "value", (given) => lowered.get(given)!);

  return laneOf(lane, lane.initial.value!, timing, mixGeometry, `${what} on ${where}`);
};

const shape = (ctx: Ctx, props: ShapeProps, key: string, timing: Timing): ShapeNode => {
  const where = `"${key}"`;

  if (props.geometry === undefined)
    throw new Error(`<Shape> ${where} needs a geometry, such as geometry={rect(40, 20)}.`);

  if (props.fill === undefined && props.stroke === undefined)
    throw new Error(
      `<Shape> ${where} paints nothing: it has no fill and no stroke. Give it a fill, as in fill={theme.text}, or a stroke, as in stroke={{ color: theme.text }}.`,
    );
  const geometry = geometryOf(props.geometry, timing, where);
  const rest = atRest(geometry);
  // A gradient spreads across the outline; the stroke is drawn over its edge.
  const outline = boxOf(rest);
  const paint = (value: Paint) => colorOf(ctx, value, where, outline);
  const { stroke: written } = props;

  const painted = (value: Anim<Paint>, what: string) =>
    blendable(
      animated(value, paint, timing, mixPaint, `${what} on ${where}`),
      `${what} on ${where}`,
    );

  const stroke = written && {
    color: painted(written.color, "stroke"),
    width: animated(written.width ?? 1, keep, timing, mixNumber, `stroke width on ${where}`),
    cap: written.cap ?? "butt",
    join: written.join ?? "miter",
    ...(written.dash && { dash: written.dash }),
    nonScaling: written.nonScaling ?? false,
  };

  const trim =
    props.trim === undefined
      ? undefined
      : animated<Vec, Vec>(props.trim, keep, timing, mixVec, `trim on ${where}`);

  const box = paintedBoxOf(rest, lookOf({ stroke, trim }));
  const free = props.at === undefined && hasCoordinates(rest.kind);

  if (free && props.anchor !== undefined)
    throw new Error(
      `anchor on ${where} names the point its at places, but it has no at, so it stays where its coordinates put it. Give it an at, or drop anchor.`,
    );

  return {
    ...base(props, box, key, timing, free ? [0, 0] : pinned(props.anchor, box, where)),
    kind: "shape",
    geometry,
    ...(props.fill !== undefined && { fill: painted(props.fill, "fill") }),
    ...(stroke && { stroke }),
    ...(trim !== undefined && { trim }),
  };
};

const text = (ctx: Ctx, props: TextProps, key: string, timing: Timing): TextNode => {
  const where = `"${key}"`;

  const own: Asked = {
    font: props.font,
    fill: props.fill,
    ...(props.weight !== undefined && { weight: props.weight }),
    ...(props.italic !== undefined && { italic: props.italic }),
  };

  const styles = new Map<Asked, RunLook | undefined>();
  const looks = new Map<string, RunLook>();

  // Each run's style is lowered once, and two that come out the same are one, so their runs join.
  const styleOf = (asked: Asked): RunLook | undefined => {
    if (styles.has(asked)) return styles.get(asked);

    const { face, font } = ctx.fonts.add(
      asked.font,
      faceOf(asked.font, asked.weight, asked.italic, where),
    );

    const given = asked.fill;

    if (given === undefined) {
      styles.set(asked, undefined);

      return undefined;
    }

    const fill = (box: Box): Animated<ModelPaint> =>
      blendable(
        animated(
          given,
          (value: Paint) => colorOf(ctx, value, where, box),
          timing,
          mixPaint,
          `fill on ${where}`,
        ),
        `fill on ${where}`,
      );

    const opacity =
      asked.opacity === undefined
        ? undefined
        : animated(asked.opacity, keep, timing, mixNumber, `opacity of a <Run> in ${where}`);

    const made = { face, font, fill, ...(opacity !== undefined && opacity !== 1 && { opacity }) };
    const id = JSON.stringify([face, fill(PROBE), made.opacity]);
    const look = looks.get(id) ?? made;

    looks.set(id, look);
    styles.set(asked, look);

    return look;
  };

  const asked = piecesOf(props.children, own, where);
  const found = asked.map((piece) => styleOf(piece.asked));

  /** A piece with no fill of its own: only white space, which takes the look of a piece beside it in the same face. */
  const borrowed = (i: number): RunLook => {
    const { text: words, asked: wanted } = asked[i]!;

    if (words.trim() !== "")
      throw new Error(
        `<Text> ${where} draws "${words.trim()}" with no fill, so it paints nothing. Give the <Text> a fill, as in fill={theme.text}, or the <Run> around these words one.`,
      );
    const face = faceOf(wanted.font, wanted.weight, wanted.italic, where);

    const beside = [...found.slice(0, i).reverse(), ...found.slice(i + 1)].find(
      (look) => look !== undefined && look.font === face,
    );

    if (beside) return beside;

    return styleOf({ ...wanted, fill: "#00000000" })!;
  };

  const pieces = asked.map(({ text: words }, i) => {
    const look = found[i] ?? borrowed(i);
    const missing = FontBook.missing(look.font, words);

    if (missing.length > 0) {
      const { family, weight, style } = look.face;

      throw new Error(
        `<Text> ${where} draws ${JSON.stringify(words.trim())} in ${family} ${weight}${style === "italic" ? " italic" : ""}, which has no glyph for ${missing.map(charName).join(", ")}. Use a font that has ${missing.length === 1 ? "it" : "them"}, or leave ${missing.length === 1 ? "it" : "them"} out: no other font fills in.`,
      );
    }

    return { text: words, face: look.font, style: look };
  });

  const { lines, box, cuts } = layoutRuns(
    faceOf(props.font, props.weight, props.italic, where),
    pieces,
    {
      size: props.size,
      ...(props.width !== undefined && { width: props.width }),
      ...(props.lineHeight !== undefined && { lineHeight: props.lineHeight }),
      ...(props.align !== undefined && { align: props.align }),
    },
    where,
  );

  const fills = new Map<RunLook, Animated<ModelPaint>>();

  const fillOf = (look: RunLook): Animated<ModelPaint> => {
    const known = fills.get(look) ?? look.fill(box);

    fills.set(look, known);

    return known;
  };

  return {
    ...base(props, box, key, timing, pinned(props.anchor, box, where, lines[0]?.at[1] ?? 0)),
    ...(props.width !== undefined && { authored: { wrap: { width: props.width, cuts } } }),
    kind: "text",
    size: props.size,
    lines: lines.map((line): TextLine => ({
      at: line.at,
      runs: line.runs.map(({ text: words, at, advances, outline, style }): TextRun => ({
        text: words,
        at,
        advances,
        face: style.face,
        fill: fillOf(style),
        ...(style.opacity !== undefined && { opacity: style.opacity }),
        ...(outline && { outline }),
      })),
    })),
  };
};

const image = (props: ImageProps, key: string, timing: Timing): ImageNode => {
  const { src } = props;
  const ratio = src.width / src.height;
  const width = props.width ?? (props.height === undefined ? src.width : props.height * ratio);
  const height = props.height ?? (props.width === undefined ? src.height : props.width / ratio);

  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
    throw new Error(`Image "${key}" needs a positive width and height, got ${width} by ${height}.`);

  const box = { x: 0, y: 0, width, height };

  return {
    ...base(props, box, key, timing, pinned(props.anchor, box, `"${key}"`)),
    kind: "image",
    size: [width, height],
    data: src.href,
  };
};

/** Whether anything in a lowered tree moves. */
const moves = (node: SceneNode): boolean => JSON.stringify(node).includes('"kind":"lane"');

/**
 * The name a symbol takes in the model: the last key of its first instance, made of letters, digits, _ and - and
 * unique among the scene's symbols. It is stable while that instance keeps its key.
 */
const symbolName = (ctx: Ctx, key: string): string => {
  const stem = key
    .split("/")
    .at(-1)!
    .replace(/[^\w-]/g, "_");

  let name = stem;

  for (let n = 2; ctx.symbols.has(name); n++) name = `${stem}-${n}`;

  return name;
};

const instance = (ctx: Ctx, props: InstanceProps, key: string, timing: Timing): InstanceNode => {
  const { of } = props;

  if (of?.kind !== "symbol")
    throw new Error(`<Instance> "${key}" needs of={…}, a symbol from symbol(() => …).`);
  const named = ctx.named.get(of);
  const known = named === undefined ? undefined : ctx.symbols.get(named);

  if (known && !known.node)
    throw new Error(
      `The symbol that <Instance> "${key}" places holds an instance of itself, so it would never end.`,
    );

  const name = named ?? symbolName(ctx, key);

  if (!known) {
    const entry: SymbolEntry = { of };

    ctx.named.set(of, name);
    ctx.symbols.set(name, entry);
    const root = `#${name}`;

    // A symbol is drawn once and shared, so it is lowered on the scene's own clock, wherever an instance sits.
    const children = arrangeState(
      lowerAll(
        ctx,
        within(ctx.size, () => flat(of.build())),
        sceneTiming(ctx),
        root,
      ),
      ctx.notes,
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

  const { node, moves: moving } = ctx.symbols.get(name)!;
  const clip = timing.clock.clips.at(-1);

  if (moving && timing.clock.offset > EPSILON)
    throw new Error(
      `Instance "${key}" sits inside ${clip?.label ?? "a sequence"}, but its symbol moves, and a symbol's tracks run on the scene's clock for every instance. Move the instance instead, or draw the content without a symbol.`,
    );

  const home: Vec =
    props.anchor === undefined ? [0, 0] : pinned(props.anchor, node!.box, `"${key}"`);

  return { ...base(props, node!.box, key, timing, home), kind: "instance", symbol: name };
};

const sceneTiming = ({ duration }: Ctx): Timing => ({
  duration,
  clock: { offset: 0, end: duration, clips: [] },
});

const label = (begin: Seconds, over: Seconds | undefined): string =>
  `<Sequence start={${num(begin)}}${over === undefined ? "" : ` over={${num(over)}}`}>`;

const inside = (timing: Timing, begin: Seconds, over: Seconds | undefined): Timing => {
  checkWindow(begin, over ?? 1, "<Sequence>");
  const parent = timing.clock;
  const start = parent.offset + begin;
  const end = over === undefined ? parent.end : start + over;
  const name = label(begin, over);

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
      const clocked = inside(timing, given.start, given.over);

      if (given.timeline) ctx.cues.claim(given.timeline, clocked.clock);

      return lowerAll(ctx, given.children, clocked, parent, taken);
    }

    if (given.type === "morph") {
      const seen = new Map<string, Anchor | undefined>();
      const states: SceneNode[][] = [];

      const merged = morphed(given, timing, taken, (state, names) => {
        const nodes = arrangeState(lowerAll(ctx, state, timing, parent, names), ctx.notes);

        sameAnchors(nodes, ctx.notes, seen);
        states.push(nodes);

        return nodes;
      });

      noteResized(ctx.notes, merged, states);

      return merged;
    }

    const name = given.props.key ?? given.props.ref?.key;

    if (name !== undefined && taken.has(name))
      throw new Error(`Two nodes are both keyed "${name}"${parent && ` inside "${parent}"`}.`);

    if (name?.includes("/")) throw new Error(`A key can't contain "/", got "${name}".`);
    let own = name;

    for (let index = taken.size; own === undefined; index++)
      if (!taken.has(String(index))) own = String(index);
    taken.add(own);
    const key = parent ? `${parent}/${own}` : own;

    // A shape drawn by its own coordinates starts a timeline's move from where they put its box.
    const home = (): Vec => {
      if (given.type !== "shape" || given.props.at !== undefined) return [0, 0];
      const drawn = shape(ctx, given.props, key, timing);

      return hasCoordinates(atRest(drawn.geometry).kind) ? [drawn.box.x, drawn.box.y] : [0, 0];
    };

    const el = ctx.cues.apply(given, key, timing, ctx.notes, parent, home);

    note(ctx.notes, key, el.props, el.type, el.type === "group" ? el.settle : undefined);

    const done = (node: SceneNode): SceneNode[] => [
      identified(given, name, dressed(ctx, el.props, node, timing)),
    ];

    switch (el.type) {
      case "shape":
        return done(shape(ctx, el.props, key, timing));
      case "text":
        return done(text(ctx, el.props, key, timing));
      case "image":
        return done(image(el.props, key, timing));
      case "instance":
        return done(instance(ctx, el.props, key, timing));
      case "group": {
        const children = lowerAll(ctx, el.children, timing, key);

        const node: GroupNode = {
          ...base(el.props, around(children), key, timing, [0, 0]),
          ...(el.layout && { authored: { layout: el.layout } }),
          kind: "group",
          children,
        };

        return done(node);
      }
    }
  });

/** A length an effect takes: a still one below 0 is a mistake, and one a lane passes below 0 draws as 0. */
const lengthOf = (value: Anim<number>, timing: Timing, where: string): Animated<number> => {
  const out = animated(value, keep, timing, mixNumber, where);

  if (!isLane(out) && !(out >= 0 && Number.isFinite(out)))
    throw new Error(`${where} needs a finite length of 0 or more, got ${out}.`);

  return out;
};

const effectOf = (ctx: Ctx, effect: EffectProps, timing: Timing, where: string): Effect => {
  if (effect.kind === "blur")
    return { kind: "blur", radius: lengthOf(effect.radius, timing, `blur on ${where}`) };

  if (effect.kind !== "shadow")
    throw new Error(
      `effects on ${where} takes blur() and shadow(), got ${JSON.stringify(effect)}.`,
    );
  const opacity = animated(effect.opacity, keep, timing, mixNumber, `shadow opacity on ${where}`);

  if (!isLane(opacity) && !(opacity >= 0 && opacity <= 1))
    throw new Error(`shadow opacity on ${where} needs a number from 0 to 1, got ${opacity}.`);

  return {
    kind: "shadow",
    offset: animated<Vec, Vec>(effect.offset, keep, timing, mixVec, `shadow offset on ${where}`),
    blur: lengthOf(effect.blur, timing, `shadow blur on ${where}`),
    color: solidOf(ctx, effect.color, `shadow on ${where}`),
    opacity,
  };
};

/**
 * A mask's content, lowered in the node's frame as children would be and arranged where it stands. Nothing in it can
 * be placed from outside, since the second pass places only what the scene draws.
 */
const maskOf = (ctx: Ctx, mask: Child, key: string, timing: Timing): GroupNode | undefined => {
  const elements = flat(mask);

  if (elements.length === 0) return undefined;
  const root = `${key}#mask`;
  const children = arrangeState(lowerAll(ctx, elements, timing, root), ctx.notes);

  for (const child of children) {
    const placed = outsider(child, ctx.notes);

    if (placed !== undefined)
      throw new Error(
        `"${placed}" is in the mask of "${key}" and is placed by an anchor, a timeline's move to an anchor, or as an arrow's end. A mask is drawn in its node's frame and is never part of the layout: place what is in it with at.`,
      );
  }

  return {
    kind: "group",
    key: root,
    box: around(children),
    at: [0, 0],
    origin: [0, 0],
    layers: [],
    effects: [],
    children,
  };
};

/** `node` with the clip, mask and effects `props` ask for, all in its own frame. */
const dressed = (
  ctx: Ctx,
  props: Omit<Common, "anchor">,
  node: SceneNode,
  timing: Timing,
): SceneNode => {
  const where = `"${node.key}"`;
  const { clip, effects = [] } = props;
  const mask = props.mask === undefined ? undefined : maskOf(ctx, props.mask, node.key, timing);

  return {
    ...node,
    ...(clip !== undefined && { clip: geometryOf(clip, timing, where, "clip") }),
    ...(mask && { mask }),
    effects: effects.map((effect) => effectOf(ctx, effect, timing, where)),
  };
};

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

  if (
    options.reducedMotion !== undefined &&
    options.reducedMotion !== false &&
    !Number.isFinite(options.reducedMotion)
  )
    throw new Error(
      `scene() needs reducedMotion as a time in seconds, or false, got ${String(options.reducedMotion)}.`,
    );

  const [[top, cues], declared] = declaring(() =>
    collect(() => sceneElement(within(size, build), "scene()'s callback")),
  );

  const ctx: Ctx = {
    tokens: new Map(),
    fonts: new FontBook(),
    size,
    duration,
    symbols: new Map(),
    named: new Map(),
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
  const refs = [...new Set([...declared, ...ctx.notes.refs.keys(), ...cues.refs])];

  const still =
    options.reducedMotion === false
      ? undefined
      : Math.max(0, Math.min(duration, options.reducedMotion ?? duration * 0.85));

  return {
    size,
    duration,
    title: options.title,
    ...(options.desc !== undefined && { desc: options.desc }),
    loop: options.loop ?? true,
    ...(still !== undefined && { still }),
    tokens: Object.fromEntries(ctx.tokens),
    fonts: ctx.fonts.families(),
    symbols: Object.fromEntries([...ctx.symbols].map(([name, entry]) => [name, entry.node!])),
    root,
    ...((refs.length > 0 || cues.applied.length > 0) && {
      authored: {
        refs: refs.map((each) => ({ key: each.key, attached: ctx.notes.refs.has(each) })),
        actions: cues.applied,
      },
    }),
  };
};
