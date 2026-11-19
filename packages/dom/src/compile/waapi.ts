import { span, track, type Anim, type Curve, type Track } from "svjeez";
import type { Hex } from "svjeez/tools";
import { isThemed, type Animation, type ElementNode, type Keyframe, type Rect } from "../schema.ts";
import { byte, type Context } from "./context.ts";
import { curveOf, easedAt, parseEasing, reversed, windowOf, type Easing } from "./easing.ts";
import { IDENTITY, decompose, multiply } from "./transform.ts";
import type { Matrix } from "../schema.ts";
import { isElement, type Paired } from "./pair.ts";

type Vec = readonly [number, number];

/** What the animations on one element drive, as core props for the element's `@track` group. */
export interface Motion {
  /** Absolute: the matrix of the element's transform, which replaces the static one. */
  readonly transform?: {
    readonly offset: Anim<Vec>;
    readonly rotate: Anim<number>;
    readonly scale: Anim<Vec>;
    readonly skew: Anim<number>;
  };
  /** Replaces the element's static opacity. */
  readonly opacity?: Anim<number>;
  /** Replaces the element's static background color. */
  readonly fill?: Anim<Hex>;
}

/** Why a value of an animation cannot be drawn. */
class Reason {
  constructor(readonly why: string) {}
}

const DEGREES = 180 / Math.PI;

/** The most steps one property is unrolled to, so a fast animation on a long scene stays a scene. */
const MAX_STEPS = 4000;

// ----------------------------------------------------------------------------- values

/** A transform as its parts. `rotate` winds: 360 is a full turn, where the matrix alone would say 0. */
interface Pose {
  readonly translate: Vec;
  readonly rotate: number;
  readonly scale: Vec;
  readonly skew: number;
}

type Rgba = readonly [number, number, number, number];

const LINEAR: Easing = { kind: "linear" };

const CLEAR: Rgba = [0, 0, 0, 0];

const REST: Pose = { translate: [0, 0], rotate: 0, scale: [1, 1], skew: 0 };

const mixNumber = (a: number, b: number, u: number): number => a + (b - a) * u;

const mixPose = (a: Pose, b: Pose, u: number): Pose => ({
  translate: [
    mixNumber(a.translate[0], b.translate[0], u),
    mixNumber(a.translate[1], b.translate[1], u),
  ],
  rotate: mixNumber(a.rotate, b.rotate, u),
  scale: [mixNumber(a.scale[0], b.scale[0], u), mixNumber(a.scale[1], b.scale[1], u)],
  skew: mixNumber(a.skew, b.skew, u),
});

const mixRgba = (a: Rgba, b: Rgba, u: number): Rgba => [
  mixNumber(a[0], b[0], u),
  mixNumber(a[1], b[1], u),
  mixNumber(a[2], b[2], u),
  mixNumber(a[3], b[3], u),
];

const hexOf = ([r, g, b, a]: Rgba): Hex => {
  const alpha = Math.max(0, Math.min(1, a));

  return `#${byte(r)}${byte(g)}${byte(b)}${alpha >= 1 ? "" : byte(alpha * 255)}`;
};

const rgbaOfHex = (hex: string): Rgba => {
  const at = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);

  return [at(1), at(3), at(5), hex.length > 7 ? at(7) / 255 : 1];
};

const rgbaOf = (css: string): Rgba | undefined => {
  const text = css.trim().toLowerCase();

  if (text === "transparent") return [0, 0, 0, 0];

  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1];

  if (hex && (hex.length === 3 || hex.length === 4))
    return rgbaOfHex(`#${[...hex].map((c) => c + c).join("")}`);

  if (hex && (hex.length === 6 || hex.length === 8)) return rgbaOfHex(`#${hex}`);

  const parts = /^rgba?\((.+)\)$/
    .exec(text)?.[1]
    ?.split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);

  const [r, g, b, a = 1] = parts ?? [];

  return r === undefined || g === undefined || b === undefined || [r, g, b, a].some(Number.isNaN)
    ? undefined
    : [r, g, b, a];
};

/** `10px`, `50%` of `basis`, or a bare 0. */
const lengthOf = (token: string, basis: number): number | undefined => {
  const match = /^(-?\d*\.?\d+(?:e-?\d+)?)(px|%)?$/i.exec(token);

  if (!match) return undefined;

  const value = Number(match[1]);

  if (match[2] === "%") return (value / 100) * basis;

  return match[2] === "px" || value === 0 ? value : undefined;
};

