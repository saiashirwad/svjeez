import type { Font } from "../font/font";
import { num } from "../model/format";
import { EPSILON, type Seconds } from "../model/time";
import { checkWindow } from "./span";
import {
  lengthOf as outlineLength,
  growBox,
  matched,
  mixGeometry,
  outlineBoxOf,
} from "../model/geometry";
import { componentOf, identified, sourced, writtenAt } from "./identity";
import { Names, quoted, wordsOf, type Named } from "./names";
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
import { morphed, type MorphElement } from "./morph";
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
import { minus, pinned } from "./pin";
import { layoutRuns, setAlong } from "./text";
import { countedNodes, countingIn, rateOf, ticksOf } from "./count";
import { typedNodes, typedTicks, typing as typingMix, typingIn } from "./typed";
import {
  blendable,
  gradientOf,
  isWrittenGradient,
  isWrittenPattern,
  mixPaint,
  type Pattern,
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
  readonly duration: Seconds;
  readonly title: string;
  readonly desc?: string;
  readonly theme?: Theme;
  readonly loop?: boolean;
  /**
   * The moment shown, held still, to viewers who ask for reduced motion: a time in seconds (85% of the duration if
   * left out), or false to play the motion for them too.
   */
  readonly still?: Seconds | false;
}

interface Ctx {
  readonly tokens: Map<string, TokenValue>;
  readonly fonts: FontBook;
  readonly size: Vec;
  readonly duration: Seconds;
  readonly notes: Notes;
  readonly patterns: Map<Pattern, ModelPattern>;
  readonly reads: Map<object, Reading>;
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
  const data = mapped(readOf(value, timing, where).data, "value", (given) => change(given as A));

  return laneOf(data, data.initial.value!, timing, mix, where, curves);
};

