import type { Color } from "../attributes";
import { el } from "../el";
import { pathLength, simplify, type Point } from "../geometry";
import { EPSILON, ease, motion, type Seconds } from "../motion";
import { textWidth, type FontValue } from "../font/font";
import { draw } from "../recipes";
import { span, type Spanned } from "../span";
import type { SvgNode } from "../svg";
import { defaultDark, type Base16 } from "./theme";
import { travel } from "./timeline";

/**
 * `dot` a plain token. `comet` a bright head with a fading tail and halo. `trace` lights the path as the head runs it,
 * then lets it fade. `packet` a labelled chip, for a message with a name.
 */
export type FlowStyle = "dot" | "comet" | "trace" | "packet";

export interface FlowOptions {
  readonly at: Seconds;
  /** px/s. Default 220, or 120 along several lines. Ignored when `over` is set. */
  readonly speed?: number;
  /** Seconds the trip takes. Along several lines each takes its own time, from `speed`. */
  readonly over?: Seconds;
  readonly style?: FlowStyle;
  /** Default `defaultDark`; `color` defaults to its `base09`. */
  readonly theme?: Base16;
  readonly color?: Color;
  /** Head radius. Default 4.5, or 2.5 along several lines. */
  readonly size?: number;
  /** A ring that ripples out where the trip ends. */
  readonly arrive?: boolean;
  /** The packet's text. */
  readonly label?: string;
  readonly fontSize?: number;
  /** Embedded for the packet label, which is sized by measuring it. */
  readonly font?: FontValue;
  /** Packet text color; defaults to `color`. */
  readonly ink?: Color;
  /** Packet fill. Default transparent over a solid outline. */
  readonly fill?: Color;
  readonly class?: string;
  /** Run again every this many seconds, for a `dot`, `comet` or `packet`. The period must cover the trip and the comet's tail. */
  readonly period?: Seconds;
  /** @deprecated use `period` */
  readonly loop?: Seconds;
  /** Dots trailing a `comet`. Default 8. Each one is its own animated element, so a crowd of comets wants fewer. */
  readonly tail?: number;
  /** Along several lines: seconds a particle waits between trips. Default 0.4 of the length of its trip. */
  readonly rest?: Seconds;
  /** Along several lines: px a particle may stray from its line, which keeps the keyframes few. Default 1. */
  readonly tolerance?: number;
}

const TAIL = 8;

/** Px of path the comet's tail covers. */
const REACH = 36;

export interface FlowResult {
  readonly node: SvgNode;
  /** From `at` to when it arrives, ring included. */
  readonly span: Spanned;
  /** @deprecated use `span.end` */
  readonly end: Seconds;
}

const one = (points: readonly Point[], options: FlowOptions): FlowResult => {
  const {
    at,
    speed = 220,
    style = "dot",
    theme = defaultDark,
    color = theme.base09,
    size = 4.5,
    arrive = false,
    class: cls,
    tail = TAIL,
  } = options;

  const period = options.period ?? options.loop;

  if (period !== undefined && (style === "trace" || arrive))
    throw new Error(
      `flow() loops a dot, comet or packet. Drop period, or leave out the ${style === "trace" ? "trace style" : "arrive ring"}.`,
    );

  const over = options.over ?? pathLength(points) / speed;
  const end = at + over;
  const lag = REACH / tail / (pathLength(points) / over);

  if (period !== undefined && style === "comet" && at + over + lag * tail > period + EPSILON)
    throw new Error(
      `flow() needs a period past ${Math.ceil((at + over + lag * tail) * 100) / 100}s to hold the trip and the comet's tail, got ${period}s.`,
    );

  const run = (delay = 0) => {
    const trip = travel(points, { at: at + delay, over });

    return period === undefined ? trip : trip.loop(period);
  };

  const head = el.circle({ r: size, fill: color, animation: run() });

  const body = (() => {
    switch (style) {
      case "dot":
        return head;
      case "comet":
        return [
          el.g({ opacity: 0.22 }, el.circle({ r: size * 2.4, fill: color, animation: run() })),
          Array.from({ length: tail }, (_, i) => {
            const k = (i + 1) / (tail + 1);

            return el.g(
              { opacity: 0.6 * (1 - k) },
              el.circle({ r: size * (1 - 0.7 * k), fill: color, animation: run(lag * (i + 1)) }),
            );
          }),
          head,
        ];
      case "trace":
        return [
          el.path({
            d: points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(""),
            fill: "none",
            stroke: color,
            strokeWidth: size * 0.6,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            animation: [
              motion()
                .at(end + 0.15)
                .to({ opacity: 0 }, 0.6),
              draw({ at, over }, ease.linear),
            ],
          }),
          head,
        ];
      case "packet": {
        const text = options.label ?? "";
        const fontSize = options.fontSize ?? 11;
        const [w, h] = [textWidth(text, fontSize, options.font) + 14, fontSize + 9];

        return el.g({ animation: run() }, [
          el.rect({
            x: -w / 2,
            y: -h / 2,
            width: w,
            height: h,
            rx: h / 2,
            fill: options.fill ?? color,
            fillOpacity: options.fill ? 1 : 0.18,
            stroke: color,
            strokeWidth: 1.25,
          }),
          el.text(
            {
              y: fontSize * 0.35,
              textAnchor: "middle",
              fontSize,
              fontFamily: options.font,
              fill: options.ink ?? color,
            },
            text,
          ),
        ]);
      }
    }
  })();

  const last = points.at(-1)!;

  const ring =
    arrive &&
    el.circle({
      cx: last.x,
      cy: last.y,
      r: size * 2,
      fill: "none",
      stroke: color,
      strokeWidth: 1.5,
      animation: motion({ opacity: 0, scale: 0.5 })
        .at(end)
        .set({ opacity: 0.9 })
        .to({ opacity: 0, scale: 3 }, 0.7),
    });

  const done = end + (arrive ? 0.7 : 0);

  return { node: el.g({ class: cls }, [body, ring]), span: span(at, done - at), end: done };
};

