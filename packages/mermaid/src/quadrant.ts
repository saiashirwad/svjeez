import { quadrantChart, type DiagramOptions, type QuadrantChart } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import type { Color } from "svjeez/tools";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface QuadrantAxisDoc {
  readonly low: string;
  readonly high?: string;
}

export interface QuadrantPointDoc {
  readonly label: string;
  /** From 0 (left) to 1 (right). */
  readonly x: number;
  /** From 0 (bottom) to 1 (top). */
  readonly y: number;
  readonly radius?: number;
  readonly color?: Color;
}

export interface QuadrantDoc {
  readonly kind: "quadrant";
  readonly source: Place;
  readonly title?: string;
  readonly xAxis?: QuadrantAxisDoc;
  readonly yAxis?: QuadrantAxisDoc;
  readonly quadrants: {
    readonly topRight?: string;
    readonly topLeft?: string;
    readonly bottomLeft?: string;
    readonly bottomRight?: string;
  };
  readonly points: readonly QuadrantPointDoc[];
}

const SUPPORTED =
  "Supported: `title Text`, `x-axis Low --> High`, `y-axis Low --> High`, `quadrant-1 Text` (to `quadrant-4`), and points `Name: [0.3, 0.6]` with optional `radius: 8, color: #ff3300`.";

const QUADRANT_KEYS = ["topRight", "topLeft", "bottomLeft", "bottomRight"] as const;
const POINT = /^(?:"([^"]*)"|([^:[\]"]+?))\s*:\s*\[\s*([^,\]]*?)\s*,\s*([^,\]]*?)\s*\](.*)$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const UNSUPPORTED = /^(accTitle|accDescr)\b/;

const axisOf = (l: Line, word: string, text: string): QuadrantAxisDoc => {
  const [low = "", high, ...extra] = text.split("-->").map((t) => clean(unquote(t)));

  if (!low || extra.length > 0 || high === "")
    return fail(l, `${word} is written \`${word} Low --> High\` or just \`${word} Label\`.`);

  return high === undefined ? { low } : { low, high };
};

interface PointStyle {
  readonly radius?: number;
  readonly color?: Color;
}

const hexOf = (value: string): Color => {
  const digits = value.slice(1);
  const full = digits.length === 3 ? digits.replace(/./g, "$&$&") : digits;

  // SAFETY: COLOR admits only `#` followed by 3 or 6 hex digits.
  return `#${full.toLowerCase()}` as Color;
};

const styleOf = (l: Line, rest: string): PointStyle => {
  let radius: number | undefined;
  let color: Color | undefined;
  const text = rest.trim();

  for (const part of text === "" ? [] : text.split(",")) {
    const [key = "", value = "", ...more] = part.split(":").map((s) => s.trim());

    if (more.length > 0 || !key || !value)
      fail(l, "point styles are written `radius: 10, color: #ff3300`.");

    if (key === "radius") {
      if (!NUMBER.test(value) || Number(value) <= 0)
        fail(l, `the radius "${value}" must be a number above 0.`);
      radius = Number(value);
    } else if (key === "color") {
      if (!COLOR.test(value)) fail(l, `the color "${value}" must be a hex color such as #ff3300.`);
      color = hexOf(value);
    } else
      fail(
        l,
        `the point style "${key}" is not supported: svjeez draws only \`radius\` and \`color\`. Remove it.`,
      );
  }

  return { ...(radius !== undefined && { radius }), ...(color !== undefined && { color }) };
};

export const parseQuadrant = (header: Line, body: readonly Line[]): QuadrantDoc => {
  if (header.text !== "quadrantChart")
    fail(header, "the quadrantChart header takes no other words. Write it on its own line.");
  let title: string | undefined;
  let xAxis: QuadrantAxisDoc | undefined;
  let yAxis: QuadrantAxisDoc | undefined;
  const quadrants: { -readonly [K in (typeof QUADRANT_KEYS)[number]]?: string } = {};
  const points: QuadrantPointDoc[] = [];

  for (const l of body) {
    if (UNSUPPORTED.test(l.text))
      fail(l, "accessibility text is not drawn by svjeez. Remove the line.");

    if (/^classDef\b/.test(l.text) || l.text.includes(":::"))
      fail(l, "point classes are not supported. Write `radius` and `color` on each point instead.");
    const titled = /^title(?:\s+(.*))?$/.exec(l.text);

    if (titled) {
      title = clean(titled[1] ?? "");

      if (!title) fail(l, "a title needs text after it.");
      continue;
    }

    const axis = /^(x-axis|y-axis)(?:\s+(.*))?$/.exec(l.text);

    if (axis) {
      const doc = axisOf(l, axis[1]!, axis[2] ?? "");

      if (axis[1] === "x-axis") xAxis = doc;
      else yAxis = doc;
      continue;
    }

    const quad = /^quadrant-([1-4])(?:\s+(.*))?$/.exec(l.text);

    if (quad) {
      const text = clean(unquote(quad[2] ?? ""));

      if (!text) fail(l, "a quadrant label needs text after it.");
      quadrants[QUADRANT_KEYS[Number(quad[1]) - 1]!] = text;
      continue;
    }

    const p = POINT.exec(l.text);

    if (!p) fail(l, `cannot read this line. ${SUPPORTED}`);
    const [, quoted, bare, x = "", y = "", rest = ""] = p!;
    const label = clean(quoted ?? bare ?? "");

    if (!label) fail(l, "a point needs a name before its colon.");

    for (const [axisName, value] of [
      ["x", x],
      ["y", y],
    ] as const)
      if (!NUMBER.test(value) || Number(value) < 0 || Number(value) > 1)
        fail(l, `the ${axisName} position "${value}" must be a number from 0 to 1.`);

    if (points.some((q) => q.label === label))
      fail(l, `the point ${JSON.stringify(label)} is already there. Give each point its own name.`);
    points.push({ label, x: Number(x), y: Number(y), ...styleOf(l, rest) });
  }

  if (points.length === 0)
    return fail(header, "the chart has no points. Add lines such as `Campaign A: [0.3, 0.6]`.");

  return {
    kind: "quadrant",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    ...(xAxis && { xAxis }),
    ...(yAxis && { yAxis }),
    quadrants,
    points,
  };
};

export const drawQuadrant = (
  doc: QuadrantDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): QuadrantChart =>
  quadrantChart(
    {
      title: doc.title,
      xAxis: doc.xAxis,
      yAxis: doc.yAxis,
      quadrants: doc.quadrants,
      points: doc.points,
    },
    options,
  );
