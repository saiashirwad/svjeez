import { ease, el, motion, sampled, type Color, type Seconds, type SvgNode } from "svjeez";
import { defaultDark, tint, type Base16 } from "svjeez/extras";
import { apply, identity, type Matrix } from "./matrix.ts";

export type Point = readonly [x: number, y: number];

/** Anything with path data: a `tex()` glyph (whose `matrix` flips and places it) or `{ d }` in scene pixels. */
export interface Outline {
  readonly d: string;
  readonly matrix?: Matrix;
}

/** What `epicycles()` draws: path data, a glyph, a list of them in order, or a closed list of points. */
export type EpicyclesSource = string | Outline | readonly (string | Outline)[] | readonly Point[];

export interface EpicyclesOptions {
  /** When the pen starts, in seconds. */
  readonly at: Seconds;
  /** How long the pen takes to go once around the outline. */
  readonly over: Seconds;
  /** Circles in the chain. They shape the trace and carry the pen, and the smallest are too small to see. Default 80. */
  readonly terms?: number;
  /** The largest circles that draw their ring and arm. Default 24. */
  readonly circles?: number;
  /** Where the middle of the outline's box goes. Default: where the outline already is. */
  readonly center?: Point;
  /** Scales the outline so its longer side is this many pixels. Default: as it is. */
  readonly size?: number;
  /** Colors the rings and the trace. Default `defaultDark`. */
  readonly theme?: Base16;
  /** The trace's color. Default the theme's yellow. */
  readonly color?: Color;
  /** Fills the outline once the pen has closed it. Default none. */
  readonly fill?: Color;
  /** Pixels. Default 2. */
  readonly strokeWidth?: number;
  /** Seconds the rings and arms take to fade once the pen is done. 0 leaves them. Default 0.6. */
  readonly fade?: Seconds;
}

export interface Epicycles {
  /** Rings, arms, pen, trace and optional fill. */
  readonly node: SvgNode;
  /** When the rings have faded: the scene's end for this drawing. */
  readonly end: Seconds;
  /** The trace as path data, closed: what the chain draws. */
  readonly d: string;
}

interface Complex {
  re: number;
  im: number;
}

/** One circle of a Fourier series: it turns `k` times per loop, with radius `r` and starting angle `phase` in radians. */
export interface FourierTerm {
  readonly k: number;
  readonly r: number;
  readonly phase: number;
}

export interface FourierOptions {
  /** Points taken around the outline, evenly by arc length. An even number of at least 4. Default 1024. */
  readonly samples?: number;
  /** Terms kept, largest first. Default every one, `samples - 1`. */
  readonly terms?: number;
}

