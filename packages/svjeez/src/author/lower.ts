import type { Font } from "../font/font";
import { num } from "../model/format";
import { EPSILON, type Seconds } from "../model/time";
import { checkWindow } from "./span";
import type { Clock } from "./clock";
import {
  lengthOf as outlineLength,
  growBox,
  matched,
  mixGeometry,
  outlineBoxOf,
} from "../model/geometry";
import { componentOf, identified, keyText, listOf, sourced, writtenAt } from "./identity";
import { Names, quoted, wordsOf, type Named } from "./names";
import { isArray, isNumber } from "../model/guards";
import { SceneError, located } from "../model/scene-error";
import { tagOf } from "../model/naming";
import type {
  Animated,
  Box,
  Color,
  Stroke,
  Geometry as Outline,
  GroupNode,
  PictureNode,
  Layer,
  Effect,
  Paint as ModelPaint,
  Pattern as ModelPattern,
  Scene,
  SceneNode,
  ShapeNode,
  Face,
  TextLine,
  TextRun,
  TokenValue,
  Vec,
} from "../model/ir";
import { atRest, isLane, pair } from "../model/lane";
import { type Taken, morphed, type MorphElement } from "./morph";
import {
  flat,
  sceneElement,
  type Backdrop,
  type Bounds,
  type Child,
  type Common,
  type PictureProps,
  type SceneElement,
  type ShapeProps,
  type StrokeProps,
  type TextProps,
} from "./nodes";
import { isAnchor, type Anchor } from "./refs";
import {
  arrangeState,
  around,
  note,
  noteId,
  noteResized,
  notes,
  originOf,
  outsider,
  sameAnchors,
  settle,
  type BackdropOf,
  type Notes,
} from "./settle";
import {
  laneOf,
  mapped,
  mixNumber,
  mixVec,
  noMix,
  same,
  type Mix,
  type Reading,
  type Timing,
} from "../model/steps";
import { isTrack, layersOf, passageOf, readOf, type Anim, type Layer as Written } from "./track";
import { derivedOf, isDerived, restOf, through, together } from "./derived";
import { withGoals } from "./goals";
import { expand, rootLength } from "./expand";
import type { NodeElement } from "./nodes";
import {
  outlineOf,
  polygon,
  rect,
  rgbaOf,
  type Geometry,
  type Hex,
  type Paint,
  type Theme,
  type Token,
} from "./values";
import { FontBook, charName, faceOf, piecesOf, type Asked } from "./runs";
import { lookOf, paintedBoxOf } from "../model/painted";
import { pinned } from "./pin";
import { sub } from "../model/vec";
import { fitSizeForRuns, layoutRuns, setAlong } from "./text";
import { countedNodes, countingIn, rateOf, ticksOf } from "./count";
import { shown, swapIn, swapTicks, swapping, textsOf, unionOf } from "./swap";
import { typedNodes, typedTicks, typing as typingMix, typingIn } from "./typed";
import {
  blendable,
  gradientOf,
  isWrittenGradient,
  isWrittenPattern,
  mixPaint,
  type Pattern,
  isNoise,
  isNone,
  layersOfPaints,
  standIn,
  type Noise,
  type PaintLayer,
  type Paints,
} from "./paint";
import type { Effect as EffectProps } from "./effects";

interface RunLook {
  readonly face: Face;
  readonly font: Font;
  readonly fill: (box: Box) => Animated<ModelPaint>;
  readonly opacity?: Animated<number>;
}

const PROBE: Box = { x: 0, y: 0, width: 1, height: 1 };

export interface SceneOptions {
  readonly size: Vec;
  /** How long it plays. Left out, it is the length of the root: where its last `<Sequence>` ends. */
  readonly duration?: Seconds;
  readonly title: string;
  readonly desc?: string;
  readonly theme?: Theme;
  readonly loop?: boolean;
  /**
   * The moment shown, held still, to viewers who ask for reduced motion: a time in seconds (85% of the duration if
   * left out), or false to play the motion for them too.
   */
  readonly still?: Seconds | false;
  /**
   * Named moments, in seconds, that `svjeez frames --times` and `svjeez check --at` take in place of a number:
   * `markers: { handoff: 4.5 }` makes `--times handoff,10` work.
   */
  readonly markers?: Readonly<Record<string, Seconds>>;
}

interface Ctx {
  readonly tokens: Map<string, TokenValue>;
  readonly fonts: FontBook;
  readonly size: Vec;
  readonly duration: Seconds;
  readonly notes: Notes;
  readonly patterns: Map<Pattern, ModelPattern>;
  readonly reads: Map<object, Reading>;
  readonly clocks: Map<string, Clock>;
  /**
   * For a key that two lists in one parent write in a morph's states, the place of the list whose node keeps the key
   * as written, by the key's full path. Set over all the states at once, so a node is named alike in each.
   */
  readonly owners: Map<string, string>;
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

  if (isArray(value) && value.some((part) => isTrack(part) || isDerived(part)))
    throw new SceneError(
      `${where} is a point with a track inside it, but a track moves the whole point.`,
      "Write the point as one track, as in track([0, 0]).to([0, -55], span(…)); track(…).map((y) => [0, y]) moves one axis.",
    );

  if (!isTrack(value)) return change(value);
  // SAFETY: a value that is not undefined is an A, and undefined is itself one when A allows it, so change() takes it either way.
  const data = mapped(readOf(value, timing, where).data, "value", (given) => change(given as A));

  return laneOf(data, data.initial.value!, timing, mix, where, curves);
};

const colorOf = (ctx: Ctx, paint: Paint, where: string, timing: Timing, box?: Box): ModelPaint => {
  if (isNoise(paint) || isNone(paint))
    throw new SceneError(
      `${where} has ${paint.kind === "noise" ? "a noise()" : "a none"} paint where it can't go: in a track, a <Run>, or the stroke of a <Text>.`,
      paint.kind === "noise"
        ? "Give noise() as the fill of a <Shape> or <Text>, a layer of a <Shape>'s fill or stroke, or a <Shape>'s stroke, and keep it still: animate its frequency instead."
        : "Give none as a whole fill or stroke color, never in a track; fade a part out with opacity.",
    );

  if (isWrittenPattern(paint)) return patternOf(ctx, paint, where, timing);

  return isWrittenGradient(paint)
    ? gradientOf(paint, box, (color) => solidOf(ctx, color, where), where)
    : solidOf(ctx, paint, where);
};

/** A pattern is lowered once, however many nodes it paints, so its tile is one def in SVG. */
const patternOf = (ctx: Ctx, given: Pattern, where: string, timing: Timing): ModelPattern => {
  const known = ctx.patterns.get(given);

  if (known) return known;
  const root = `pattern${ctx.patterns.size + 1}`;

  const tile = groupOf(
    ctx,
    flat(given.tile).map(expand),
    root,
    `a pattern painting ${where}`,
    timing,
  );

  if (tile === undefined)
    throw new SceneError(
      `The pattern painting ${where} has nothing to draw.`,
      "Give pattern() a tile, as in tile: <Shape geometry={circle(3)} fill={theme.ink} />.",
    );

  const made: ModelPattern = {
    kind: "pattern",
    size: given.size,
    offset: animated<Vec, Vec>(given.offset, keep, timing, mixVec, `pattern offset on ${where}`),
    ...(given.rotate !== 0 && { rotate: given.rotate }),
    tile,
  };

  ctx.patterns.set(given, made);

  return made;
};

const solidOf = (ctx: Ctx, paint: Hex | Token, where: string): Color => {
  if (isHex(paint)) return rgbaOf(paint, where);
  const { mix } = paint;

  const value: TokenValue = {
    light: rgbaOf(paint.light, where),
    dark: rgbaOf(paint.dark, where),
    ...(mix && {
      mix: { a: solidOf(ctx, mix.a, where), b: solidOf(ctx, mix.b, where), share: mix.share },
    }),
  };

  const known = ctx.tokens.get(paint.name);

  if (known && !same(known, value))
    throw new SceneError(`Two tokens are both named "${paint.name}", with different colors.`);
  ctx.tokens.set(paint.name, value);

  return { kind: "token", name: paint.name };
};

const isHex = (paint: Hex | Token): paint is Hex => typeof paint === "string";

