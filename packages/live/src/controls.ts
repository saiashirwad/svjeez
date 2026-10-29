// What each literal in a scene is as a control: a number with the range a drag moves it through, a color, an ease, or
// one of a choice param's options. A declared param says exactly; any other literal is read from where it sits, so a
// scene nobody annotated still gets sensible controls.
import { ease, easeAt, type Ease, type Hex, type Point } from "svjeez";
import { fit, type NumberParam, type Schema } from "svjeez/params";
import type { Literal, LiteralOf, Role, Source } from "./source.ts";

interface Base<K extends Literal["kind"]> {
  readonly key: string;
  readonly literal: LiteralOf<K>;
  /** What a control calls the value: the param's label, else the attribute, property or const it sits in. */
  readonly label: string;
}

export type Value =
  | (Base<"number"> & { readonly kind: "number"; readonly param: NumberParam })
  | (Base<"color"> & { readonly kind: "color" })
  | (Base<"ease"> & { readonly kind: "ease" })
  | (Base<"string"> & { readonly kind: "choice"; readonly options: readonly string[] });

export type ValueOf<K extends Value["kind"]> = Extract<Value, { kind: K }>;

/** What a value can be set to, by kind. */
export interface Settable {
  readonly number: number;
  readonly color: Hex;
  readonly ease: Ease;
  readonly choice: string;
}

const nameOf = (role: Role) => {
  switch (role.kind) {
    case "attribute":
    case "const":
    case "property":
      return role.name;
    case "argument":
      return `${role.callee}#${role.index}`;
    case "other":
      return "";
  }
};

const labelOf = (role: Role) => (role.kind === "argument" ? `${role.callee}()` : nameOf(role));

type Meaning = Partial<Omit<NumberParam, "kind" | "value">>;

const span = (v: number, least: number) => Math.max(Math.abs(v) * 2, least);

/**
 * What a number means, by the name it is given or the call it is passed to. svjeez's own API is the most common place a
 * literal lands, so its names say the most: `at`, `over` and `.to(…, over)` are seconds, `opacity` runs 0 to 1.
 */
const MEANINGS: readonly {
  readonly names: readonly string[];
  readonly range: (v: number) => Meaning;
}[] = [
  {
    names: ["opacity", "fillOpacity", "strokeOpacity", "stopOpacity", "offset", "progress"],
    range: () => ({ min: 0, max: 1, step: 0.01 }),
  },
  {
    names: ["rotate", "rotation", "angle", "deg", "degrees", "skewX", "skewY", "hue", "swing"],
    range: () => ({ min: -360, max: 360, step: 1, unit: "°" }),
  },
  {
    names: [
      "at",
      "over",
      "delay",
      "duration",
      "period",
      "stagger",
      "each",
      "at#0",
      "wait#0",
      "loop#0",
      "to#1",
      "seconds#0",
    ],
    range: (v) => ({ min: 0, max: span(v, 4), step: 0.05, unit: "s" }),
  },
  {
    names: ["r", "rx", "ry", "width", "height", "size", "radius", "strokeWidth", "fontSize", "gap"],
    range: (v) => ({ min: 0, max: span(v, 10) }),
  },
  { names: ["scale", "scaleX", "scaleY"], range: (v) => ({ min: 0, max: span(v, 2), step: 0.01 }) },
];

const MEANING = new Map(MEANINGS.flatMap(({ names, range }) => names.map((n) => [n, range])));

const decimals = (text: string) => (text.split(".")[1] ?? "").length;

/**
 * The param a control for this number edits: the one `schema` declares for it, else a range read from where it sits,
 * else a span around its value, with a step as fine as the literal is written.
 */
export const paramFor = (literal: LiteralOf<"number">, schema: Schema = {}): NumberParam => {
  const declared = literal.param && !literal.param.option ? schema[literal.param.key] : undefined;

  if (declared?.kind === "number") return { ...declared, value: literal.value };
  const v = literal.value;
  const written = decimals(literal.text) ? 10 ** -decimals(literal.text) : 1;
  const range = MEANING.get(nameOf(literal.role))?.(v) ?? {};
  const step = Math.min(written, range.step ?? written);
  const min = Math.min(range.min ?? v - span(v, 10), v);
  const max = Math.max(range.max ?? v + span(v, 10), v);

  return { kind: "number", label: labelOf(literal.role), ...range, value: v, min, max, step };
};

/**
 * Every literal a control can edit, in source order. A param's own options (`min`, `max`, `step`) are left out, and a
 * string is a value only when it declares a choice param.
 */
export const valuesOf = (source: Source, schema: Schema = {}): Value[] =>
  source.literals.flatMap((literal): Value[] => {
    if (literal.param?.option !== undefined) return [];
    const declared = literal.param ? schema[literal.param.key] : undefined;
    const label = declared?.label ?? (literal.param?.key || labelOf(literal.role));
    const { key } = literal;

    switch (literal.kind) {
      case "number":
        return [{ kind: "number", key, literal, label, param: paramFor(literal, schema) }];
      case "color":
        return [{ kind: "color", key, literal, label }];
      case "ease":
        return [{ kind: "ease", key, literal, label }];
      case "string":
        return declared?.kind === "choice"
          ? [{ kind: "choice", key, literal, label, options: declared.options }]
          : [];
    }
  });

// ----- gestures, shared by every framework's controls

/** How far a sideways drag of `dx` pixels carries a number that started at `from`. Fine drags go a fifth as far. */
export const scrub = (param: NumberParam, from: number, dx: number, fine = false): number =>
  fit(param, from + ((dx * (param.max - param.min)) / 300) * (fine ? 0.2 : 1));

/** One arrow-key step from `v`, or ten with `big`. */
export const nudge = (param: NumberParam, v: number, by: 1 | -1, big = false): number =>
  fit(param, v + by * param.step * (big ? 10 : 1));

export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

/** An ease's control points. Every named ease but `linear` is a bezier, and `linear` is the straight one. */
export const bezierOf = (e: Ease): Bezier => (e.kind === "bezier" ? e.points : [0, 0, 1, 1]);

/** The ease's curve as `samples + 1` points from (0, 0) to (1, 1), x the time and y the progress, for drawing it. */
export const curveOf = (e: Ease, samples = 40): Point[] =>
  Array.from({ length: samples + 1 }, (_, k) => ({ x: k / samples, y: easeAt(e, k / samples) }));

/** The ease with control point `which` moved to `(x, y)`. x stays in 0 to 1, where a CSS bezier needs it. */
export const bend = (e: Ease, which: 0 | 1, x: number, y: number): Ease => {
  const p = [...bezierOf(e)];
  const round = (n: number) => Math.round(n * 100) / 100;
  p[which * 2] = round(Math.min(1, Math.max(0, x)));
  p[which * 2 + 1] = round(y);

  return ease.bezier(p[0]!, p[1]!, p[2]!, p[3]!);
};

/** `#rrggbb`, what a color input reads and writes, for any hex. */
export const rgbOf = (hex: Hex): `#${string}` => {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits.slice(0, 6);

  return `#${full.toLowerCase()}`;
};

/** `rgb` written as the hex `was` is: in its case, keeping its alpha. */
export const withRgb = (was: Hex, rgb: string): Hex => {
  const alpha = was.length === 9 ? was.slice(7) : "";
  const upper = was.slice(1) === was.slice(1).toUpperCase() && /[A-F]/.test(was);
  const digits = `${rgb.slice(1, 7)}${alpha}`;

  return `#${upper ? digits.toUpperCase() : digits.toLowerCase()}`;
};