export interface Fourier {
  /** The point every circle spins around: the outline's mean, the series' constant term. */
  readonly mean: Point;
  /** The circles that sum to the outline, largest first. */
  readonly terms: readonly FourierTerm[];
  /** The samples the series was taken from. */
  readonly points: readonly Point[];
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

const ARITY = new Map([
  ["M", 2],
  ["L", 2],
  ["H", 1],
  ["V", 1],
  ["C", 6],
  ["S", 4],
  ["Q", 4],
  ["T", 2],
  ["Z", 0],
]);

const CURVE_STEPS = 16;
const SAMPLES = 1024;
const TRACE_POINTS = 400;

const lerp = (a: Point, b: Point, u: number): Point => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

/** Points along a Bezier curve of any degree, by de Casteljau, without its start. */
const bezier = (controls: readonly Point[]): Point[] =>
  Array.from({ length: CURVE_STEPS }, (_, i) => {
    let level = controls;

    for (const u = (i + 1) / CURVE_STEPS; level.length > 1;)
      level = level.slice(1).map((p, j) => lerp(level[j]!, p, u));

    return level[0]!;
  });

/** Every subpath of path data as a polyline. Curves become short chords. Arcs are not drawn. */
export function contours(d: string): Point[][] {
  const result: Point[][] = [];
  let line: Point[] = [];
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  let control: Point = current;
  let last = "";

  const go = (to: Point, via: Point[] = []): void => {
    if (line.length === 0) line.push(current);
    line.push(...via, to);
    current = to;
  };

  for (const [, letter, body] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const command = letter!.toUpperCase();
    const arity = ARITY.get(command);

    if (arity === undefined)
      throw new Error(
        `epicycles() cannot read a "${letter}" path command. Write the outline with M, L, H, V, C, S, Q, T and Z, or pass points.`,
      );
    const n = (body!.match(NUMBER) ?? []).map(Number);
    const relative = letter !== command;

    if (command === "Z") {
      if (line.length > 0) result.push(line);
      line = [];
      current = start;
      last = command;
      continue;
    }

    for (let i = 0, first = true; i + arity <= n.length; i += arity, first = false) {
      const [ox, oy] = relative ? current : [0, 0];
      const at = (j: number): Point => [n[i + j]! + ox, n[i + j + 1]! + oy];

      if (command === "M" && first) {
        if (line.length > 1) result.push(line);
        line = [];
        current = start = at(0);
        control = current;
      } else if (command === "M" || command === "L") {
        go(at(0));
        control = current;
      } else if (command === "H") {
        go([n[i]! + ox, current[1]]);
        control = current;
      } else if (command === "V") {
        go([current[0], n[i]! + oy]);
        control = current;
      } else if (command === "C" || command === "S") {
        const smooth = command === "S";

        const c1: Point = smooth
          ? last === "C" || last === "S"
            ? [2 * current[0] - control[0], 2 * current[1] - control[1]]
            : current
          : at(0);

        const [c2, to] = smooth ? [at(0), at(2)] : [at(2), at(4)];
        const from = current;
        go(to, bezier([from, c1, c2, to]).slice(0, -1));
        control = c2;
      } else {
        const q = command === "T";

        const c1: Point = q
          ? last === "Q" || last === "T"
            ? [2 * current[0] - control[0], 2 * current[1] - control[1]]
            : current
          : at(0);

        const to = q ? at(0) : at(2);
        const from = current;
        go(to, bezier([from, c1, to]).slice(0, -1));
        control = c1;
      }

      last = command;
    }
  }

  if (line.length > 1) result.push(line);

  return result;
}

const isText = (value: EpicyclesSource): value is string => typeof value === "string";

const isPoints = (source: EpicyclesSource): source is readonly Point[] =>
  Array.isArray(source) && Array.isArray(source[0]);

const isOutline = (source: Outline | readonly (string | Outline)[]): source is Outline =>
  "d" in source;

const toContours = (source: EpicyclesSource): Point[][] => {
  if (isText(source)) return contours(source);

  if (isPoints(source)) return [[...source]];
  const parts: readonly (string | Outline)[] = isOutline(source) ? [source] : source;

  return parts.flatMap((part) => {
    if (isText(part)) return contours(part);
    const matrix = part.matrix ?? identity;

    return contours(part.d).map((line) => line.map(([x, y]): Point => apply(matrix, x, y)));
  });
};

/** One closed loop through every contour in order, joined by straight bridges, and back to the start. */
const loop = (lines: readonly Point[][], caller: string): Point[] => {
  const points = lines.flat();

  if (points.length < 3) throw new Error(`${caller} needs an outline with at least three points.`);

  return [...points, points[0]!];
};

/** `count` points evenly spaced by arc length along a polyline. */
const resample = (points: readonly Point[], count: number, caller: string): Point[] => {
  const cumulative = [0];

  for (let i = 1; i < points.length; i++)
    cumulative.push(
      cumulative[i - 1]! +
        Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]),
    );
  const total = cumulative.at(-1)!;

  if (!(total > 0)) throw new Error(`${caller} needs an outline with some length.`);
  let j = 1;

  return Array.from({ length: count }, (_, i) => {
    const length = (total * i) / count;

    while (j < points.length - 1 && cumulative[j]! < length) j++;
    const span = cumulative[j]! - cumulative[j - 1]!;

    return lerp(points[j - 1]!, points[j]!, span > 0 ? (length - cumulative[j - 1]!) / span : 0);
  });
};

