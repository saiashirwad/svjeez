import { radar, type DiagramOptions, type Radar } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface RadarAxisDoc {
  readonly id: string;
  readonly label: string;
}

export interface RadarCurveDoc {
  readonly id: string;
  readonly label: string;
  /** One value per axis, in axis order. */
  readonly values: readonly number[];
  readonly source: Place;
}

export interface RadarDoc {
  readonly kind: "radar";
  readonly source: Place;
  readonly title?: string;
  readonly axes: readonly RadarAxisDoc[];
  readonly curves: readonly RadarCurveDoc[];
  /** The value at the rim; the largest value when the text sets none. */
  readonly max?: number;
  readonly min: number;
  readonly ticks: number;
  readonly graticule: "circle" | "polygon";
  readonly showLegend: boolean;
}

const SUPPORTED =
  'Supported: `title Text`, `axis a["Label"], b`, `curve name["Label"]{1, 2, 3}` or `{a: 1, b: 2}`, `max N`, `min N`, `ticks N`, `graticule circle|polygon` and `showLegend true|false`.';

const UNSUPPORTED = /^(accTitle|accDescr)\b/;
const ID = String.raw`[A-Za-z_][\w-]*`;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const ITEM = new RegExp(String.raw`^(${ID})(?:\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])?\s*`);
const MAX_TICKS = 32;

const entries = (l: Line, rest: string, what: "axis" | "curve") => {
  const out: { id: string; label: string; body?: string }[] = [];
  let tail = rest.trim();

  while (tail !== "") {
    const m = ITEM.exec(tail);

    if (!m) return fail(l, `cannot read this ${what}. ${SUPPORTED}`);
    const id = m[1]!;
    const label = clean(m[2] ?? m[3] ?? id) || id;
    tail = tail.slice(m[0].length);
    let body: string | undefined;

    if (what === "curve") {
      const close = tail.startsWith("{") ? tail.indexOf("}") : -1;

      if (close < 0)
        return fail(
          l,
          `the curve ${id} needs its values in braces on the same line, as in ${id}{1, 2, 3}.`,
        );
      body = tail.slice(1, close);
      tail = tail.slice(close + 1).trim();
    }

    if (tail !== "") {
      if (!tail.startsWith(",")) return fail(l, `cannot read this ${what}. ${SUPPORTED}`);
      tail = tail.slice(1).trim();

      if (tail === "") return fail(l, `a comma needs another ${what} after it.`);
    }

    out.push({ id, label, ...(body !== undefined && { body }) });
  }

  return out;
};

const numberOf = (l: Line, text: string): number => {
  const t = text.trim();

  return NUMBER.test(t)
    ? Number(t)
    : fail(l, `${JSON.stringify(t)} is not a number. Write plain numbers such as 40 or 4.5.`);
};

const valuesOf = (
  l: Line,
  id: string,
  body: string,
  axes: readonly RadarAxisDoc[],
): readonly number[] => {
  const parts = body.split(",").map((p) => p.trim());

  if (parts.some((p) => p === ""))
    return fail(l, `the curve ${id} has an empty value. Remove the extra comma.`);
  const keyed = parts.map((p) => /^([A-Za-z_][\w-]*)\s*:\s*(.+)$/.exec(p));

  if (keyed.every((k) => k === null)) {
    const values = parts.map((p) => numberOf(l, p));

    if (values.length !== axes.length)
      return fail(
        l,
        `the curve ${id} has ${values.length} values for ${axes.length} axes. Give one value per axis.`,
      );

    return values;
  }

  if (keyed.some((k) => k === null))
    return fail(l, `the curve ${id} mixes plain and \`axis: value\` entries. Use one style.`);
  const byAxis = new Map<string, number>();

  for (const k of keyed) {
    const axis = k![1]!;

    if (!axes.some((a) => a.id === axis))
      return fail(
        l,
        `the curve ${id} names the axis ${axis}, which is not declared. Axes are ${axes.map((a) => a.id).join(", ")}.`,
      );

    if (byAxis.has(axis)) return fail(l, `the curve ${id} gives ${axis} twice.`);
    byAxis.set(axis, numberOf(l, k![2]!));
  }

  return axes.map((a) => {
    const v = byAxis.get(a.id);

    return v ?? fail(l, `the curve ${id} has no value for the axis ${a.id}.`);
  });
};