/** `45deg`, `0.5turn`, `1rad`, `100grad`, or a bare 0, in degrees. */
const angleOf = (token: string): number | undefined => {
  const match = /^(-?\d*\.?\d+(?:e-?\d+)?)(deg|rad|grad|turn)?$/i.exec(token);

  if (!match) return undefined;

  const value = Number(match[1]);

  switch (match[2]?.toLowerCase()) {
    case "deg":
      return value;
    case "rad":
      return value * DEGREES;
    case "grad":
      return value * 0.9;
    case "turn":
      return value * 360;
    default:
      return value === 0 ? 0 : undefined;
  }
};

const numberOf = (token: string): number | undefined => {
  const value = Number(token);

  return token !== "" && Number.isFinite(value) ? value : undefined;
};

const tan = (degrees: number): number => Math.tan(degrees / DEGREES);

interface Parsed {
  readonly matrix: Matrix;
  /** The angle the rotate() functions in it add up to, which the matrix cannot tell from a turn more or less. */
  readonly turns: number | undefined;
}

const NONE: Parsed = { matrix: IDENTITY, turns: undefined };

/** A CSS `transform` value as one matrix; a reason when part of it is not drawn. */
const transformOf = (text: string, rect: Rect): Parsed | Reason => {
  const source = text.trim();

  if (source === "none" || source === "") return NONE;

  let matrix: Matrix = IDENTITY;
  let turns: number | undefined;
  let rest = source;

  for (const [whole, rawName = "", rawArgs = ""] of source.matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g)) {
    const name = rawName.toLowerCase();
    const args = rawArgs.split(/[\s,]+/).filter(Boolean);
    const [p, q] = args;
    let next: Matrix | undefined;

    const px = (token: string | undefined, basis: number) =>
      token === undefined ? undefined : lengthOf(token, basis);

    switch (name) {
      case "matrix": {
        const [a, b, c, d, e, f] = args.map(numberOf);

        next =
          args.length === 6 && [a, b, c, d, e, f].every((value) => value !== undefined)
            ? [a!, b!, c!, d!, e!, f!]
            : undefined;
        break;
      }

      case "translate": {
        const [x, y] = [px(p, rect.width), q === undefined ? 0 : px(q, rect.height)];

        next = x === undefined || y === undefined ? undefined : [1, 0, 0, 1, x, y];
        break;
      }

      case "translatex": {
        const x = px(p, rect.width);

        next = x === undefined ? undefined : [1, 0, 0, 1, x, 0];
        break;
      }

      case "translatey": {
        const y = px(p, rect.height);

        next = y === undefined ? undefined : [1, 0, 0, 1, 0, y];
        break;
      }

      case "scale": {
        const [x, y] = [
          p === undefined ? undefined : numberOf(p),
          q === undefined ? undefined : numberOf(q),
        ];

        next = x === undefined ? undefined : [x, 0, 0, q === undefined ? x : (y ?? NaN), 0, 0];
        break;
      }

      case "scalex": {
        const x = p === undefined ? undefined : numberOf(p);

        next = x === undefined ? undefined : [x, 0, 0, 1, 0, 0];
        break;
      }

      case "scaley": {
        const y = p === undefined ? undefined : numberOf(p);

        next = y === undefined ? undefined : [1, 0, 0, y, 0, 0];
        break;
      }

      case "rotate":
      case "rotatez": {
        const degrees = p === undefined ? undefined : angleOf(p);

        if (degrees !== undefined) {
          const r = degrees / DEGREES;

          turns = (turns ?? 0) + degrees;
          next = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
        }

        break;
      }

      case "skew": {
        const [x, y] = [p === undefined ? undefined : angleOf(p), q === undefined ? 0 : angleOf(q)];

        next = x === undefined || y === undefined ? undefined : [1, tan(y), tan(x), 1, 0, 0];
        break;
      }

      case "skewx": {
        const x = p === undefined ? undefined : angleOf(p);

        next = x === undefined ? undefined : [1, 0, tan(x), 1, 0, 0];
        break;
      }

      case "skewy": {
        const y = p === undefined ? undefined : angleOf(p);

        next = y === undefined ? undefined : [1, tan(y), 0, 1, 0, 0];
        break;
      }

      default:
        return new Reason(`the transform function ${rawName}() is not compiled`);
    }

    if (!next || next.some(Number.isNaN))
      return new Reason(
        `the transform "${whole}" could not be read (only px, %, deg, rad, turn and unitless numbers are)`,
      );

    matrix = multiply(matrix, next);
    rest = rest.replace(whole, "");
  }

  return rest.trim() === ""
    ? { matrix, turns }
    : new Reason(`the transform "${source}" could not be read`);
};