/** The circles that sum to the points, largest first, and the point they all spin around. */
const spectrum = (points: readonly Point[], count: number) => {
  const n = points.length;

  const table = Array.from({ length: n }, (_, m): Point => [
    Math.cos((2 * Math.PI * m) / n),
    Math.sin((2 * Math.PI * m) / n),
  ]);

  const all: FourierTerm[] = [];
  let mean: Point = [0, 0];

  for (let k = -n / 2 + 1; k <= n / 2; k++) {
    const sum: Complex = { re: 0, im: 0 };

    points.forEach(([x, y], i) => {
      const [c, s] = table[(((-k * i) % n) + n) % n]!;
      sum.re += x * c - y * s;
      sum.im += x * s + y * c;
    });
    const [re, im] = [sum.re / n, sum.im / n];

    if (k === 0) mean = [re, im];
    else all.push({ k, r: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }

  all.sort((a, b) => b.r - a.r || Math.abs(a.k) - Math.abs(b.k));

  return { mean, terms: all.slice(0, count) } satisfies { mean: Point; terms: FourierTerm[] };
};

/**
 * The Fourier series of any closed outline, the one `epicycles()` draws: the outline sampled evenly by arc length, then
 * taken apart into circles. Use it to draw the series some other way, as a formula, a spectrum or circles of your own.
 */
export function fourier(source: EpicyclesSource, options: FourierOptions = {}): Fourier {
  const { samples = SAMPLES, terms = samples - 1 } = options;

  if (!Number.isInteger(samples) || samples < 4 || samples % 2 !== 0)
    throw new Error(`fourier() needs an even number of samples, 4 or more, got ${samples}.`);

  if (!Number.isInteger(terms) || terms < 1 || terms > samples - 1)
    throw new Error(`fourier() keeps 1 to ${samples - 1} terms, got ${terms}.`);
  const points = resample(loop(toContours(source), "fourier()"), samples, "fourier()");

  return { ...spectrum(points, terms), points };
}

const tenth = (v: number): number => Math.round(v * 10) / 10 + 0;

/**
 * Draws any closed outline as a chain of spinning circles, each riding the tip of the one before, with a pen at the last tip
 * and its trace drawn in step with it. The outline is sampled by arc length and Fourier-transformed while the scene compiles.
 * A glyph from `tex()` goes in whole, not as `d`: its matrix turns the font's upright path to the screen's.
 */
export function epicycles(source: EpicyclesSource, options: EpicyclesOptions): Epicycles {
  const { at, over, terms: count = 80, circles = 24, strokeWidth = 2, fade = 0.6 } = options;
  const theme = options.theme ?? defaultDark;

  if (!(over > 0) || !Number.isFinite(at))
    throw new Error(
      `epicycles() needs a finite start and a positive duration, got at ${at} and over ${over}.`,
    );

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > SAMPLES / 2 - 1 ||
    circles < 0 ||
    !(fade >= 0)
  )
    throw new Error(
      `epicycles() needs 1 to ${SAMPLES / 2 - 1} terms, a non-negative number of circles and fade, got terms ${count}, circles ${circles} and fade ${fade}.`,
    );

  const points = resample(loop(toContours(source), "epicycles()"), SAMPLES, "epicycles()");
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];

  const [left, right, top, bottom] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];

  const scale =
    options.size === undefined ? 1 : options.size / (Math.max(right - left, bottom - top) || 1);

  const [mx, my] = [(left + right) / 2, (top + bottom) / 2];
  const [cx, cy] = options.center ?? [mx, my];

  const placed = points.map(([x, y]): Point => [(x - mx) * scale + cx, (y - my) * scale + cy]);
  const { mean, terms } = spectrum(placed, count);

  const at1 = (s: number): Point => {
    let [x, y] = mean;

    for (const { k, r, phase } of terms) {
      x += r * Math.cos(2 * Math.PI * k * s + phase);
      y += r * Math.sin(2 * Math.PI * k * s + phase);
    }

    return [x, y];
  };

  const trace = Array.from({ length: TRACE_POINTS + 1 }, (_, j) => at1(j / TRACE_POINTS));
  const cumulative = [0];

  for (let j = 1; j < trace.length; j++)
    cumulative.push(
      cumulative[j - 1]! +
        Math.hypot(trace[j]![0] - trace[j - 1]![0], trace[j]![1] - trace[j - 1]![1]),
    );
  const length = cumulative.at(-1)!;

  const d = `${trace.map(([x, y], j) => `${j ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("")}Z`;

  const drawn = (t: Seconds): number => {
    const u = Math.min(1, Math.max(0, (t - at) / over)) * TRACE_POINTS;
    const j = Math.min(TRACE_POINTS - 1, Math.floor(u));

    return (cumulative[j]! + (cumulative[j + 1]! - cumulative[j]!) * (u - j)) / length;
  };

  const trail = sampled((t) => ({ draw: drawn(t) }), {
    duration: at + over,
    step: over / 160,
    tolerance: { draw: 0.002 },
  });

  const ring = tint(theme, "blue");
  const ink = options.color ?? tint(theme, "yellow");

  // Each circle sits inside the one before it and already turns with it, so it spins only by the difference.
  const chain = terms.reduceRight<SvgNode | undefined>((inner, { k, r, phase }, i) => {
    const arm: Point = [r * Math.cos(phase), r * Math.sin(phase)];
    const previous = terms[i - 1];
    const spin = k - (previous?.k ?? 0);

    const offset: Point = previous
      ? [previous.r * Math.cos(previous.phase), previous.r * Math.sin(previous.phase)]
      : mean;

    return el.g({ transform: `translate(${tenth(offset[0])} ${tenth(offset[1])})` }, [
      el.g(
        {
          style: { transformOrigin: "0 0", transformBox: "view-box" },
          animation: motion({ rotate: 0 })
            .at(at)
            .to({ rotate: 360 * spin }, over, ease.linear),
        },
        [
          i < circles
            ? [
                el.circle({
                  r: tenth(r),
                  fill: "none",
                  stroke: ring,
                  strokeOpacity: 0.4,
                  strokeWidth: 1,
                }),
                el.line({
                  x2: tenth(arm[0]),
                  y2: tenth(arm[1]),
                  stroke: ring,
                  strokeOpacity: 0.8,
                  strokeWidth: 1.25,
                }),
              ]
            : [],
          inner ??
            el.circle({
              cx: tenth(arm[0]),
              cy: tenth(arm[1]),
              r: 4,
              fill: ink,
            }),
        ],
      ),
    ]);
  }, undefined);

  const entry = Math.min(0.5, over / 4);

  const visible = (() => {
    const shown = motion({ opacity: 0 }).at(at).to({ opacity: 1 }, entry);

    return fade > 0 ? shown.at(at + over).to({ opacity: 0 }, fade) : shown;
  })();

  return {
    node: el.g({}, [
      options.fill
        ? el.path({
            d,
            fill: options.fill,
            animation: motion({ opacity: 0 })
              .at(at + over)
              .to({ opacity: 1 }, Math.max(fade, 0.4)),
          })
        : [],
      el.path({
        d,
        fill: "none",
        stroke: ink,
        strokeWidth,
        strokeLinejoin: "round",
        strokeLinecap: "round",
        animation: trail,
      }),
      el.g({ animation: visible }, chain ?? []),
    ]),
    end: at + over + fade,
    d,
  };
}