const colorOf = (ctx: Ctx, paint: Paint, where: string, timing: Timing, box?: Box): ModelPaint => {
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
  const tile = groupOf(ctx, given.tile, root, `a pattern painting ${where}`, timing);

  if (tile === undefined)
    throw new SceneError(
      `The pattern painting ${where} has nothing to draw.`,
      "Give pattern() a tile, as in tile: <Shape geometry={circle(3)} fill={theme.ink} />.",
    );

  const made: ModelPattern = {
    kind: "pattern",
    size: given.size,
    offset: animated<Vec, Vec>(given.offset, keep, timing, mixVec, `pattern offset on ${where}`),
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
    at: isAnchor(props.at)
      ? NOWHERE
      : animated<Vec, Vec>(
          props.at ?? home,
          (point) => minus(point, home),
          timing,
          mixVec,
          `at on ${where}`,
          true,
        ),
    origin: originOf(ctx.notes.names, props.origin, box, key, () => home),
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

const shape = (ctx: Ctx, props: ShapeProps, key: string, timing: Timing): ShapeNode => {
  const where = ctx.notes.names.named(key);

  if (props.geometry === undefined)
    throw new SceneError(
      `${where} has no geometry.`,
      "Give it one, such as geometry={rect(40, 20)}.",
    );

  if (props.fill === undefined && props.stroke === undefined)
    throw new SceneError(
      `${where} paints nothing: it has no fill and no stroke.`,
      "Give it a fill, as in fill={theme.text}, or a stroke, as in stroke={{ color: theme.text }}.",
    );
  const geometry = geometryOf(props.geometry, timing, where);
  const rest = atRest(geometry);
  const outline = outlineBoxOf(rest);
  const paint = (value: Paint) => colorOf(ctx, value, where, timing, outline);
  const { stroke: written } = props;

  const painted = (value: Anim<Paint>, what: string) =>
    blendable(
      animated(value, paint, timing, mixPaint, `${what} on ${where}`),
      `${what} on ${where}`,
    );

  const stroke = written && strokeOf(ctx, written, timing, where, outline);

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

  if (stroke?.dashOffset !== undefined && trim !== undefined)
    throw new SceneError(
      `${where} has both a draw or trim and a stroke dashOffset, and both drive the dash.`,
      "Pick one: animate draw to draw the stroke on, or dashOffset to march its dashes.",
    );

  const box = paintedBoxOf(rest, lookOf({ stroke, trim }));

  return {
    ...base(ctx, props, box, key, timing, pinned(props.anchor, box, where)),
    kind: "shape",
    geometry,
    ...(props.fill !== undefined && { fill: painted(props.fill, "fill") }),
    ...(stroke && { stroke }),
    ...(trim !== undefined && { trim }),
  };
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

  return {
    color: blendable(
      animated(
        written.color,
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

const text = (ctx: Ctx, props: TextProps, key: string, timing: Timing): SceneNode => {
  const where = ctx.notes.names.named(key);
  const { size } = props;

  if (!(size > 0 && Number.isFinite(size)))
    throw new SceneError(
      `${where} needs a size above 0, got ${size}.`,
      "To grow text in from nothing, scale it in with motion={enter(…, { from: { scale: 0 } })}.",
    );
  const counting = countingIn(props.children, where);

  const own: Asked = {
    font: props.font,
    fill: props.fill,
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

    // Supplied advances mean the browser already laid the run out, fallback fonts included.
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

  const flat = layoutRuns(
    faceOf(props.font, props.weight, props.italic, where),
    pieces,
    {
      size,
      ...(props.width !== undefined && { width: props.width }),
      ...(props.lineHeight !== undefined && { lineHeight: props.lineHeight }),
      ...(props.align !== undefined && { align: props.align }),
    },
    where,
  );

  const start = animated(props.start ?? 0, keep, timing, mixNumber, `start on ${where}`);
  const reach = outline && outlineLength(outline);

  if (outline && !(reach! > 0))
    throw new SceneError(
      `The outline ${where} is set along has no length.`,
      "Give along an outline with some length, such as a line, circle(…) or path().moveTo(…).lineTo(…).",
    );

  if (outline && flat.lines.length > 1)
    throw new SceneError(
      `${where} sets text along an outline, which takes one line, but its text has ${flat.lines.length}.`,
      "Drop the line breaks, or use one <Text along={…}> per line.",
    );

  if (outline && flat.box.width > reach!)
    throw new SceneError(
      `The text of ${where} is ${num(flat.box.width - reach!)} longer than the outline it is set along (${num(flat.box.width)} against ${num(reach!)}).`,
      "Give it a smaller size or a longer outline.",
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
    ...(props.width !== undefined && { authored: { wrap: { width: props.width, cuts } } }),
    kind: "text",
    size,
    ...(outline && { along: { path: outline, start, align: props.align ?? "start" } }),
    ...(stroke && { stroke }),
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

const label = (begin: Seconds, over: Seconds | undefined): string =>
  `<Sequence when={span(${num(begin)}${over === undefined ? "" : `, ${num(over)}`})}>`;

const inside = (timing: Timing, begin: Seconds, over: Seconds | undefined): Timing => {
  checkWindow(begin, over ?? 1, "<Sequence>");
  const parent = timing.clock;
  const start = parent.offset + begin;
  const end = over === undefined ? parent.end : start + over;
  const name = label(begin, over);

  if (start > parent.end + EPSILON || end > parent.end + EPSILON)
    throw new SceneError(
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
    const given = sceneElement(element, parent ? ctx.notes.names.named(parent) : "The scene");

    if (given.type === "fragment") return lowerAll(ctx, given.children, timing, parent, taken);

    if (given.type === "sequence") {
      return lowerAll(ctx, given.children, inside(timing, given.start, given.over), parent, taken);
    }

    if (given.type === "morph" && given.only !== undefined) {
      const states = given.states.map((state) => {
        const names = new Set(taken);

        return {
          nodes: arrangeState(lowerAll(ctx, state, timing, parent, names), ctx.notes),
          names,
        };
      });

      for (const { names } of states) for (const each of names) taken.add(each);

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

    const name = given.props.key;

    if (name !== undefined && taken.has(name))
      throw new SceneError(
        `Two nodes are both keyed "${name}"${parent && ` inside ${ctx.notes.names.named(parent)}`}.`,
        "Give each a key of its own.",
        { node: `"${name}"`, ...(writtenAt(given) && { source: writtenAt(given)! }) },
      );

    if (name?.includes("/"))
      throw new SceneError(`A key can't contain "/", got "${name}".`, "Join words with - or _.", {
        ...(writtenAt(given) && { source: writtenAt(given)! }),
      });
    let own = name;

    for (let index = taken.size; own === undefined; index++)
      if (!taken.has(String(index))) own = String(index);
    taken.add(own);
    const key = parent ? `${parent}/${own}` : own;
    const entry = nameFor(ctx, given, name, parent);

    ctx.notes.names.set(key, entry);

    try {
      return lowered(ctx, given, name, key, timing, parent);
    } catch (error) {
      throw error instanceof Error ? located(error, ctx.notes.names.whereOf(key)) : error;
    }
  });

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
  const offset = el.type === "group" ? el.props.offset : undefined;

  placement(ctx, el.props, offset, key, parent);

  if (el.props.id !== undefined) noteId(ctx.notes, el.props.id, key, writtenAt(given));
  const still = el.props.at === undefined && offset === undefined && !ctx.notes.aims.has(key);

  note(
    ctx.notes,
    key,
    { ...el.props, offset, still },
    el.type,
    el.type === "group" ? el.settle : undefined,
    backdrop,
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
      return done(shape(ctx, el.props, key, timing));
    case "text":
      return done(text(ctx, el.props, key, timing));
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
        ...base(
          ctx,
          offset === undefined ? el.props : { ...el.props, at: offset },
          around(children),
          key,
          timing,
          [0, 0],
        ),
        ...(el.layout && { authored: { layout: el.layout } }),
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
      `${where} has both at and offset. at places a point of its box; offset places its children's [0, 0].`,
      "Keep one of them.",
    );

  if (offset !== undefined && props.anchor !== undefined)
    throw new SceneError(
      `${where} has anchor=${JSON.stringify(props.anchor)} and offset, but anchor names the point at places, and offset places its children's [0, 0], not a point of its box.`,
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
      "Give it an at, or drop anchor.",
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

  if (effect.kind !== "shadow")
    throw new SceneError(
      `effects on ${where} takes blur(), shadow(), adjust() and displace(), got ${JSON.stringify(effect)}.`,
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
    effects: effects.map((effect) => effectOf(ctx, effect, timing, where)),
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
  if (fill === undefined && stroke === undefined) return undefined;
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
    ),
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
  const { size, duration } = options;

  if (!size.every((side) => side > 0 && side < Infinity))
    throw new SceneError(
      `scene() needs a positive width and height, got ${size[0]} by ${size[1]}.`,
    );

  if (!(duration > 0 && duration < Infinity))
    throw new SceneError(`scene() needs a positive duration, got ${duration}.`);

  if (options.still !== undefined && options.still !== false && !Number.isFinite(options.still))
    throw new SceneError(
      `scene() needs still as a time in seconds, or false, got ${String(options.still)}.`,
    );

  const top = sceneElement(
    build(boundsOf({ x: 0, y: 0, width: size[0], height: size[1] })),
    "scene()'s callback",
  );

  const ctx: Ctx = {
    tokens: new Map(),
    fonts: new FontBook(),
    size,
    duration,
    notes: notes(names),
    patterns: new Map(),
    reads: new Map(),
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
    tokens: Object.fromEntries(ctx.tokens),
    fonts: ctx.fonts.families(),
    root,
  };
};