export const parseRadar = (header: Line, body: readonly Line[]): RadarDoc => {
  if (header.text !== "radar-beta")
    return fail(header, "write just `radar-beta` on the first line.");
  let title: string | undefined;
  let max: number | undefined;
  let min = 0;
  let ticks = 5;
  let graticule: "circle" | "polygon" = "circle";
  let showLegend = true;
  const axes: RadarAxisDoc[] = [];
  const curves: RadarCurveDoc[] = [];
  const pending: { l: Line; id: string; label: string; body: string }[] = [];

  for (const l of body) {
    const [word = "", ...restWords] = l.text.split(/\s+/);
    const rest = l.text.slice(word.length).trim();

    if (UNSUPPORTED.test(l.text))
      return fail(l, "accessibility lines are not supported: svjeez draws the title and curves.");

    if (word === "title" && rest !== "") {
      title = clean(rest);
      continue;
    }

    if (word === "axis") {
      for (const a of entries(l, rest, "axis")) {
        if (axes.some((x) => x.id === a.id))
          return fail(l, `the axis ${a.id} is already there. Give each axis its own name.`);
        axes.push({ id: a.id, label: a.label });
      }

      continue;
    }

    if (word === "curve") {
      for (const c of entries(l, rest, "curve")) {
        if (pending.some((x) => x.id === c.id))
          return fail(l, `the curve ${c.id} is already there. Give each curve its own name.`);
        pending.push({ l, id: c.id, label: c.label, body: c.body! });
      }

      continue;
    }

    if (word === "showLegend") {
      if (restWords.length !== 1 || !/^(true|false)$/.test(rest))
        return fail(l, "showLegend takes `true` or `false`.");
      showLegend = rest === "true";
      continue;
    }

    if (word === "graticule") {
      if (rest !== "circle" && rest !== "polygon")
        return fail(l, "graticule takes `circle` or `polygon`.");
      graticule = rest;
      continue;
    }

    if (word === "max" || word === "min" || word === "ticks") {
      if (restWords.length !== 1) return fail(l, `${word} takes one number, as in \`${word} 5\`.`);
      const v = numberOf(l, rest);

      if (word === "max") max = v;
      else if (word === "min") min = v;
      else {
        if (!Number.isInteger(v) || v < 1 || v > MAX_TICKS)
          return fail(l, `ticks takes a whole number from 1 to ${MAX_TICKS}.`);
        ticks = v;
      }

      continue;
    }

    return fail(l, `cannot read this line. ${SUPPORTED}`);
  }

  if (axes.length < 3)
    return fail(
      header,
      'a radar needs at least 3 axes. Add lines such as `axis a["Speed"], b, c`.',
    );

  if (pending.length === 0)
    return fail(header, 'the radar has no curves. Add lines such as `curve x["Name"]{1, 2, 3}`.');

  for (const c of pending) {
    const values = valuesOf(c.l, c.id, c.body, axes);
    curves.push({ id: c.id, label: c.label, values, source: sourceOf(c.l) });
  }

  const top = max ?? Math.max(...curves.flatMap((c) => c.values));

  if (!(top > min))
    return fail(
      header,
      `max ${top} is not above min ${min}. Set \`max\` higher, or give a curve a value above min.`,
    );

  return {
    kind: "radar",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    axes,
    curves,
    ...(max !== undefined && { max }),
    min,
    ticks,
    graticule,
    showLegend,
  };
};

export const drawRadar = (
  doc: RadarDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Radar<string> =>
  radar(
    {
      ...(doc.title !== undefined && { title: doc.title }),
      axes: doc.axes.map((a) => a.label),
      curves: Object.fromEntries(
        doc.curves.map((c) => [c.id, { label: c.label, values: c.values }]),
      ),
      ...(doc.max !== undefined && { max: doc.max }),
      min: doc.min,
      ticks: doc.ticks,
      graticule: doc.graticule,
      showLegend: doc.showLegend,
    },
    options,
  );
