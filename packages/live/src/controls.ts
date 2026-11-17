import { ease, easeAt, type Ease, type Hex, type Point } from "svjeez";
import type { NumberParam, Schema } from "svjeez/params";
import { fit } from "./fit.ts";
import { decimalsOf, type Literal, type LiteralOf, type Role, type Source } from "./source.ts";

interface Base<K extends Literal["kind"]> {
  readonly key: string;
  readonly literal: LiteralOf<K>;
  readonly label: string;
}

export type Value =
  | (Base<"number"> & { readonly kind: "number"; readonly param: NumberParam })
  | (Base<"color"> & { readonly kind: "color" })
  | (Base<"ease"> & { readonly kind: "ease" })
  | (Base<"string"> & { readonly kind: "choice"; readonly options: readonly string[] })
  | (Base<"string"> & { readonly kind: "text"; readonly maxLength?: number });

export type ValueOf<K extends Value["kind"]> = Extract<Value, { kind: K }>;

export interface Settable {
  readonly number: number;
  readonly color: Hex;
  readonly ease: Ease;
  readonly choice: string;
  readonly text: string;
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

const MEANINGS: readonly {
  readonly names: readonly string[];
  readonly range: (v: number) => Meaning;
}[] = [
  {
    names: ["opacity", "fillOpacity", "strokeOpacity", "stopOpacity", "offset", "progress", "draw"],
    range: () => ({ min: 0, max: 1, step: 0.01 }),
  },
  {
    names: ["rotate", "rotation", "angle", "deg", "degrees", "skewX", "skewY", "hue", "swing"],
    range: () => ({ min: -360, max: 360, step: 1, unit: "°" }),
  },
  {
    names: [
      "at",
      "delay",
      "stagger",
      "each",
      "span#0",
      "next#1",
      "until#0",
      "shift#0",
      "pad#0",
      "pad#1",
      "stagger#2",
      "set#1",
      "seconds#0",
    ],
    range: (v) => ({ min: 0, max: span(v, 4), step: 0.05, unit: "s" }),
  },
  {
    // A length of 0 is a cut, which `.to()` and `render()` reject, so a drag stops one step short of it.
    names: [
      "over",
      "duration",
      "period",
      "span#1",
      "next#0",
      "first#0",
      "last#0",
      "chain#*",
      "loop#0",
    ],
    range: (v) => ({ min: 0.05, max: span(v, 4), step: 0.05, unit: "s" }),
  },
  // A canvas of 0 throws in `render()`, and a stagger of no items draws nothing.
  { names: ["width", "height"], range: (v) => ({ min: 1, max: span(v, 10) }) },
  { names: ["stagger#1"], range: (v) => ({ min: 1, max: span(v, 10), step: 1 }) },
  {
    names: ["r", "rx", "ry", "size", "radius", "strokeWidth", "fontSize", "gap"],
    range: (v) => ({ min: 0, max: span(v, 10) }),
  },
  { names: ["scale", "scaleX", "scaleY"], range: (v) => ({ min: 0, max: span(v, 2), step: 0.01 }) },
];

const MEANING = new Map(MEANINGS.flatMap(({ names, range }) => names.map((n) => [n, range])));

/**
 * The param a control for this number edits: the one `schema` declares, else a range read from where it sits, else a
 * span around its value.
 */
export const paramFor = (literal: LiteralOf<"number">, schema: Schema = {}): NumberParam => {
  const declared = literal.param && !literal.param.option ? schema[literal.param.key] : undefined;

  if (declared?.kind === "number") return { ...declared, value: literal.value };
  const v = literal.value;
  const places = decimalsOf(literal.text);
  const written = places ? 10 ** -places : 1;
  const role = literal.role;

  const range =
    (
      MEANING.get(nameOf(role)) ??
      (role.kind === "argument" ? MEANING.get(`${role.callee}#*`) : undefined)
    )?.(v) ?? {};

  const step = Math.min(written, range.step ?? written);
  const min = Math.min(range.min ?? v - span(v, 10), v);
  const max = Math.max(range.max ?? v + span(v, 10), v);

  return { kind: "number", label: labelOf(literal.role), ...range, value: v, min, max, step };
};

/** Every literal a control can edit, in source order. A param's own options (`min`, `max`, `step`) are left out. */
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
        if (declared?.kind === "choice")
          return [{ kind: "choice", key, literal, label, options: declared.options }];

        return declared?.kind === "text"
          ? [
              {
                kind: "text",
                key,
                literal,
                label,
                ...(declared.maxLength !== undefined && { maxLength: declared.maxLength }),
              },
            ]
          : [];
    }
  });

/** How far a sideways drag of `dx` pixels carries a number that started at `from`. Fine drags go a fifth as far. */
export const scrub = (param: NumberParam, from: number, dx: number, fine = false): number =>
  fit(param, from + ((dx * (param.max - param.min)) / 300) * (fine ? 0.2 : 1));

/** One arrow-key step from `v`, or ten with `big`. */
export const nudge = (param: NumberParam, v: number, by: 1 | -1, big = false): number =>
  fit(param, v + by * param.step * (big ? 10 : 1));

export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

export const bezierOf = (e: Ease): Bezier => (e.kind === "bezier" ? e.points : [0, 0, 1, 1]);

/** The ease's curve as `samples + 1` points from (0, 0) to (1, 1), x the time and y the progress, for drawing it. */
export const curveOf = (e: Ease, samples = 40): Point[] =>
  Array.from({ length: samples + 1 }, (_, k) => ({ x: k / samples, y: easeAt(e, k / samples) }));

/** How far a control point's y can overshoot below 0 and past 1, which is as far as a curve editor draws. */
export const BEND_Y = { min: -0.8, max: 2.2 } as const;

/**
 * The ease with control point `which` moved to `(x, y)`. x stays in 0 to 1, where a CSS bezier needs it, and y in
 * `BEND_Y`.
 */
export const bend = (e: Ease, which: 0 | 1, x: number, y: number): Ease => {
  const p = [...bezierOf(e)];
  const round = (n: number) => Math.round(n * 100) / 100;
  p[which * 2] = round(Math.min(1, Math.max(0, x)));
  p[which * 2 + 1] = round(Math.min(BEND_Y.max, Math.max(BEND_Y.min, y)));

  return ease.bezier(p[0]!, p[1]!, p[2]!, p[3]!);
};

export const rgbOf = (hex: Hex): `#${string}` => {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits.slice(0, 6);

  return `#${full.toLowerCase()}`;
};

export const withRgb = (was: Hex, rgb: string): Hex => {
  const alpha = was.length === 9 ? was.slice(7) : "";
  const upper = was.slice(1) === was.slice(1).toUpperCase() && /[A-F]/.test(was);
  const digits = `${rgb.slice(1, 7)}${alpha}`;

  return `#${upper ? digits.toUpperCase() : digits.toLowerCase()}`;
};