const layerOf = (layer: Written, timing: Timing, where: string): Layer => {
  const at = (name: string): string => `${name} in motion of ${where}`;

  return {
    offset: animated<Vec, Vec>(layer.offset ?? [0, 0], keep, timing, mixVec, at("offset")),
    rotate: animated(layer.rotate ?? 0, keep, timing, mixNumber, at("rotate")),
    scale: animated<number | Vec, Vec>(layer.scale ?? 1, pair, timing, mixVec, at("scale")),
    skew: animated(layer.skew ?? 0, keep, timing, mixNumber, at("skew")),
    opacity: animated(layer.opacity ?? 1, keep, timing, mixNumber, at("opacity")),
  };
};

const NOWHERE: Vec = [0, 0];

const IDLE: Layer = { offset: [0, 0], rotate: 0, scale: [1, 1], skew: 0, opacity: 1 };

const base = (
  ctx: Ctx,
  props: Omit<Common, "anchor">,
  box: Box,
  key: string,
  timing: Timing,
  home: Vec,
) => {
  const where = ctx.notes.names.named(key);

  const framed = props.offset !== undefined;
  const start: Vec = framed ? [0, 0] : home;
  const point = props.offset ?? props.at;

  const own: Layer = {
    offset: [0, 0],
    rotate: animated(props.rotate ?? 0, keep, timing, mixNumber, `rotate on ${where}`),
    scale: animated<number | Vec, Vec>(props.scale ?? 1, pair, timing, mixVec, `scale on ${where}`),
    skew: animated(props.skew ?? 0, keep, timing, mixNumber, `skew on ${where}`),
    opacity: animated(props.opacity ?? 1, keep, timing, mixNumber, `opacity on ${where}`),
  };

  return {
    key,
    box,
    at: isAnchor(point)
      ? NOWHERE
      : animated<Vec, Vec>(
          point ?? start,
          (value) => sub(value, start),
          timing,
          mixVec,
          `${framed ? "offset" : "at"} on ${where}`,
          true,
        ),
    origin: originOf(ctx.notes.names, props.origin, box, key, () => start),
    layers: [
      ...layersOf(props.motion, where).map((layer) => layerOf(layer, timing, where)),
      own,
    ].filter((layer) => !same(layer, IDLE)),
    effects: [],
  };
};

const geometryOf = (
  value: ShapeProps["geometry"],
  timing: Timing,
  where: string,
  what = "geometry",
): Animated<Outline> => {
  if (isDerived(value)) return derivedOf(value, outlineOf, timing, `${what} on ${where}`);

  if (!isTrack(value)) return outlineOf(value);
  const { data } = readOf(value, timing, `${what} on ${where}`);

  const authored = [data.initial, ...data.steps.map((step) => step.values)].flatMap(
    (values): Geometry[] => (values.value === undefined ? [] : [values.value]),
  );

  const blended = matched(authored.map(outlineOf), `${what} on ${where}`);
  const lowered = new Map(authored.map((given, i) => [given, blended[i]!]));
  const lane = mapped(data, "value", (given) => lowered.get(given)!);

  return laneOf(lane, lane.initial.value!, timing, mixGeometry, `${what} on ${where}`);
};

const fillOpacityOf = (
  value: Anim<number> | undefined,
  timing: Timing,
  where: string,
): Animated<number> | undefined => {
  if (value === undefined) return undefined;
  const lowered = animated(value, keep, timing, mixNumber, `fillOpacity on ${where}`);

  if (!isLane(lowered) && !(lowered >= 0 && lowered <= 1 && Number.isFinite(lowered)))
    throw new SceneError(`fillOpacity on ${where} needs a number from 0 to 1, got ${lowered}.`);

  return lowered;
};

/** How far, in px, an anchor's point may move across a geometry's keys before the anchor no longer holds. */
const DRIFT = 0.5;

const shape = (
  ctx: Ctx,
  props: ShapeProps,
  key: string,
  timing: Timing,
): ShapeNode | GroupNode | undefined => {
  const where = ctx.notes.names.named(key);

  if (props.geometry === undefined)
    throw new SceneError(
      `${where} has no geometry.`,
      "Give it one, such as geometry={rect(40, 20)}.",
    );
  const fills = props.fill === undefined ? [] : layersOfPaints(props.fill);
  const strokes = props.stroke === undefined ? [] : layersOfPaints(props.stroke.color);

  if (fills.length === 0 && strokes.length === 0 && (props.fill ?? props.stroke) !== undefined)
    return undefined;

  if (props.fill === undefined && props.stroke === undefined)
    throw new SceneError(
      `${where} paints nothing: it has no fill and no stroke.`,
      "Give it a fill, as in fill={theme.text}, or a stroke, as in stroke={{ color: theme.text }}.",
    );
  const geometry = geometryOf(props.geometry, timing, where);

  if (props.anchor !== undefined && isLane(geometry)) {
    const points = geometry.keys.map((key) => pinned(props.anchor, outlineBoxOf(key.value), where));

    if (points.some(([x, y]) => Math.hypot(x - points[0]![0], y - points[0]![1]) > DRIFT))
      throw new SceneError(
        `${where} has anchor=${JSON.stringify(props.anchor)} and a geometry whose box moves that point as it animates, but the anchor is read from the box at rest, so it stops holding once the geometry changes.`,
        "Drop at and anchor and wrap it in <Group offset={…}>, which puts the geometry's own [0, 0] there; or keep the geometry and animate scale.",
      );
  }

  const rest = atRest(geometry);
  const outline = outlineBoxOf(rest);
  const paint = (value: Paint) => colorOf(ctx, value, where, timing, outline);
  const { stroke: written } = props;

  const painted = (value: Anim<Paint>, what: string) =>
    blendable(
      animated(value, paint, timing, mixPaint, `${what} on ${where}`),
      `${what} on ${where}`,
    );

  const solid = (value: Anim<Paint>): Anim<Paint> => (isNoise(value) ? standIn(value) : value);

  const strokeIn = (color: Anim<Paint> | undefined) =>
    written && color !== undefined
      ? strokeOf(ctx, { ...written, color: solid(color) }, timing, where, outline)
      : undefined;

  const stroke = strokeIn(strokes[0]?.paint);
  const fillOpacity = fillOpacityOf(props.fillOpacity, timing, where);

  if (props.draw !== undefined && props.trim !== undefined)
    throw new SceneError(
      `${where} has both draw and trim, but draw is trim [0, draw].`,
      "Pick one: draw for a stroke that draws on, or trim for a window [from, to].",
    );
  const window = props.draw === undefined ? props.trim : through(props.draw, (d): Vec => [0, d]);

  const trim =
    window === undefined
      ? undefined
      : animated<Vec, Vec>(window, keep, timing, mixVec, `trim on ${where}`);

  const box = paintedBoxOf(rest, lookOf({ stroke, trim }));

  const look = (fill: Anim<Paint> | undefined, color: Anim<Paint> | undefined) => {
    const drawn =
      color === undefined ? undefined : color === strokes[0]?.paint ? stroke : strokeIn(color);

    const noisy = [fill, color].find(isNoise);

    return {
      kind: "shape" as const,
      geometry,
      ...(fill !== undefined && { fill: painted(solid(fill), "fill") }),
      ...(fillOpacity !== undefined && fillOpacity !== 1 && { fillOpacity }),
      ...(drawn && { stroke: drawn }),
      ...(trim !== undefined && { trim }),
      ...(noisy && { effects: [noiseOf(ctx, noisy, timing, where)] }),
    };
  };

  const bare = (layer: PaintLayer) =>
    (layer.blend === undefined || layer.blend === "normal") &&
    layer.opacity === undefined &&
    layer.effects === undefined;

  const [fill] = fills;

  if (
    fills.length <= 1 &&
    strokes.length <= 1 &&
    [...fills, ...strokes].every(bare) &&
    !(strokes.length === 1 && fill !== undefined && [fill.paint, strokes[0]!.paint].some(isNoise))
  )
    return turned(
      {
        ...base(ctx, props, box, key, timing, pinned(props.anchor, box, where)),
        ...look(fill?.paint, strokes[0]?.paint),
      },
      [fill?.paint, strokes[0]?.paint].find(isNoise),
    );

  const copy =
    (side: "fill" | "stroke") =>
    (layer: PaintLayer, i: number): SceneNode => {
      const what = `${side} layer ${i + 1} on ${where}`;

      const opacity =
        layer.opacity === undefined
          ? 1
          : animated(layer.opacity, keep, timing, mixNumber, `opacity of ${what}`);

      if (!isLane(opacity) && !(opacity >= 0 && opacity <= 1))
        throw new SceneError(`The opacity of ${what} needs a number from 0 to 1, got ${opacity}.`);

      if (layer.effects !== undefined && !isArray(layer.effects))
        throw new SceneError(
          `The effects of ${what} need to be a list, got ${JSON.stringify(layer.effects)}.`,
          "Write effects: [emboss({ depth: 1.8 })].",
        );
      const drawn = side === "fill" ? look(layer.paint, undefined) : look(undefined, layer.paint);

      return {
        ...turned(
          {
            key: `${key}#${side}${i + 1}`,
            box,
            at: [0, 0],
            origin: [0, 0],
            layers: opacity === 1 ? [] : [{ ...IDLE, opacity }],
            ...drawn,
            effects: [
              ...(drawn.effects ?? []),
              ...(layer.effects ?? []).map((effect) => effectOf(ctx, effect, timing, what)),
            ],
          },
          layer.paint,
        ),
        ...(layer.blend !== undefined && layer.blend !== "normal" && { blend: layer.blend }),
      };
    };

  const under = strokes.map(copy("stroke"));
  const over = fills.map(copy("fill"));

  return {
    ...base(ctx, props, box, key, timing, pinned(props.anchor, box, where)),
    kind: "group",
    children: written?.under ? [...under, ...over] : [...over, ...under],
  };
};