/** Same as the golden angle on a circle: consecutive indices land far apart, and the sequence never repeats. */
const GOLDEN = 0.6180339887498949;

/** The line cut `distance` along its length: the point of the cut belongs to both halves. */
const cut = (points: readonly Point[], distance: number): [Point[], Point[]] => {
  let left = distance;

  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1]!, points[k]!];
    const leg = Math.hypot(b.x - a.x, b.y - a.y);

    if (left <= leg && leg > 0) {
      const t = left / leg;
      const mid = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

      return [
        [...points.slice(0, k), mid],
        [mid, ...points.slice(k)],
      ];
    }

    left -= leg;
  }

  return [[...points], [points.at(-1)!]];
};

/** Seconds the group of particles takes to fade in. */
const FADE_IN = 0.6;

const many = (lines: readonly (readonly Point[])[], options: FlowOptions): FlowResult => {
  const { at, speed = 120, style = "dot", tolerance = 1, class: cls, ...shared } = options;
  const tail = options.tail ?? (style === "comet" ? 3 : undefined);
  const reach = style === "comet" ? REACH / speed : 0;

  if (!(speed > 0) || !Number.isFinite(speed))
    throw new Error(`flow() needs a positive speed, got ${speed}.`);

  if (options.period !== undefined || options.loop !== undefined || options.over !== undefined)
    throw new Error(
      "flow() sets the period and the trip of every line itself, from speed. Drop period and over, or pass one line.",
    );

  const node = el.g(
    { class: cls, animation: motion({ opacity: 0 }).at(at).to({ opacity: 1 }, FADE_IN) },
    lines.flatMap((line, i) => {
      const points = simplify(line, tolerance);
      const length = pathLength(points);

      if (!(length > 0)) return [];

      const trip = length / speed;
      const wait = options.rest ?? trip * 0.4;
      const period = trip + reach + wait;
      const [ahead, behind] = cut(points, (((i + 1) * GOLDEN) % 1) * length);

      const piece = (part: readonly Point[], start: Seconds) =>
        pathLength(part) > 0
          ? [
              one(part, {
                ...shared,
                at: start,
                over: pathLength(part) / speed,
                period,
                style,
                tail,
                size: options.size ?? 2.5,
              }).node,
            ]
          : [];

      return [...piece(ahead, 0), ...piece(behind, pathLength(ahead) / speed + wait)];
    }),
  );

  return { node, span: span(at, FADE_IN), end: at + FADE_IN };
};

const isLines = (
  points: readonly Point[] | readonly (readonly Point[])[],
): points is readonly (readonly Point[])[] => Array.isArray(points[0]);

/**
 * Something running `points` from `at`. `span` runs until it arrives.
 *
 * Give it a list of lines, such as the `lines` of `streamlines()`, and one particle runs along every line, again and
 * again. Every line has its own length and so its own period, and the particle starts a different way along it, set by
 * the line's index, so the field flows without pulsing in unison. A particle that starts part way runs as two pieces,
 * so a comet's tail is cut where its line starts over. Costs one or two animated elements per line for `dot`, four to
 * eight for `comet`. `span` is then the time the particles take to fade in.
 */
export function flow(
  points: readonly Point[] | readonly (readonly Point[])[],
  options: FlowOptions,
): FlowResult {
  return isLines(points) ? many(points, options) : one(points, options);
}
