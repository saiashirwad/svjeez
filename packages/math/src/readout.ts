import { el, motion, type Color, type Seconds, type SvgNode } from "svjeez";
import { defaultDark, tint, type Base16 } from "svjeez/extras";
import { tex } from "./index.ts";

/** A value from `at` on, until the next one. */
export interface ReadoutValue {
  readonly at: Seconds;
  readonly value: number;
}

export interface ReadoutOptions {
  /** Left of the number's box, or the point `anchor` names. Default 0. */
  readonly x?: number;
  /** Top of the number's box. Default 0. */
  readonly y?: number;
  readonly fontSize?: number;
  /** Decimal places shown. Default 0. */
  readonly digits?: number;
  readonly theme?: Base16;
  /** Overrides the theme's plain color. */
  readonly color?: Color;
  /** The point of the box that `x` and `y` place, as fractions of its width and height. Default `[0, 0]`. */
  readonly anchor?: readonly [number, number];
  /** Seconds a digit takes to roll out and the next to roll in. 0 cuts. Default 0. */
  readonly roll?: Seconds;
  /** Needed with a function: how long it runs. */
  readonly duration?: Seconds;
  /** Needed with a function: seconds between the values it is asked for. Default 0.1. */
  readonly step?: Seconds;
}

export interface Readout {
  readonly node: SvgNode;
  readonly width: number;
  readonly height: number;
}

interface Change {
  readonly at: Seconds;
  readonly text: string;
}

const isFunction = (
  v: readonly ReadoutValue[] | ((t: Seconds) => number),
): v is (t: Seconds) => number => typeof v === "function";

const MINUS = "-";

const format = (value: number, digits: number): string => {
  const text = value.toFixed(digits);

  return Number(text) === 0 ? text.replace(MINUS, "") : text;
};

const changes = (
  values: readonly ReadoutValue[] | ((t: Seconds) => number),
  digits: number,
  { duration, step = 0.1 }: ReadoutOptions,
): Change[] => {
  let timeline: ReadoutValue[];

  if (isFunction(values)) {
    if (!(duration !== undefined && duration > 0) || !(step > 0))
      throw new Error(
        `readout() of a function needs a positive duration and step, got duration ${duration} and step ${step}.`,
      );
    timeline = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => ({
      at: i * step,
      value: values(i * step),
    }));
  } else timeline = [...values].sort((a, b) => a.at - b.at);

  if (timeline.length === 0 || timeline.some((v) => !Number.isFinite(v.value + v.at)))
    throw new Error("readout() needs at least one value, each with a finite time and number.");
  const list: Change[] = [];

  for (const { at, value } of timeline) {
    const text = format(value, digits);

    if (text !== list.at(-1)?.text) list.push({ at, text });
  }

  return list;
};

/**
 * A number that changes over time, set in the same math font as `tex()`. Give it `[{ at, value }]` to hold each value until the next,
 * or a function of time to read at every `step`. Each place holds one glyph per distinct digit it ever shows, toggled by stepped
 * keyframes, so the output stays small however often the number changes.
 */
export function readout(
  values: readonly ReadoutValue[] | ((t: Seconds) => number),
  options: ReadoutOptions = {},
): Readout {
  const { fontSize = 32, digits = 0, theme = defaultDark, roll = 0, anchor = [0, 0] } = options;

  if (!Number.isInteger(digits) || digits < 0 || !(fontSize > 0) || !(roll >= 0))
    throw new Error(
      `readout() needs a whole number of digits, a positive fontSize and a non-negative roll, got digits ${digits}, fontSize ${fontSize} and roll ${roll}.`,
    );
  const list = changes(values, digits, options);

  if (roll > 0 && list.some((c, i) => i > 0 && c.at - list[i - 1]!.at < roll))
    throw new Error(`readout() changes faster than its roll of ${roll} seconds.`);

  const point = digits > 0 ? digits + 1 : 0;
  const whole = Math.max(...list.map((c) => c.text.replace(MINUS, "").split(".")[0]!.length));
  const signed = list.some((c) => c.text.startsWith(MINUS));
  const places = (signed ? 1 : 0) + whole + point;

  /** The glyph each place shows for a text, or none. */
  const shown = (text: string): (string | undefined)[] => {
    const negative = text.startsWith(MINUS);
    const [integer, fraction = ""] = text.replace(MINUS, "").split(".");

    return [
      ...(signed ? [negative ? MINUS : undefined] : []),
      ...Array.from({ length: whole }, (_, i) => integer![i - (whole - integer!.length)]),
      ...(digits > 0 ? [".", ...fraction] : []),
    ];
  };

  const glyphOf = new Map<string, ReturnType<typeof tex>["words"][number]>();

  const glyph = (char: string) => {
    if (!glyphOf.has(char)) glyphOf.set(char, tex(char, { fontSize }).words[0]!);

    return glyphOf.get(char)!;
  };

  const advance = (char: string | undefined) =>
    char === undefined ? 0 : tex(char, { fontSize }).width;

  const slotWidths = Array.from({ length: places }, (_, p) =>
    Math.max(...list.map((c) => advance(shown(c.text)[p]))),
  );

  const left = slotWidths.reduce<number[]>((acc, w, p) => [...acc, acc[p]! + w], [0]);
  const width = left.at(-1)!;
  const zero = tex("0", { fontSize });
  const height = zero.height;
  const x = (options.x ?? 0) - anchor[0] * width;
  const y = (options.y ?? 0) - anchor[1] * height;
  const baseline = y + zero.words[0]!.y;
  const ink = options.color ?? tint(theme, "plain");
  const lift = fontSize * 0.45;

  const nodes = Array.from({ length: places }, (_, p) => {
    const rows = list.map((c) => shown(c.text)[p]);
    const chars = [...new Set(rows.filter((c): c is string => c !== undefined))];

    return chars.map((char) => {
      const g = glyph(char);
      const intervals = list.flatMap((c, i) => (rows[i] === char ? [[c.at, list[i + 1]?.at]] : []));
      const visibleAtStart = rows[0] === char;

      let track = roll
        ? motion(visibleAtStart ? { opacity: 1, y: 0 } : { opacity: 0, y: lift })
        : motion({ opacity: visibleAtStart ? 1 : 0 });

      for (const [from, to] of intervals) {
        if (roll) {
          if (from! > list[0]!.at) track = track.at(from!).to({ opacity: 1, y: 0 }, roll);

          if (to !== undefined)
            track = track.at(to).to({ opacity: 0, y: -lift }, roll).set({ y: lift });
        } else {
          if (from! > list[0]!.at) track = track.at(from!).set({ opacity: 1 });

          if (to !== undefined) track = track.at(to).set({ opacity: 0 });
        }
      }

      const [a, b, c, d] = g.matrix;

      return el.g(
        { animation: track },
        el.path({
          d: g.d,
          transform: `matrix(${a} ${b} ${c} ${d} ${Math.round((x + left[p]!) * 1000) / 1000} ${Math.round(baseline * 1000) / 1000})`,
          fill: ink,
        }),
      );
    });
  });

  return { node: el.g({}, nodes.flat()), width, height };
}