/**
 * A node whose first effect is a turned noise, drawn so only the noise turns: the filter sits on a group turned about
 * the center of the node's box, around the node turned back. The node's place, motion and other effects stay outside;
 * it carries no blend yet, which the caller adds to what this returns.
 */
const turned = <N extends SceneNode>(node: N, paint: Anim<Paint> | undefined): N | GroupNode => {
  const rotate = isNoise(paint) ? paint.rotate : 0;
  const [noise, ...after] = node.effects;

  if (rotate === 0 || noise?.kind !== "noise") return node;
  const { key, box, at, origin, layers } = node;
  const center: Vec = [box.x + box.width / 2, box.y + box.height / 2];

  const spun = (angle: number): Pick<SceneNode, "box" | "at" | "origin" | "layers"> => ({
    box,
    at: [0, 0],
    origin: center,
    layers: [{ ...IDLE, rotate: angle }],
  });

  return {
    kind: "group",
    key,
    box,
    at,
    origin,
    layers,
    effects: after,
    children: [
      {
        kind: "group",
        key: `${key}#noise`,
        ...spun(rotate),
        effects: [noise],
        children: [{ ...node, key: `${key}#grain`, ...spun(-rotate), effects: [] }],
      },
    ],
  };
};

/** The noise filter a `noise()` paint lowers to: it repaints whatever the node draws with the ramp. */
const noiseOf = (ctx: Ctx, paint: Noise, timing: Timing, where: string): Effect => {
  const what = `noise frequency on ${where}`;
  const frequency = animated<number | Vec, Vec>(paint.frequency, pair, timing, mixVec, what);
  const values = isLane(frequency) ? frequency.keys.map((key) => key.value) : [frequency];

  if (!values.flat().every((value) => value >= 0 && Number.isFinite(value)))
    throw new SceneError(
      `${what} needs numbers of 0 or more, got ${JSON.stringify(values)}.`,
      "Noise frequency is cycles per unit: try 0.01 for a soft mottle.",
    );
  const { ramp } = paint;

  return {
    kind: "noise",
    frequency,
    octaves: paint.octaves,
    seed: paint.seed,
    type: paint.type,
    stitch: paint.stitch,
    ramp: ramp.map((stop, i) => {
      const [offset, color] = isArray(stop) ? stop : [i / (ramp.length - 1), stop];

      return { offset, color: solidOf(ctx, color, `the noise ramp on ${where}`) };
    }),
  };
};

const onePaint = (paints: Paints, where: string): Anim<Paint> => {
  if (isArray(paints))
    throw new SceneError(
      `${where} has a layered stroke, which only a <Shape> takes.`,
      "Give the <Text> one stroke paint, or stack two <Text>s in a <Group>.",
    );

  return paints;
};

const strokeOf = (
  ctx: Ctx,
  written: StrokeProps,
  timing: Timing,
  where: string,
  box: Box,
): Stroke => {
  if (written.dashOffset !== undefined && !written.dash)
    throw new SceneError(
      `${where} has a dashOffset but no dash to slide.`,
      "Give the stroke a dash, as in stroke={{ color, dash: [4, 4], dashOffset }}.",
    );

  if (written.dash && !isArray(written.dash))
    throw new SceneError(
      `${where} has a stroke dash of ${String(written.dash)}, which is not a list.`,
      "Give the dash as an array of lengths, as in stroke={{ color, dash: [2, 2] }}; dash: [2] is 2 on, 2 off.",
    );

  return {
    color: blendable(
      animated(
        onePaint(written.color, where),
        (value: Paint) => colorOf(ctx, value, where, timing, box),
        timing,
        mixPaint,
        `stroke on ${where}`,
      ),
      `stroke on ${where}`,
    ),
    width: animated(written.width ?? 1, keep, timing, mixNumber, `stroke width on ${where}`),
    cap: written.cap ?? "flat",
    join: written.join ?? "sharp",
    under: written.under ?? false,
    ...(written.dash && { dash: written.dash }),
    ...(written.dashOffset !== undefined && {
      dashOffset: animated(written.dashOffset, keep, timing, mixNumber, `dash offset on ${where}`),
    }),
    fixedWidth: written.fixedWidth ?? false,
  };
};

/** A <Text> with its `none` paints left out (all of it, when it paints nothing else) and a noise fill as a filter. */
const paintedText = (
  ctx: Ctx,
  props: TextProps,
  key: string,
  timing: Timing,
): SceneNode | undefined => {
  const where = ctx.notes.names.named(key);
  const { fill, stroke, ...rest } = props;
  const lined = stroke && !isNone(stroke.color) ? stroke : undefined;

  if (isNone(fill) && lined === undefined) return undefined;

  if (fill === undefined && stroke !== undefined && lined === undefined) return undefined;

  if (isArray(fill) || isArray(lined?.color))
    throw new SceneError(
      `${where} has a layered ${isArray(fill) ? "fill" : "stroke"}, which only a <Shape> takes.`,
      "Give the <Text> one paint, or stack two <Text>s in a <Group> and blend the top one.",
    );

  const kept = {
    ...rest,
    ...(fill !== undefined && !isNone(fill) && { fill: isNoise(fill) ? standIn(fill) : fill }),
    ...(lined && { stroke: lined }),
  };

  if (!isNoise(fill)) return text(ctx, kept, key, timing);

  if (lined)
    throw new SceneError(
      `${where} has a noise() fill and a stroke, and the noise would paint over both.`,
      "Draw the stroke as a second <Text> under it in a <Group>, or drop the stroke.",
    );
  const node = text(ctx, kept, key, timing);

  return turned({ ...node, effects: [noiseOf(ctx, fill, timing, where), ...node.effects] }, fill);
};