/** The pose of one keyframe: `translate`, `rotate`, `scale`, then `transform`, as CSS composes them. */
const poseOf = (props: Readonly<Record<string, string>>, rect: Rect): Parsed | Reason => {
  let matrix: Matrix = IDENTITY;
  let turns: number | undefined;

  const { translate, rotate, scale, transform } = props;

  if (translate && translate !== "none") {
    const [x, y = "0px"] = translate.trim().split(/\s+/);
    const [dx, dy] = [lengthOf(x!, rect.width), lengthOf(y, rect.height)];

    if (dx === undefined || dy === undefined)
      return new Reason(`the translate "${translate}" could not be read`);
    matrix = multiply(matrix, [1, 0, 0, 1, dx, dy]);
  }

  if (rotate && rotate !== "none") {
    const degrees = angleOf(rotate.trim());

    if (degrees === undefined) return new Reason(`the rotate "${rotate}" could not be read`);
    const r = degrees / DEGREES;

    turns = degrees;
    matrix = multiply(matrix, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
  }

  if (scale && scale !== "none") {
    const [x, y = x] = scale.trim().split(/\s+/).map(numberOf);

    if (x === undefined || y === undefined)
      return new Reason(`the scale "${scale}" could not be read`);
    matrix = multiply(matrix, [x, 0, 0, y, 0, 0]);
  }

  if (transform !== undefined) {
    const parsed = transformOf(transform, rect);

    if (parsed instanceof Reason) return parsed;
    matrix = multiply(matrix, parsed.matrix);

    if (parsed.turns !== undefined) turns = (turns ?? 0) + parsed.turns;
  }

  return { matrix, turns };
};

/** Pulls a decomposed angle to the whole number of turns nearest `near`, so a spin keeps spinning. */
const wound = (angle: number, near: number): number =>
  angle + 360 * Math.round((near - angle) / 360);

// ----------------------------------------------------------------------------- timeline

interface Stop<T> {
  readonly offset: number;
  readonly value: T;
  readonly easing: Easing;
}

/** One stretch of motion in the animation's own time: from one value to the next over `from` to `to` seconds. */
interface Piece<T> {
  readonly from: number;
  readonly to: number;
  readonly start: T;
  readonly end: T;
  readonly easing: Easing;
}

/** What the scene does to one value: `over` 0 is a cut to `to`. */
interface Move<T> {
  /** A curve of its own, where `easing` (a CSS timing function) is not what draws it. */
  readonly curve?: Curve;
  readonly at: number;
  readonly over: number;
  readonly from: T;
  readonly to: T;
  readonly easing: Easing;
}

interface Timing {
  /** One iteration, in seconds. */
  readonly length: number;
  readonly delay: number;
  readonly rate: number;
  /** The animation's own clock at scene time 0. */
  readonly now: number;
  readonly count: number;
  readonly direction: Animation["direction"];
  /** Whether the first keyframe shows before the animation starts, and the last after it ends. */
  readonly fillsBefore: boolean;
  readonly fillsAfter: boolean;
  /** The timing function of the whole effect, which a transition keeps there. */
  readonly easing: Easing;
}

interface Plan<T> {
  readonly initial: T;
  readonly moves: readonly Move<T>[];
  readonly period?: number;
}

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

const piecesOf = <T>(stops: readonly Stop<T>[], timing: Timing, i: number): Piece<T>[] => {
  const { length, direction } = timing;

  const back =
    direction === "reverse" ||
    (direction === "alternate" && i % 2 === 1) ||
    (direction === "alternate-reverse" && i % 2 === 0);

  const out = stops.slice(0, -1).map((stop, j): Piece<T> => {
    const next = stops[j + 1]!;

    const easing =
      stops.length === 2 && stop.easing.kind === "linear" ? timing.easing : stop.easing;

    return back
      ? {
          from: (i + 1 - next.offset) * length,
          to: (i + 1 - stop.offset) * length,
          start: next.value,
          end: stop.value,
          easing: reversed(easing),
        }
      : {
          from: (i + stop.offset) * length,
          to: (i + next.offset) * length,
          start: stop.value,
          end: next.value,
          easing,
        };
  });

  return back ? out.reverse() : out;
};

/** The moves of a piece between two times of the animation's own clock, as `at` seconds of the scene. */
const movesOf = <T>(
  piece: Piece<T>,
  low: number,
  high: number,
  mix: (a: T, b: T, u: number) => T,
  scene: (clock: number) => number,
): Move<T>[] => {
  const [from, to] = [Math.max(piece.from, low), Math.min(piece.to, high)];
  const size = piece.to - piece.from;

  if (to < from - 1e-9) return [];

  if (size < 1e-9)
    return [{ at: scene(from), over: 0, from: piece.end, to: piece.end, easing: piece.easing }];

  const [p0, p1] = [(from - piece.from) / size, (to - piece.from) / size];
  const { easing } = piece;

  if (easing.kind === "steps") {
    const count = easing.levels.length;
    const cuts: Move<T>[] = [];

    for (let j = Math.floor(p0 * count + 1e-9); j < count; j++) {
      if (j / count >= p1 - 1e-9 && j > Math.floor(p0 * count + 1e-9)) break;

      const value = mix(piece.start, piece.end, easing.levels[j]!);

      cuts.push({
        at: scene(piece.from + Math.max(p0, j / count) * size),
        over: 0,
        from: value,
        to: value,
        easing,
      });
    }

    if (p1 >= 1 - 1e-9)
      cuts.push({ at: scene(piece.to), over: 0, from: piece.end, to: piece.end, easing });

    return cuts;
  }

  if (to - from < 1e-9) return [];

  const [a, b] = [scene(from), scene(to)];

  return [
    {
      at: a,
      over: b - a,
      from: mix(piece.start, piece.end, easedAt(easing, p0)),
      to: mix(piece.start, piece.end, easedAt(easing, p1)),
      easing: windowOf(easing, p0, p1),
    },
  ];
};

/**
 * The moves a property makes from scene time 0: the animation's iterations in order, from where its own clock stood at capture.
 * An infinite animation already running becomes one cycle, started at its phase, and looped.
 */
const plan = <T>(
  stops: readonly Stop<T>[],
  timing: Timing,
  base: T,
  last: number,
  mix: (a: T, b: T, u: number) => T,
): Plan<T> => {
  const { length, delay, rate, now, count: iterations } = timing;
  const run = now - delay;
  const through = run + rate * last;

  const first = stops[0]!.value;
  const toScene = (clock: number) => round((clock - run) / rate);

  if (!Number.isFinite(iterations) && run >= 0) {
    const cycle = timing.direction.startsWith("alternate") ? 2 : 1;
    const period = cycle * length;
    const phase = run % period;
    const pieces = Array.from({ length: cycle }, (_, i) => piecesOf(stops, timing, i)).flat();

    const moves = [
      ...pieces.flatMap((piece) =>
        movesOf(piece, phase, period, mix, (clock) => round((clock - phase) / rate)),
      ),
      ...(phase > 0
        ? pieces.flatMap((piece) =>
            movesOf(piece, 0, phase, mix, (clock) => round((clock + period - phase) / rate)),
          )
        : []),
    ];

    return { initial: moves[0]?.from ?? first, moves, period: round(period / rate) };
  }

  const moves: Move<T>[] = [];
  const low = Math.max(0, run);
  const high = Math.min(iterations * length, through);

  for (
    let i = Math.max(0, Math.floor(run / length));
    i < iterations && i * length < high && moves.length < MAX_STEPS;
    i++
  )
    for (const piece of piecesOf(stops, timing, i))
      moves.push(...movesOf(piece, low, high, mix, toScene));

  const before = run < 0 ? (timing.fillsBefore ? (moves[0]?.from ?? first) : base) : undefined;
  const initial = before ?? moves[0]?.from ?? base;

  // Past its last iteration the effect either holds its last value or lets go of it.
  const end = iterations * length;

  if (Number.isFinite(iterations) && through >= end - 1e-9) {
    const held = piecesOf(stops, timing, iterations - 1).at(-1)?.end ?? first;
    const after = timing.fillsAfter ? held : base;

    moves.push({ at: toScene(end), over: 0, from: after, to: after, easing: { kind: "linear" } });
  }

  return { initial, moves };
};

const key = <T>(value: T): string => JSON.stringify(value);

// SAFETY: a value of the track is a number, a point or a color, never an anchor, so what `Goal` adds to it is not in play.
const goal = <T>(value: T): never => value as never;

/** A track of one projection of a plan's values, or the plain value when nothing moves. */
const trackOf = <T, U>({ initial, moves, period }: Plan<T>, pick: (value: T) => U): Anim<U> => {
  const start = pick(initial);

  let current = start;
  let made: Track<U> = track<U>(start);
  let steps = 0;

  for (const move of moves) {
    const [from, to] = [pick(move.from), pick(move.to)];

    if (move.over <= 0) {
      if (key(current) !== key(to)) {
        made = made.set(goal(to), span(move.at));
        steps++;
      }
    } else if (key(from) !== key(to)) {
      if (key(current) !== key(from)) made = made.set(goal(from), span(move.at));
      made = made.to(goal(to), span(move.at, move.over), move.curve ?? curveOf(move.easing));
      steps++;
    } else if (key(current) !== key(from)) {
      made = made.set(goal(from), span(move.at));
      steps++;
    }

    current = to;
  }

  if (steps === 0) return start;

  return period === undefined ? made : made.loop(period);
};

// ----------------------------------------------------------------------------- reading an element

const TRANSFORM = ["transform", "translate", "rotate", "scale"];

const IGNORED = new Set(["offset", "computedOffset", "easing", "composite"]);

/** Seconds the scene needs to show what the element's running animations do: the longest remaining run, or one cycle of an infinite one. */
export const watchFor = (el: ElementNode): number => {
  let longest = 0;

  for (const animation of el.animations ?? []) {
    if (animation.playState !== "running" || animation.playbackRate <= 0) continue;
    const length = animation.duration / 1000;

    if (length <= 0) continue;

    const cycle = animation.direction.startsWith("alternate") ? 2 : 1;
    const left = Math.max(0, animation.delay / 1000 - animation.currentTime / 1000);

    const run =
      animation.iterations === "infinite"
        ? cycle * length
        : Math.max(
            0,
            (animation.delay + animation.duration * Math.ceil(animation.iterations)) / 1000 -
              animation.currentTime / 1000,
          );

    longest = Math.max(longest, (left + run) / animation.playbackRate);
  }

  for (const child of el.children)
    if (child.type === "element") longest = Math.max(longest, watchFor(child));

  return longest;
};

/** The keyframes that set one of `names`, with the ends the animation leaves out filled with `rest`. */
const stopsOf = <T>(
  animation: Animation,
  names: readonly string[],
  read: (frame: Keyframe) => T | Reason,
  rest: T | undefined,
  say: (what: string) => void,
): Stop<T>[] | undefined => {
  const stops: Stop<T>[] = [];

  for (const frame of animation.keyframes) {
    if (!names.some((name) => name in frame.props)) continue;
    const value = read(frame);

    if (value instanceof Reason) {
      say(value.why);

      return undefined;
    }

    const parsed = parseEasing(frame.easing);

    if (!parsed) say(`the easing "${frame.easing}" is drawn as linear`);

    stops.push({ offset: frame.offset, value, easing: parsed ?? LINEAR });
  }

  if (stops.length === 0) return undefined;

  const [head, tail] = [stops[0]!, stops.at(-1)!];

  if ((head.offset > 1e-9 || tail.offset < 1 - 1e-9) && rest === undefined) {
    say("leaves out a keyframe at 0% or 100% and has nothing to fill it with");

    return undefined;
  }

  if (head.offset > 1e-9) stops.unshift({ offset: 0, value: rest!, easing: head.easing });

  if (tail.offset < 1 - 1e-9) stops.push({ offset: 1, value: rest!, easing: tail.easing });

  return stops;
};

const timingOf = (animation: Animation): Timing => {
  const fill = animation.kind === "transition" ? "both" : animation.fill;

  return {
    length: animation.duration / 1000,
    delay: animation.delay / 1000,
    rate: animation.playbackRate,
    now: animation.currentTime / 1000,
    count:
      animation.iterations === "infinite" ? Infinity : Math.max(1, Math.ceil(animation.iterations)),
    direction: animation.direction,
    fillsBefore: fill === "backwards" || fill === "both",
    fillsAfter: fill === "forwards" || fill === "both",
    easing: parseEasing(animation.easing) ?? LINEAR,
  };
};

/** A transparent stop takes the color of its neighbor, as CSS blends premultiplied colors. */
const solidified = (stops: Stop<Rgba>[]): Stop<Rgba>[] =>
  stops.map((stop, i) => {
    if (stop.value[3] > 0) return stop;

    const near =
      stops.slice(i + 1).find((other) => other.value[3] > 0) ??
      stops.slice(0, i).findLast((other) => other.value[3] > 0);

    return near ? { ...stop, value: [near.value[0], near.value[1], near.value[2], 0] } : stop;
  });

/** One animation driving one property: what it does, and what the property is once it lets go. */
interface Drive<T> {
  /** The same in every state where it is the same animation: its name and keyframes. */
  readonly id: string;
  readonly stops: Stop<T>[];
  readonly timing: Timing;
  readonly base: T;
}

interface Drives {
  transform?: Drive<Pose>;
  opacity?: Drive<number>;
  fill?: Drive<Rgba>;
}

/**
 * Reads an element's running animations: for each of `transform` (with `translate`, `rotate` and `scale`), `opacity` and
 * `background-color`, the one that drives it. Paused and finished animations are left as the layout shows them.
 *
 * What an animation that does not fill returns to is the element's style without it, which a capture mid-flight cannot see: the
 * Snapshot's `base`. A Snapshot without one (the element's animations all lay ahead of it) falls back to the static style, and
 * mid-flight to none and 1 for `transform` and `opacity`; a color then holds its last keyframe.
 */
const driveOf = (el: ElementNode, path: string, ctx: Context): Drives | undefined => {
  const running = (el.animations ?? []).filter((animation) => animation.playState === "running");

  if (running.length === 0) return undefined;

  const themed = isThemed(el.background);
  const staticFill: Rgba = (!isThemed(el.background) && rgbaOf(el.background ?? "")) || CLEAR;
  const drives: Drives = {};
  const under = el.base;

  const underPose = ((): Pose | undefined => {
    const parsed = under && poseOf(under, el.rect);

    return parsed && !(parsed instanceof Reason) ? poseOfMatrix(parsed.matrix) : undefined;
  })();

  const underAlpha = under?.opacity === undefined ? undefined : numberOf(under.opacity);

  // A color that follows the color scheme is paired in the base too, and is not animated.
  const underFill =
    under?.backgroundColor === undefined || isThemed(under.backgroundColor)
      ? undefined
      : rgbaOf(under.backgroundColor);

  // A later animation replaces an earlier one that drives the same thing.
  const given = new Set<string>();

  for (const animation of [...running].reverse()) {
    const say = (what: string) => ctx.note(path, `animation ${animation.name}: ${what}`);

    if (animation.playbackRate <= 0) {
      say("a playbackRate of 0 or less is not compiled");
      continue;
    }

    if (animation.duration <= 0) {
      say("an animation with no duration is not compiled");
      continue;
    }

    const names = new Set(animation.keyframes.flatMap((frame) => Object.keys(frame.props)));

    for (const name of names)
      if (![...TRANSFORM, "opacity", "backgroundColor"].includes(name) && !IGNORED.has(name))
        say(`the property ${name} is not compiled`);

    const timing = timingOf(animation);
    const id = JSON.stringify([animation.name, animation.keyframes]);
    // What the element looks like with no animation: only known before the animation starts.
    const idle = animation.currentTime < animation.delay;

    if (animation.keyframes.length > 2 && timing.easing.kind !== "linear")
      say("the easing of the whole effect is only compiled for two keyframes");

    const drives_ = (group: string): boolean => {
      if (given.has(group)) {
        say(`${group} is also driven by a later animation, which wins`);

        return false;
      }

      given.add(group);

      return true;
    };

    if (TRANSFORM.some((name) => names.has(name)) && !drives.transform) {
      let previous: number | undefined;

      const stops = stopsOf<Pose>(
        animation,
        TRANSFORM,
        (frame) => {
          // The four compose into one transform, so a keyframe of one keeps the static values of the others.
          const merged: Record<string, string> = {};

          for (const name of TRANSFORM) {
            const value = frame.props[name] ?? under?.[name];

            if (value !== undefined) merged[name] = value;
          }

          const parsed = poseOf(merged, el.rect);

          if (parsed instanceof Reason) return parsed;

          const pose = poseOfMatrix(parsed.matrix);

          previous = wound(pose.rotate, parsed.turns ?? previous ?? pose.rotate);

          return { ...pose, rotate: previous };
        },
        underPose ?? REST,
        say,
      );

      if (stops && drives_("transform"))
        drives.transform = {
          id,
          stops,
          timing,
          base: underPose ?? (idle && el.transform ? poseOfMatrix(el.transform.matrix) : REST),
        };
    }

    if (names.has("opacity") && !drives.opacity) {
      const stops = stopsOf<number>(
        animation,
        ["opacity"],
        ({ props }) =>
          numberOf(props.opacity ?? "") ??
          new Reason(`the opacity "${props.opacity}" could not be read`),
        underAlpha ?? 1,
        say,
      );

      if (stops && drives_("opacity"))
        drives.opacity = {
          id,
          stops,
          timing,
          base: underAlpha ?? (idle ? (el.opacity ?? 1) : 1),
        };
    }

    if (names.has("backgroundColor") && !drives.fill) {
      if (themed) {
        say("a background color that follows the color scheme is not animated");
        continue;
      }

      const stops = stopsOf<Rgba>(
        animation,
        ["backgroundColor"],
        ({ props }) =>
          rgbaOf(props.backgroundColor ?? "") ??
          new Reason(`the background-color "${props.backgroundColor}" could not be read`),
        underFill ?? (idle ? staticFill : undefined),
        say,
      );

      if (stops && drives_("fill")) {
        // Without a recorded base, a color that lets go mid-flight has nothing to return to: it keeps its last keyframe.
        const holds = !underFill && !idle;

        if (holds && !timing.fillsAfter && Number.isFinite(timing.count))
          say("has no base color, so the background color keeps its last keyframe once it ends");

        drives.fill = {
          id,
          stops: solidified(stops),
          timing: { ...timing, fillsAfter: holds ? true : timing.fillsAfter },
          base: underFill ?? staticFill,
        };
      }
    }
  }

  return Object.keys(drives).length > 0 ? drives : undefined;
};

/** When a state is on the scene's clock: its move in starts at `start` (0 for the first state), it rests from `start + over` to `end`. */
export interface Slot {
  readonly start: number;
  readonly over: number;
  readonly end: number;
}

/** The ease of each move into a state; the first state has none. */
type Eases = readonly (Curve | undefined)[];

const withCurve = <T>(move: Move<T>, curve: Curve | undefined): Move<T> =>
  curve ? { ...move, curve } : move;

/** The move cut short at scene time `end`. */
const cutAt = <T>(move: Move<T>, end: number, mix: (a: T, b: T, u: number) => T): Move<T> => {
  if (move.at + move.over <= end + 1e-9 || move.over <= 0) return move;

  const u = (end - move.at) / move.over;

  return {
    ...move,
    over: end - move.at,
    to: mix(move.from, move.to, easedAt(move.easing, u)),
    easing: windowOf(move.easing, 0, u),
  };
};

/**
 * One property of one element over the states' whole timeline, as a single plan that every state's copy of the element shares,
 * so a morph sees the same track in each and has nothing to blend.
 *
 * An animation that is the same (name and keyframes) in consecutive states is one run, continuous through the moves between them.
 * It starts when its first state starts to appear (at 0 for the first state; for a state the element is already in, at the end
 * of the move in, where the capture is what shows), taking its phase from that state's capture, and goes on to the end of its last
 * state, or through the move out when the element leaves. Outside a run the property is the static value of the state, and
 * moves between those with the state's ease.
 *
 * @param statics The property as each state shows it without animations; undefined where the element is not in that state.
 */
const lane = <T extends NonNullable<unknown>>(
  drives: readonly (Drive<T> | undefined)[],
  statics: readonly (T | undefined)[],
  slots: readonly Slot[],
  eases: Eases,
  mix: (a: T, b: T, u: number) => T,
  /** The value to move to, brought close to the one it moves from, so a turn takes the short way. */
  near: (target: T, from: T) => T = (target) => target,
): Plan<T> | undefined => {
  const first = drives.find(Boolean);

  if (!first) return undefined;

  const total = slots.at(-1)!.end;

  // One run over everything, from the start: the animation as it is, an endless one a loop.
  if (
    drives.every((drive) => drive?.id === first.id) &&
    statics.every((value) => value !== undefined)
  )
    return plan(first.stops, first.timing, first.base, total, mix);

  const moves: Move<T>[] = [];
  const present = statics.findIndex((value) => value !== undefined);
  let current = statics[present]!;
  let initial = current;

  const go = (i: number, to: T): void => {
    const target = near(to, current);

    if (key(current) === key(target)) return;

    moves.push(
      withCurve(
        {
          at: slots[i]!.start,
          over: slots[i]!.over,
          from: current,
          to: target,
          easing: LINEAR,
        },
        eases[i],
      ),
    );
    current = target;
  };

  for (let i = 0; i < slots.length;) {
    const drive = drives[i];

    if (!drive) {
      if (i > 0 && statics[i] !== undefined) go(i, statics[i]!);

      i++;
      continue;
    }

    let last = i;

    while (drives[last + 1]?.id === drive.id) last++;

    const entering = i > 0 && statics[i - 1] === undefined;
    const leaving = last + 1 < slots.length && statics[last + 1] === undefined;
    const start = i === 0 ? 0 : entering ? slots[i]!.start : slots[i]!.start + slots[i]!.over;

    const end =
      last + 1 === slots.length
        ? total
        : leaving
          ? slots[last + 1]!.start + slots[last + 1]!.over
          : slots[last]!.end;

    const run = plan(drive.stops, drive.timing, drive.base, end - start, mix);

    if (i > 0 && !entering) go(i, run.initial);
    else if (moves.length === 0 && i === present) initial = current = run.initial;

    const cycles = run.period === undefined ? 1 : Math.ceil((end - start) / run.period);

    outer: for (let k = 0; k < cycles && moves.length < MAX_STEPS; k++)
      for (const move of run.moves) {
        const at = round(start + k * (run.period ?? 0) + move.at);

        if (at >= end - 1e-9) break outer;

        const placed = cutAt({ ...move, at }, end, mix);

        moves.push(placed);
        current = placed.to;
      }

    if (run.moves.length === 0) current = run.initial;

    i = last + 1;
  }

  return { initial, moves };
};

/**
 * Compiles the running animations of every element to tracks for its `@track` group, over the states' timeline: scene time 0 is the
 * first state's capture, and each animation continues from its own `currentTime` through its delay, iterations and direction,
 * at its `playbackRate`. Keyed by the element's path.
 *
 * The tracks are the same in every state an element is in, whatever animations that state has: so a morph never has to blend a
 * lane, and the element keeps animating while it moves, enters or exits. See `lane` for when a run starts and ends.
 */
export const animate = (
  roots: readonly Paired<ElementNode>[],
  slots: readonly Slot[],
  eases: Eases,
  ctx: Context,
): Map<string, Motion> => {
  const found = new Map<string, (ElementNode | undefined)[]>();

  const visit = (paired: Paired<ElementNode>, path: string, state: number): void => {
    const nodes = found.get(path) ?? roots.map(() => undefined);

    nodes[state] = paired.node;
    found.set(path, nodes);

    for (const kid of paired.children) if (isElement(kid)) visit(kid, `${path}/${kid.key}`, state);
  };

  roots.forEach((root, state) => visit(root, root.key, state));

  const out = new Map<string, Motion>();

  for (const [path, nodes] of found) {
    if (!nodes.some((el) => el?.animations?.length)) continue;

    const drives = nodes.map((el) => el && driveOf(el, path, ctx));

    if (drives.every((one) => !one)) continue;

    const motion: { -readonly [K in keyof Motion]: Motion[K] } = {};
    const pick = <K extends keyof Drives>(group: K) => drives.map((one) => one?.[group]);

    const poses = lane<Pose>(
      pick("transform"),
      nodes.map((el) => el && (el.transform ? poseOfMatrix(el.transform.matrix) : REST)),
      slots,
      eases,
      mixPose,
      (target, from) => ({ ...target, rotate: wound(target.rotate, from.rotate) }),
    );

    if (poses)
      motion.transform = {
        offset: trackOf(poses, (pose) => pose.translate),
        rotate: trackOf(poses, (pose) => pose.rotate),
        scale: trackOf(poses, (pose) => pose.scale),
        skew: trackOf(poses, (pose) => pose.skew),
      };

    const alpha = lane<number>(
      pick("opacity"),
      nodes.map((el) => el && (el.opacity ?? 1)),
      slots,
      eases,
      mixNumber,
    );

    if (alpha) motion.opacity = trackOf(alpha, (value) => value);

    if (nodes.some((el) => isThemed(el?.background))) {
      if (pick("fill").some(Boolean))
        ctx.note(path, "a background color that follows the color scheme is not animated");
    } else {
      const fills = lane<Rgba>(
        pick("fill"),
        nodes.map(
          (el) => el && ((!isThemed(el.background) && rgbaOf(el.background ?? "")) || CLEAR),
        ),
        slots,
        eases,
        mixRgba,
      );

      if (fills) motion.fill = trackOf(fills, hexOf);
    }

    if (Object.keys(motion).length > 0) out.set(path, motion);
  }

  return out;
};

const poseOfMatrix = (matrix: Matrix): Pose => {
  const { translate, rotate, scale, skew } = decompose(matrix);

  return {
    translate: [round(translate[0]), round(translate[1])],
    rotate: round(rotate),
    scale: [round(scale[0]), round(scale[1])],
    skew: round(skew),
  };
};