const text = (ctx: Ctx, props: TextProps, key: string, timing: Timing): SceneNode => {
  const where = ctx.notes.names.named(key);
  const initialSize = props.size ?? props.fit?.maxSize;

  if (initialSize === undefined || !(initialSize > 0 && Number.isFinite(initialSize)))
    throw new SceneError(
      `${where} needs a size above 0, got ${String(initialSize)}.`,
      "To grow text in from nothing, scale it in with motion={enter(…, { from: { scale: 0 } })}.",
    );

  if (props.draw !== undefined && props.trim !== undefined)
    throw new SceneError(
      `${where} has both draw and trim, but draw is trim [0, draw].`,
      "Pick one: draw for a stroke that draws on, or trim for a window [from, to].",
    );

  const trimWindow =
    props.draw === undefined ? props.trim : through(props.draw, (d): Vec => [0, d]);

  const trim =
    trimWindow === undefined
      ? undefined
      : animated<Vec, Vec>(trimWindow, keep, timing, mixVec, `trim on ${where}`);

  const fillOpacity = fillOpacityOf(props.fillOpacity, timing, where);
  const counting = countingIn(props.children, where);
  const strokeOnly = props.fill === undefined && props.stroke !== undefined;
  const size = initialSize;

  const own: Asked = {
    font: props.font,
    fill: props.fill ?? (strokeOnly ? "#00000000" : undefined),
    ...(props.weight !== undefined && { weight: props.weight }),
    ...(props.italic !== undefined && { italic: props.italic }),
    ...(props.letterSpacing !== undefined && { letterSpacing: props.letterSpacing }),
  };

  const styles = new Map<Asked, RunLook | undefined>();
  const looks = new Map<string, RunLook>();

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
          (value: Paint) => colorOf(ctx, value, where, timing, box),
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

  const unseen = (look: RunLook, words: string): void => {
    const missing = FontBook.missing(look.font, words);

    if (missing.length === 0) return;
    const { family, weight, italic } = look.face;

    throw new SceneError(
      `${where} draws ${JSON.stringify(words.trim())} in ${family} ${weight}${italic ? " italic" : ""}, which has no glyph for ${missing.map(charName).join(", ")}.`,
      `Use a font that has ${missing.length === 1 ? "it" : "them"}, or leave ${missing.length === 1 ? "it" : "them"} out: no other font fills in.`,
    );
  };

  const counted = ((): { node: SceneNode } | { words: string } | undefined => {
    if (!counting) return undefined;

    if (props.along !== undefined)
      throw new SceneError(
        `${where} counts, and a count can't be set along an outline.`,
        "Drop along, or write the number as plain text.",
      );

    if (props.width !== undefined)
      throw new SceneError(
        `${where} counts, and a count doesn't wrap, so it takes no width.`,
        "Drop width: the <Text> is as wide as the widest number it shows.",
      );
    const look = styleOf(own);

    if (!look)
      throw new SceneError(
        `${where} counts with no fill, so it paints nothing.`,
        "Give the <Text> a fill, as in fill={theme.text}.",
      );
    const { format } = counting.count;
    const rate = rateOf(counting.count, where);
    const value = animated(counting.count.value, keep, timing, mixNumber, `the count in ${where}`);
    const ticks = ticksOf(value, ctx.duration, format, rate, where);
    const { before, after } = counting;

    unseen(look, before + ticks.map((tick) => tick.text).join("") + after);

    if (ticks.length === 1) return { words: before + ticks[0]!.text + after };

    const { box, baseline, node } = countedNodes(
      {
        key,
        where,
        font: look.font,
        face: look.face,
        size,
        align: props.align ?? "start",
        fill: look.fill,
      },
      counting,
      ticks,
    );

    const stroke = props.stroke && strokeOf(ctx, props.stroke, timing, where, box);
    const drawn = strokedBox(box, stroke);
    const home = pinned(props.anchor, drawn, where, baseline);

    return {
      node: {
        ...base(ctx, props, drawn, key, timing, home),
        authored: {
          count: { ticks: ticks.map(({ t, text }) => ({ t, text: before + text + after })) },
        },
        kind: "group",
        children: [stroke ? stroked(node, stroke) : node],
      },
    };
  })();

  if (counted && "node" in counted) return counted.node;

  const typing = typingIn(props.children, where);

  if (typing) {
    const refuse = (what: string, fix: string): never => {
      throw new SceneError(`${where} types, and typed text ${what}.`, fix);
    };

    if (props.along !== undefined)
      refuse("can't be set along an outline", "Drop along, or write the words as plain text.");

    if (props.width !== undefined)
      refuse(
        "is one line, so it takes no width",
        "Drop width: the <Text> is as wide as the longest text it types.",
      );

    if ((props.align ?? "start") !== "start")
      refuse(
        "grows from its start, so it takes no align",
        "Drop align, and place the <Text> with anchor or a layout.",
      );
    const look = styleOf(own);

    if (!look)
      throw new SceneError(
        `${where} types with no fill, so it paints nothing.`,
        "Give the <Text> a fill, as in fill={theme.text}.",
      );
    const spacing = props.letterSpacing ?? 0;

    if (!Number.isFinite(spacing))
      throw new SceneError(`${where} needs a finite letterSpacing, got ${spacing}.`);
    const { before, typed } = typing;

    const value = animated(
      typed.value,
      keep,
      timing,
      typingMix(typed.by),
      `the typed text in ${where}`,
    );

    const ticks = typedTicks(value, typed.by, ctx.duration, where);

    unseen(look, before + ticks.map((tick) => tick.text).join(""));

    const caret =
      typed.caret?.opacity === undefined
        ? undefined
        : animated(typed.caret.opacity, keep, timing, mixNumber, `the caret's opacity in ${where}`);

    const { box, baseline, node } = typedNodes(
      {
        key,
        where,
        font: look.font,
        face: look.face,
        size,
        spacing,
        fill: look.fill,
        ...(caret !== undefined && { caret }),
      },
      typing,
      ticks,
      ctx.duration,
    );

    const stroke = props.stroke && strokeOf(ctx, props.stroke, timing, where, box);
    const drawn = strokedBox(box, stroke);
    const home = pinned(props.anchor, drawn, where, baseline);

    return {
      ...base(ctx, props, drawn, key, timing, home),
      authored: { count: { ticks: ticks.map(({ t, text }) => ({ t, text: before + text })) } },
      kind: "group",
      children: [stroke ? stroked(node, stroke) : node],
    };
  }

  const swap = swapIn(props.children, where);

  if (swap) {
    const value = animated(swap, keep, timing, swapping, `the text in ${where}`);
    const ticks = swapTicks(value, ctx.duration);
    const texts = textsOf(ticks);

    if (texts.length === 0)
      throw new SceneError(`${where} swaps a string track, but it never shows any text.`);

    const quiet = {
      at: undefined,
      offset: undefined,
      origin: undefined,
      rotate: undefined,
      scale: undefined,
      skew: undefined,
      opacity: undefined,
      motion: undefined,
    };

    const alone = texts.map((words) => {
      const node = text(ctx, { ...props, ...quiet, children: words }, key, timing);

      if (node.kind !== "text")
        throw new SceneError(`${where} swaps text, and ${words} didn't lower to text.`);
      const baseline = node.lines[0]?.at[1] ?? 0;
      const [x, y] = pinned(props.anchor, node.box, where, baseline);

      return { words, node, home: [x, y] as const, baseline: baseline - y };
    });

    const around = unionOf(
      alone.map(({ node, home }) => ({
        ...node.box,
        x: node.box.x - home[0],
        y: node.box.y - home[1],
      })),
    );

    const home = pinned(props.anchor, around, where, alone[0]!.baseline);
    const place = (own: Vec): Vec => [home[0] - own[0], home[1] - own[1]];

    return {
      ...base(
        ctx,
        props,
        { ...around, x: around.x + home[0], y: around.y + home[1] },
        key,
        timing,
        home,
      ),
      authored: { count: { ticks } },
      kind: "group",
      children: alone.map(({ words, node, home: own }, i) => ({
        ...shown(node, words, ticks, place(own)),
        key: `${key}/${i + 1}`,
      })),
    };
  }

  const asked = piecesOf(counted ? counted.words : props.children, own, where);
  const found = asked.map((piece) => styleOf(piece.asked));

  const borrowed = (i: number): RunLook => {
    const { text: words, asked: wanted } = asked[i]!;

    if (words.trim() !== "")
      throw new SceneError(
        `${where} draws "${words.trim()}" with no fill, so it paints nothing.`,
        "Give the <Text> a fill, as in fill={theme.text}, or the <Run> around these words one.",
      );
    const face = faceOf(wanted.font, wanted.weight, wanted.italic, where);

    const beside = [...found.slice(0, i).reverse(), ...found.slice(i + 1)].find(
      (look) => look !== undefined && look.font === face,
    );

    if (beside) return beside;

    return styleOf({ ...wanted, fill: "#00000000" })!;
  };

  const pieces = asked.map(({ text: words, asked: wanted, advances }, i) => {
    const look = found[i] ?? borrowed(i);
    const spacing = wanted.letterSpacing;

    if (spacing !== undefined && !Number.isFinite(spacing))
      throw new SceneError(`${where} needs a finite letterSpacing, got ${spacing}.`);

    if (!advances) unseen(look, words);

    return {
      text: words,
      face: look.font,
      style: look,
      ...(spacing && { spacing }),
      ...(advances && { advances }),
    };
  });

  const outline = props.along === undefined ? undefined : outlineOf(props.along);

  if (outline && props.width !== undefined)
    throw new SceneError(
      `${where} sets text along an outline, which doesn't wrap, so it takes no width.`,
      "Drop width, or drop along to wrap the text.",
    );

  if (outline && trim !== undefined)
    throw new SceneError(
      `${where} has both draw/trim and along, which can't be combined.`,
      "Drop along to draw glyph outlines, or drop draw to set text along a path.",
    );

  const reach = outline && outlineLength(outline);

  if (outline && !(reach! > 0))
    throw new SceneError(
      `The outline ${where} is set along has no length.`,
      "Give along an outline with some length, such as a line, circle(…) or path().moveTo(…).lineTo(…).",
    );

  const fitWidth = props.fit ? (props.fit.width ?? reach ?? props.width) : undefined;

  if (props.fit && fitWidth === undefined)
    throw new SceneError(
      `${where} has fit without a width to fit into.`,
      "Pass fit={{ width, maxSize, minSize, lines }} or a width prop.",
    );

  const resolvedSize = props.fit
    ? fitSizeForRuns(
        pieces,
        {
          ...props.fit,
          width: fitWidth!,
          maxSize: props.fit.maxSize ?? size,
        },
        where,
      )
    : size;

  const wrapWidth = props.width ?? (props.fit && (props.fit.lines ?? 1) > 1 ? fitWidth : undefined);

  const flat = layoutRuns(
    faceOf(props.font, props.weight, props.italic, where),
    pieces,
    {
      size: resolvedSize,
      ...(wrapWidth !== undefined && { width: wrapWidth }),
      ...(props.lineHeight !== undefined && { lineHeight: props.lineHeight }),
      ...(props.align !== undefined && { align: props.align }),
      ...(props.balance && { balance: true }),
    },
    where,
  );

  const start = animated(props.start ?? 0, keep, timing, mixNumber, `start on ${where}`);

  if (outline && flat.lines.length > 1)
    throw new SceneError(
      `${where} sets text along an outline, which takes one line, but its text has ${flat.lines.length}.`,
      "Drop the line breaks, or use one <Text along={…}> per line.",
    );

  if (outline && flat.box.width > reach! + 0.05)
    throw new SceneError(
      `The text of ${where} is ${num(flat.box.width - reach!)} longer than the outline it is set along (${num(flat.box.width)} against ${num(reach!)}).`,
      "Give it a smaller size or a longer outline.",
    );

  if (trim !== undefined && flat.lines.some((line) => line.runs.some((run) => !run.outline)))
    throw new SceneError(
      `${where} uses draw/trim, which needs TrueType glyph outlines, but its font does not expose outlines.`,
      "Load a .ttf font (not a system font or CFF .otf) when using <Text draw={…}>.",
    );

  const { lines, box, cuts } = outline
    ? setAlong(flat, outline, restOf(props.start ?? 0), props.align ?? "start")
    : flat;

  const fills = new Map<RunLook, Animated<ModelPaint>>();

  const fillOf = (look: RunLook): Animated<ModelPaint> => {
    const known = fills.get(look) ?? look.fill(box);

    fills.set(look, known);

    return known;
  };

  const stroke = props.stroke && strokeOf(ctx, props.stroke, timing, where, box);

  const drawn = strokedBox(box, stroke);
  const home = pinned(props.anchor, drawn, where, lines[0]?.at[1] ?? 0);

  return {
    ...base(ctx, props, drawn, key, timing, home),
    ...(wrapWidth !== undefined && { authored: { wrap: { width: wrapWidth, cuts } } }),
    kind: "text",
    size: resolvedSize,
    ...(fillOpacity !== undefined && fillOpacity !== 1 && { fillOpacity }),
    ...(outline && { along: { path: outline, start, align: props.align ?? "start" } }),
    ...(stroke && { stroke }),
    ...(trim !== undefined && { trim }),
    lines: lines.map((line): TextLine => ({
      at: line.at,
      runs: line.runs.map(({ text: words, at, advances, outline, style, spacing }): TextRun => ({
        text: words,
        at,
        advances,
        ...(spacing && { letterSpacing: spacing }),
        face: style.face,
        fill: fillOf(style),
        ...(style.opacity !== undefined && { opacity: style.opacity }),
        ...(outline && { outline }),
      })),
    })),
  };
};

/** A text's stroke is part of its box, as a shape's is. */
const strokedBox = (box: Box, stroke: Stroke | undefined): Box =>
  stroke
    ? growBox(
        box,
        Math.max(
          0,
          ...(isLane(stroke.width) ? stroke.width.keys.map((key) => key.value) : [stroke.width]),
        ) / 2,
      )
    : box;

const stroked = (node: SceneNode, stroke: Stroke): SceneNode =>
  node.kind === "text"
    ? { ...node, stroke }
    : node.kind === "group"
      ? { ...node, children: node.children.map((child) => stroked(child, stroke)) }
      : node;

const valuesOf = <T>(value: Anim<T>): T[] =>
  isDerived(value)
    ? []
    : isTrack(value)
      ? [
          passageOf(value).data.initial.value,
          ...passageOf(value).data.steps.map((step) => step.values.value),
        ].flatMap((given) => (given === undefined ? [] : [given]))
      : [value];

const picture = (ctx: Ctx, props: PictureProps, key: string, timing: Timing): SceneNode => {
  const { src } = props;
  const where = ctx.notes.names.named(key);
  const ratio = src.width / src.height;
  const width = props.width ?? (props.height === undefined ? src.width : props.height * ratio);
  const height = props.height ?? (props.width === undefined ? src.height : props.width / ratio);

  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
    throw new SceneError(`${where} needs a positive width and height, got ${width} by ${height}.`);

  const box = { x: 0, y: 0, width, height };
  const focus = props.focus ?? [0.5, 0.5];
  const zoom = props.zoom ?? 1;
  const fit = props.fit ?? "cover";

  for (const [fx, fy] of valuesOf(focus))
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1))
      throw new SceneError(
        `${where} has a focus of [${fx}, ${fy}], which must be fractions from 0 to 1.`,
      );

  for (const z of valuesOf(zoom))
    if (!(z > 0 && Number.isFinite(z)))
      throw new SceneError(`${where} has a zoom of ${z}, which must be above 0.`);

  const cover = (fit === "contain" ? Math.min : Math.max)(width / src.width, height / src.height);
  const [sx, sy] = fit === "fill" ? [width / src.width, height / src.height] : [cover, cover];
  const [bw, bh] = [src.width * sx, src.height * sy];
  const home = pinned(props.anchor, box, where);

  if (isTrack(zoom) || isDerived(zoom) || isTrack(focus) || isDerived(focus)) {
    const image: PictureNode = {
      key: `${key}/image`,
      box: { x: 0, y: 0, width: bw, height: bh },
      at: animated(
        together([zoom, focus]).map((z, [fx, fy]): Vec => [
          (width - bw * z) * fx,
          (height - bh * z) * fy,
        ]),
        keep,
        timing,
        mixVec,
        `focus on ${where}`,
        true,
      ),
      origin: [0, 0],
      layers: [{ ...IDLE, scale: animated(zoom, pair, timing, mixVec, `zoom on ${where}`) }],
      effects: [],
      kind: "picture",
      size: [bw, bh],
      href: src.href,
      natural: [src.width, src.height],
    };

    return {
      ...base(ctx, props, box, key, timing, home),
      kind: "group",
      authored: { frame: true },
      children: [
        {
          kind: "group",
          key: `${key}/crop`,
          box,
          at: [0, 0],
          origin: [0, 0],
          layers: [],
          effects: [],
          clip: outlineOf(rect(width, height)),
          children: [image],
        },
      ],
    };
  }

  const [fx, fy] = focus;
  const [vw, vh] = [width / (sx * zoom), height / (sy * zoom)];
  const whole = Math.abs(vw - src.width) < 1e-6 && Math.abs(vh - src.height) < 1e-6;

  return {
    ...base(ctx, props, box, key, timing, home),
    kind: "picture",
    size: [width, height],
    href: src.href,
    natural: [src.width, src.height],
    ...(!whole && { view: [(src.width - vw) * fx, (src.height - vh) * fy, vw, vh] }),
  };
};

const sceneTiming = ({ duration, reads }: Ctx): Timing => ({
  duration,
  clock: { offset: 0, end: duration, clips: [] },
  reads,
});

const label = (begin: Seconds, over: Seconds | undefined, named?: Clock): string =>
  named
    ? `<Sequence clock="${named.name}">`
    : `<Sequence when={span(${num(begin)}${over === undefined ? "" : `, ${num(over)}`})}>`;

const inside = (
  timing: Timing,
  begin: Seconds,
  over: Seconds | undefined,
  named?: Clock,
): Timing => {
  checkWindow(begin, over ?? 1, "<Sequence>");
  const parent = timing.clock;
  const start = parent.offset + begin;
  const end = over === undefined ? parent.end : start + over;
  const name = label(begin, over, named);

  if (start > parent.end + EPSILON || end > parent.end + EPSILON)
    throw new SceneError(
      `A ${name} runs until ${num(end - parent.offset)}s, past the ${num(parent.end - parent.offset)}s ${parent.clips.at(-1)?.label ?? "scene"}.`,
    );

  const mark = named && { name: named.name, start, over: named.over };

  return {
    ...timing,
    clock: {
      offset: start,
      end,
      clips: [...parent.clips, { label: name, start, end, open: over === undefined }],
      ...((mark ?? parent.named) && { named: mark ?? parent.named }),
    },
  };
};

const claimed = (ctx: Ctx, named: Clock): void => {
  const known = ctx.clocks.get(named.name);

  if (known !== undefined && known !== named)
    throw new SceneError(
      `Two clocks are both named "${named.name}".`,
      "Make the clock once with clock() and give that one value to each <Sequence>, or name them apart.",
    );

  ctx.clocks.set(named.name, named);
};

const lowerAll = (
  ctx: Ctx,
  elements: readonly SceneElement[],
  timing: Timing,
  parent: string,
  taken: Taken = new Map(),
): SceneNode[] =>
  elements.flatMap((element): SceneNode[] => {
    const given = sceneElement(element, parent ? ctx.notes.names.named(parent) : "The scene");

    if (given.type === "fragment") return lowerAll(ctx, given.children, timing, parent, taken);

    if (given.type === "sequence") {
      const within = inside(timing, given.start, given.over, given.clock);

      if (given.clock) claimed(ctx, given.clock);
      const nodes = lowerAll(ctx, given.children, within, parent, taken);
      const { named } = within.clock;

      return given.clock ? nodes.map((node) => ({ ...node, clock: node.clock ?? named! })) : nodes;
    }

    if (given.type === "morph") ownKeys(ctx, given.states, parent, taken);

    if (given.type === "morph" && given.only !== undefined) {
      const states = given.states.map((state) => {
        const names: Taken = new Map(taken);

        return {
          nodes: arrangeState(lowerAll(ctx, state, timing, parent, names), ctx.notes),
          names,
        };
      });

      for (const { names } of states) for (const [each, list] of names) taken.set(each, list);

      return states[given.only]!.nodes;
    }

    if (given.type === "group" && given.settle?.kind === "arrange") {
      const reflowed = lifted(given);

      if (reflowed) return lowerAll(ctx, [reflowed], timing, parent, taken);
    }

    if (given.type === "morph") {
      const seen = new Map<string, Anchor | undefined>();
      const states: SceneNode[][] = [];

      const merged = morphed(given, timing, taken, ctx.notes.names, (state, used) => {
        const nodes = arrangeState(lowerAll(ctx, state, timing, parent, used), ctx.notes);

        sameAnchors(nodes, ctx.notes, seen);
        states.push(nodes);

        return nodes;
      });

      noteResized(ctx.notes, merged, states);

      return merged;
    }

    const { name, full, apart, key } = claim(ctx, given, taken, parent);

    if (apart) ctx.notes.names.share(full!, key);
    const entry = nameFor(ctx, given, name, parent);

    ctx.notes.names.set(key, entry);

    try {
      return lowered(ctx, given, name, key, timing, parent);
    } catch (error) {
      throw error instanceof Error ? located(error, ctx.notes.names.whereOf(key)) : error;
    }
  });

/** Takes the element's key in its parent: as written, or told apart by its list's place, or by position when unkeyed. */
const claim = (ctx: Ctx, given: NodeElement, taken: Taken, parent: string) => {
  const name = keyOf(given);
  const list = listOf(given);
  const full = name === undefined || !parent ? name : `${parent}/${name}`;

  const earlier =
    name === undefined ? undefined : taken.has(name) ? taken.get(name) : ctx.owners.get(full!);

  // Two lists in one parent may both write a key: all but one are told apart by their list's place.
  const apart =
    list !== undefined && earlier !== undefined && earlier !== list ? `${name}~${list}` : undefined;

  if (name !== undefined && taken.has(apart ?? name))
    throw new SceneError(
      `Two nodes are both keyed "${name}"${parent && ` inside ${ctx.notes.names.named(parent)}`}.`,
      "Give each a key of its own.",
      { node: `"${name}"`, ...(writtenAt(given) && { source: writtenAt(given)! }) },
    );

  if (name?.includes("/"))
    throw new SceneError(`A key can't contain "/", got "${name}".`, "Join words with - or _.", {
      ...(writtenAt(given) && { source: writtenAt(given)! }),
    });
  let own = apart ?? name;

  for (let index = taken.size; own === undefined; index++)
    if (!taken.has(`#${index}`)) own = `#${index}`;
  taken.set(own, list);

  return { name, list, full, apart: apart !== undefined, key: parent ? `${parent}/${own}` : own };
};

/** Every list place that writes each key in these elements, by the key's full path, in the order they come. */
const claims = (
  ctx: Ctx,
  elements: readonly SceneElement[],
  parent: string,
  taken: Taken,
  into: Map<string, string[]>,
): void => {
  for (const element of elements) {
    const given = sceneElement(element, "The scene");

    if (given.type === "fragment" || given.type === "sequence") {
      claims(ctx, given.children, parent, taken, into);

      continue;
    }

    if (given.type === "morph") {
      for (const state of given.states) {
        const used: Taken = new Map(taken);

        claims(ctx, state, parent, used, into);

        for (const [each, list] of used) taken.set(each, list);
      }

      continue;
    }

    const reflowed =
      given.type === "group" && given.settle?.kind === "arrange" ? lifted(given) : undefined;

    if (reflowed) {
      claims(ctx, [reflowed], parent, taken, into);

      continue;
    }

    const { full, list, key } = claim(ctx, given, taken, parent);

    if (full !== undefined && list !== undefined) {
      const lists = into.get(full) ?? [];

      if (!lists.includes(list)) into.set(full, [...lists, list]);
    }

    if (given.type === "group") claims(ctx, given.children, key, new Map(), into);
  }
};

/**
 * Before a morph's states are lowered: when two lists write one key across them, even in different states, the first
 * list keeps it in every state, so the node of a list is named alike in each and the states pair it with itself.
 */
const ownKeys = (
  ctx: Ctx,
  states: readonly (readonly SceneElement[])[],
  parent: string,
  taken: Taken,
): void => {
  try {
    // A node told apart renames the keys under it, which can show more keys two lists share there.
    for (let pass = 0; pass < 4; pass++) {
      const into = new Map<string, string[]>();
      let more = false;

      for (const state of states) claims(ctx, state, parent, new Map(taken), into);

      for (const [full, lists] of into)
        if (lists.length > 1 && !ctx.owners.has(full)) {
          ctx.owners.set(full, lists[0]!);
          more = true;
        }

      if (!more) return;
    }
  } catch {
    // Lowering the states reports what is wrong with them, where it is written.
  }
};

const keyOf = (given: Extract<SceneElement, { readonly props: object }>): string | undefined => {
  const key = "key" in given.props ? given.props.key : undefined;

  return key === undefined ? undefined : keyText(key, writtenAt(given));
};

const lowered = (
  ctx: Ctx,
  given: NodeElement,
  name: string | undefined,
  key: string,
  timing: Timing,
  parent: string,
): SceneNode[] => {
  const el = withGoals(given, key, timing, ctx.notes, parent);
  const backdrop = el.type === "group" ? backdropOf(ctx, el.props, key, timing) : undefined;
  const { offset } = el.props;

  placement(ctx, el.props, offset, key, parent);

  if (el.props.id !== undefined) noteId(ctx.notes, el.props.id, key, writtenAt(given));
  const aim = ctx.notes.aims.has(key);
  const still = el.props.at === undefined && offset === undefined && !aim;
  const pins = (el.props.at !== undefined || aim) && offset === undefined;

  note(
    ctx.notes,
    key,
    { ...el.props, offset, still },
    el.type,
    el.type === "group" ? el.settle : undefined,
    backdrop,
    el.type === "group" ? el.points : undefined,
  );

  const aimed = (node: SceneNode): SceneNode => {
    return still && el.props.origin === "at" ? { ...node, origin: [0, 0] } : node;
  };

  const done = (node: SceneNode): SceneNode[] => [
    identified(
      given,
      name,
      dressed(ctx, el.props, sized(ctx, el.props, aimed(node)), timing),
      ctx.notes.names.entryOf(key),
      el.props.id,
    ),
  ];

  switch (el.type) {
    case "shape":
      return [shape(ctx, el.props, key, timing)].flatMap((node) => (node ? done(node) : []));
    case "text":
      return [paintedText(ctx, el.props, key, timing)].flatMap((node) => (node ? done(node) : []));
    case "picture":
      return done(picture(ctx, el.props, key, timing));
    case "group": {
      const children = lowerAll(ctx, el.children, timing, key);

      if (backdrop && children.some((child) => child.key === `${key}/background`))
        throw new SceneError(
          `A child of ${ctx.notes.names.named(key)} is keyed "background", which names the container's own fill and stroke.`,
          "Give the child another key.",
        );

      const node: GroupNode = {
        ...base(ctx, el.props, around(children), key, timing, [0, 0]),
        ...((el.layout || pins) && {
          authored: { ...(el.layout && { layout: el.layout }), ...(pins && { pinned: true }) },
        }),
        ...(el.slot !== undefined && { slot: el.slot }),
        ...(el.shader && { shader: el.shader }),
        kind: "group",
        children,
      };

      return done(node);
    }
  }
};

const placement = (
  ctx: Ctx,
  props: TextProps | Common,
  offset: Anim<Vec> | Anchor | undefined,
  key: string,
  parent: string,
): void => {
  const where = ctx.notes.names.named(key);

  if (offset !== undefined && props.at !== undefined)
    throw new SceneError(
      `${where} has both at and offset. at puts a point of its box somewhere; offset moves its own [0, 0] there.`,
      "Keep one of them.",
    );

  if (offset !== undefined && props.anchor !== undefined)
    throw new SceneError(
      `${where} has anchor=${JSON.stringify(props.anchor)} and offset, but anchor names the point at places, and offset moves its own [0, 0], not a point of its box.`,
      "Place it with at and anchor, or drop anchor.",
    );

  const contained = ctx.notes.nodes.get(parent)?.settle?.kind === "arrange";

  if (
    props.anchor !== undefined &&
    props.at === undefined &&
    !contained &&
    !ctx.notes.aims.has(key)
  )
    throw new SceneError(
      `anchor on ${where} names the point its at places, but it has no at, so it stays where its coordinates put it.`,
      `Add at, such as at={[100, 50]} anchor=${JSON.stringify(props.anchor)}, or at={box.bottom} with a ref box to pin it to another node, or drop anchor.`,
    );
};

const nameFor = (ctx: Ctx, given: NodeElement, name: string | undefined, parent: string): Named => {
  const above = parent ? ctx.notes.names.entryOf(parent) : undefined;
  const component = componentOf(given);

  if (!component && above)
    return {
      name: name === undefined ? `a part of ${above.name}` : `the ${name} of ${above.name}`,
      short: name === undefined ? above.short : `"${name}"`,
      ...(above.source && { source: above.source }),
    };
  const tag = component === undefined ? tagOf(given.type) : `<${component}>`;
  const words = given.type === "text" ? wordsOf(given.props.children).trim() : "";
  const written = writtenAt(given);

  const short = name !== undefined ? `${tag} "${name}"` : words ? `${tag} ${quoted(words)}` : tag;

  const placed =
    name === undefined && !words && above && /"/.test(above.short)
      ? `${short} in ${above.short}`
      : short;

  return { name: placed, short, ...(written && { source: written }) };
};

const lengthOf = (
  value: Anim<number>,
  timing: Timing,
  where: string,
  noun = "length",
): Animated<number> => {
  const out = animated(value, keep, timing, mixNumber, where);

  if (!isLane(out) && !(out >= 0 && Number.isFinite(out)))
    throw new SceneError(`${where} needs a finite ${noun} of 0 or more, got ${out}.`);

  return out;
};

const embossOf = (
  ctx: Ctx,
  effect: Extract<EffectProps, { kind: "emboss" }>,
  where: string,
): Effect => {
  const { azimuth, elevation, depth, radius, specular } = effect;

  const check = (value: number, name: string, ok: boolean, range: string) => {
    if (!(ok && Number.isFinite(value)))
      throw new SceneError(
        `emboss ${name} on ${where} needs ${range}, got ${value}.`,
        "emboss() takes plain numbers: emboss({ light: { azimuth: 225, elevation: 45 }, depth: 3 }).",
      );
  };

  check(azimuth, "light azimuth", isNumber(azimuth), "a number of degrees");
  check(
    elevation,
    "light elevation",
    elevation > 0 && elevation <= 90,
    "degrees above 0 and up to 90",
  );
  check(depth, "depth", depth >= 0, "a number of 0 or more");
  check(radius, "radius", radius >= 0, "a number of 0 or more");
  check(specular, "specular", specular >= 0, "a number of 0 or more");

  return {
    kind: "emboss",
    azimuth,
    elevation,
    depth,
    radius,
    specular,
    color: solidOf(ctx, effect.color, `emboss on ${where}`),
  };
};

const effectOf = (ctx: Ctx, effect: EffectProps, timing: Timing, where: string): Effect => {
  if (effect.kind === "blur")
    return { kind: "blur", radius: lengthOf(effect.radius, timing, `blur on ${where}`) };

  if (effect.kind === "adjust") {
    const hue = animated(effect.hue, keep, timing, mixNumber, `adjust hue on ${where}`);

    if (!isLane(hue) && !Number.isFinite(hue))
      throw new SceneError(`adjust hue on ${where} needs a finite number of degrees, got ${hue}.`);

    const amount = (value: Anim<number>, name: string) =>
      lengthOf(value, timing, `adjust ${name} on ${where}`, "number");

    return {
      kind: "adjust",
      saturate: amount(effect.saturate, "saturate"),
      hue,
      brightness: amount(effect.brightness, "brightness"),
      contrast: amount(effect.contrast, "contrast"),
    };
  }

  if (effect.kind === "displace") {
    const { seed, octaves } = effect;

    if (!Number.isInteger(seed))
      throw new SceneError(`displace seed on ${where} needs a whole number, got ${seed}.`);

    if (!Number.isInteger(octaves) || octaves < 1)
      throw new SceneError(
        `displace octaves on ${where} needs a whole number of 1 or more, got ${octaves}.`,
      );

    return {
      kind: "displace",
      scale: lengthOf(effect.scale, timing, `displace scale on ${where}`),
      frequency: lengthOf(effect.frequency, timing, `displace frequency on ${where}`, "number"),
      seed,
      octaves,
    };
  }

  if (effect.kind === "emboss") return embossOf(ctx, effect, where);

  if (effect.kind !== "shadow")
    throw new SceneError(
      `effects on ${where} takes blur(), shadow(), adjust(), displace() and emboss(), got ${JSON.stringify(effect)}.`,
    );
  const opacity = animated(effect.opacity, keep, timing, mixNumber, `shadow opacity on ${where}`);

  if (!isLane(opacity) && !(opacity >= 0 && opacity <= 1))
    throw new SceneError(`shadow opacity on ${where} needs a number from 0 to 1, got ${opacity}.`);

  return {
    kind: "shadow",
    offset: animated<Vec, Vec>(effect.offset, keep, timing, mixVec, `shadow offset on ${where}`),
    blur: lengthOf(effect.blur, timing, `shadow blur on ${where}`),
    color: animated<Hex | Token, Color>(
      effect.color,
      (value) => solidOf(ctx, value, `shadow on ${where}`),
      timing,
      noMix,
      `shadow color on ${where}`,
    ),
    opacity,
  };
};

const groupOf = (
  ctx: Ctx,
  content: Child,
  root: string,
  owner: string,
  timing: Timing,
): GroupNode | undefined => {
  const elements = flat(content);

  if (elements.length === 0) return undefined;
  const children = arrangeState(lowerAll(ctx, elements, timing, root), ctx.notes);

  for (const child of children) {
    const placed = outsider(child, ctx.notes);

    if (placed !== undefined)
      throw new SceneError(
        `${ctx.notes.names.named(placed)} is in ${owner} and is placed by an anchor, a track going to an anchor, or as an arrow's end. What is drawn there is never part of the layout.`,
        "Place what is in it with at.",
        ctx.notes.names.whereOf(placed),
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

const dressed = (
  ctx: Ctx,
  props: Omit<Common, "anchor">,
  node: SceneNode,
  timing: Timing,
): SceneNode => {
  const where = ctx.notes.names.named(node.key);
  const own = boundsOf(node.box);
  const { effects = [], blend, scheme } = props;

  if (scheme !== undefined && scheme !== "light" && scheme !== "dark")
    throw new SceneError(
      `${where} has scheme ${JSON.stringify(scheme)}, but a scheme is "light" or "dark".`,
      'Write scheme="light" or scheme="dark", or leave it out to show it in both.',
    );
  const clip = byBox(props.clip) ? props.clip(own) : props.clip;
  const asked = byBox(props.mask) ? props.mask(own) : props.mask;

  const mask =
    asked === undefined
      ? undefined
      : groupOf(
          ctx,
          asked,
          `${node.key}#mask`,
          `the mask of ${ctx.notes.names.named(node.key)}`,
          timing,
        );

  return {
    ...node,
    ...(clip !== undefined && { clip: geometryOf(clip, timing, where, "clip") }),
    ...(mask && { mask }),
    effects: [...node.effects, ...effects.map((effect) => effectOf(ctx, effect, timing, where))],
    ...(blend !== undefined && blend !== "normal" && { blend }),
    ...(scheme !== undefined && { scheme }),
  };
};

const boundsOf = (box: Box): Bounds => {
  const { x, y, width, height } = box;

  return {
    x,
    y,
    width,
    height,
    size: [width, height],
    center: [x + width / 2, y + height / 2],
    rect:
      x === 0 && y === 0
        ? rect(width, height)
        : polygon([x, y], [x + width, y], [x + width, y + height], [x, y + height]),
  };
};

const byBox = <T>(value: T | ((own: Bounds) => T)): value is (own: Bounds) => T =>
  value instanceof Function;

const sized = (ctx: Ctx, props: Omit<Common, "anchor">, node: SceneNode): SceneNode => {
  const what = byBox(props.clip) ? "clip" : byBox(props.mask) ? "mask" : undefined;

  if (node.kind !== "group" || what === undefined) return node;

  for (const child of node.children) {
    const placed = outsider(child, ctx.notes);

    if (placed !== undefined)
      throw new SceneError(
        `The ${what} of ${ctx.notes.names.named(node.key)} is sized by its box, but ${ctx.notes.names.named(placed)} inside it is placed by an anchor, a track going to an anchor, or as an arrow's end, so its box isn't known yet.`,
        `Size the ${what} with numbers, or move that node out.`,
      );
  }

  return arrangeState([node], ctx.notes)[0]!;
};

const backdropOf = (
  ctx: Ctx,
  { fill, stroke, radius }: Backdrop,
  key: string,
  timing: Timing,
): BackdropOf | undefined => {
  const painted = (paints: Paints | undefined) =>
    paints !== undefined && layersOfPaints(paints).length > 0;

  if (!painted(fill) && !painted(stroke?.color)) return undefined;
  const line = stroke === undefined ? 0 : restOf(stroke.width ?? 1);

  return (box) => ({
    ...shape(
      ctx,
      {
        geometry: rect(
          Math.max(0, box.width - line),
          Math.max(0, box.height - line),
          radius === undefined ? {} : { radius },
        ),
        at: [box.x, box.y],
        ...(fill !== undefined && { fill }),
        ...(stroke && { stroke }),
      },
      `${key}/background`,
      timing,
    )!,
    authored: { backdrop: true },
  });
};

const morphsIn = (el: SceneElement): MorphElement[] =>
  el.type === "morph"
    ? el.only === undefined
      ? [el]
      : []
    : el.type === "group" || el.type === "fragment"
      ? el.children.flatMap(morphsIn)
      : [];

const alike = (a: MorphElement, b: MorphElement): boolean =>
  a.states.length === b.states.length &&
  same(
    a.spans.map(({ start, over }) => [start, over]),
    b.spans.map(({ start, over }) => [start, over]),
  ) &&
  same(a.options.curve ?? null, b.options.curve ?? null) &&
  a.options.stagger === b.options.stagger &&
  a.options.each === b.options.each &&
  same(a.options.enter ?? null, b.options.enter ?? null) &&
  same(a.options.exit ?? null, b.options.exit ?? null);

const lifted = (container: SceneElement & { readonly type: "group" }): MorphElement | undefined => {
  const found = container.children.flatMap(morphsIn);
  const [first] = found;

  if (!first) return undefined;
  const label = container.settle?.label ?? "container";

  if (found.some((other) => !alike(other, first)))
    throw new SceneError(
      `A ${label} holds morphs on different spans or with different options, and it reflows with one morph at a time.`,
      `Give them the same states count, spans and options, or put each in a ${label} of its own.`,
      { node: label, ...(writtenAt(container) && { source: writtenAt(container)! }) },
    );

  const pinned = (s: number) => {
    const swap = (el: SceneElement): SceneElement =>
      el.type === "morph" && found.includes(el)
        ? { ...el, only: s }
        : el.type === "group" || el.type === "fragment"
          ? sourced(el, { ...el, children: el.children.map(swap) })
          : el;

    return [swap(container)];
  };

  return {
    type: "morph",
    states: first.states.map((_, s) => pinned(s)),
    spans: first.spans,
    options: first.options,
  };
};

/** Each <Slot> has a name of its own, so the page finds one box by it. */
const checkSlots = (root: GroupNode): void => {
  const seen = new Set<string>();

  const visit = (node: SceneNode): void => {
    if (node.slot !== undefined && seen.has(node.slot))
      throw new SceneError(
        `Two <Slot>s are both named "${node.slot}".`,
        "Give each slot a name of its own.",
      );

    if (node.slot !== undefined) seen.add(node.slot);

    if (node.kind === "group") node.children.forEach(visit);
  };

  visit(root);
};

const isBare = (el: SceneElement): boolean =>
  el.type === "fragment" ||
  (el.type === "group" && Object.keys(el.props).length === 0 && el.settle === undefined);

/**
 * A scene is its options and a function from the canvas to the picture. The canvas is the only thing a scene is told:
 * a component that needs its size takes it as a prop.
 */
export const scene = (options: SceneOptions, build: (canvas: Bounds) => SceneElement): Scene => {
  const names = new Names();

  return names.naming(() => lowerScene(options, build, names));
};

const lowerScene = (
  options: SceneOptions,
  build: (canvas: Bounds) => SceneElement,
  names: Names,
): Scene => {
  const { size } = options;

  if (options.title === undefined)
    throw new SceneError(
      "scene() needs a title.",
      'Pass title, as in scene({ size: [800, 600], title: "Orbits" }, ...).',
    );

  if (!size.every((side) => side > 0 && side < Infinity))
    throw new SceneError(
      `scene() needs a positive width and height, got ${size[0]} by ${size[1]}.`,
    );

  if (options.still !== undefined && options.still !== false && !Number.isFinite(options.still))
    throw new SceneError(
      `scene() needs still as a time in seconds, or false, got ${String(options.still)}.`,
    );

  const top = sceneElement(
    expand(build(boundsOf({ x: 0, y: 0, width: size[0], height: size[1] }))),
    "scene()'s callback",
  );

  const duration = options.duration ?? rootLength(top);

  if (duration === undefined)
    throw new SceneError(
      "scene() needs a duration, or a root that has a length.",
      "Pass duration, or put <Sequence when={span(0, n)}> at the root.",
    );

  if (!(duration > 0 && duration < Infinity))
    throw new SceneError(`scene() needs a positive duration, got ${duration}.`);

  for (const [name, time] of Object.entries(options.markers ?? {}))
    if (!(Number.isFinite(time) && time >= 0 && time <= duration))
      throw new SceneError(
        `scene() needs the marker "${name}" at a time from 0 to the duration, ${duration}s, got ${String(time)}.`,
        "Put each marker inside the scene, as in markers: { handoff: 4.5 }.",
      );

  const ctx: Ctx = {
    tokens: new Map(),
    fonts: new FontBook(),
    size,
    duration,
    notes: notes(names),
    patterns: new Map(),
    reads: new Map(),
    clocks: new Map(),
    owners: new Map(),
  };

  for (const token of Object.values(options.theme ?? {})) solidOf(ctx, token, "scene()");

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

  const root = settle(drafted, ctx.notes, duration);

  checkSlots(root);

  const still =
    options.still === false
      ? undefined
      : Math.max(0, Math.min(duration, options.still ?? duration * 0.85));

  return {
    size,
    duration,
    title: options.title,
    ...(options.desc !== undefined && { desc: options.desc }),
    loop: options.loop ?? true,
    ...(still !== undefined && { still }),
    ...(options.markers && Object.keys(options.markers).length > 0 && { markers: options.markers }),
    tokens: Object.fromEntries(ctx.tokens),
    fonts: ctx.fonts.families(),
    root,
  };
};
