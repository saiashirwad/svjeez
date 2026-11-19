import { xyChart, type DiagramOptions, type XyChart } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface XyAxisDoc {
  readonly title?: string;
}

export interface XyCategoryAxisDoc extends XyAxisDoc {
  readonly categories: readonly string[];
}

export interface XyRangeAxisDoc extends XyAxisDoc {
  readonly min: number;
  readonly max: number;
}

export interface XyValueAxisDoc extends XyAxisDoc {
  readonly min?: number;
  readonly max?: number;
}

export interface XySeriesDoc {
  readonly type: "bar" | "line";
  readonly label?: string;
  readonly values: readonly number[];
}

export interface XyChartDoc {
  readonly kind: "xychart";
  readonly source: Place;
  readonly title?: string;
  readonly horizontal: boolean;
  /** Absent when the chart numbers its points 1, 2, 3 and so on. */
  readonly xAxis?: XyCategoryAxisDoc | XyRangeAxisDoc;
  readonly yAxis: XyValueAxisDoc;
  readonly series: readonly XySeriesDoc[];
}

const SUPPORTED =
  'Supported: `title "Sales"`, `x-axis [jan, feb, mar]` or `x-axis Month 1 --> 12`, `y-axis "Revenue" 0 --> 100`, and series `bar [1, 2, 3]` or `line "Name" [1, 2, 3]`.';

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const NUMERIC = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;

const AXIS = new RegExp(
  String.raw`^(?:"([^"]*)"|(.*?))\s*(?:(\[.*\])|(${NUMERIC})\s*-->\s*(${NUMERIC}))?$`,
);

const SERIES = /^(bar|line)\s*(?:"([^"]*)"|([^[\s][^[]*?))?\s*\[(.*)\]$/;
const HEADER = /^(xychart-beta|xychart)(?:\s+(horizontal|vertical))?$/;
const UNSUPPORTED = /^(accTitle|accDescr)\b/;

const listOf = (l: Line, inner: string): string[] =>
  inner.split(",").map((item) => {
    const t = item.trim();

    if (t === "") return fail(l, "a list has an empty item. Remove the extra comma.");

    return clean(unquote(t));
  });

const axisOf = (l: Line, word: string, rest: string) => {
  const m = AXIS.exec(rest);

  if (!m) return fail(l, `cannot read this ${word}. ${SUPPORTED}`);
  const title = clean(m[1] ?? m[2] ?? "");

  return {
    title: title === "" ? undefined : title,
    list: m[3] === undefined ? undefined : listOf(l, m[3].slice(1, -1)),
    range: m[4] === undefined ? undefined : ([Number(m[4]), Number(m[5])] as const),
  };
};

export const parseXyChart = (header: Line, body: readonly Line[]): XyChartDoc => {
  const head = HEADER.exec(header.text);

  if (!head)
    return fail(
      header,
      "the header is `xychart-beta` or `xychart`, optionally followed by `horizontal`.",
    );
  let title: string | undefined;
  let xAxis: XyChartDoc["xAxis"];
  let yAxis: XyValueAxisDoc = {};
  const series: XySeriesDoc[] = [];
  const at: Line[] = [];

  for (const l of body) {
    if (UNSUPPORTED.test(l.text))
      fail(l, "accessibility text is not drawn by svjeez. Remove the line.");
    const titled = /^title(?:\s+(.*))?$/.exec(l.text);

    if (titled) {
      title = clean(unquote(titled[1] ?? ""));

      if (!title) fail(l, "a title needs text after it.");
      continue;
    }

    const axis = /^(x-axis|y-axis)(?:\s+(.*))?$/.exec(l.text);

    if (axis) {
      const word = axis[1]!;
      const a = axisOf(l, word, axis[2] ?? "");
      const named = a.title === undefined ? {} : { title: a.title };

      if (word === "x-axis") {
        if (a.list !== undefined) {
          if (a.list.length === 0) fail(l, "the category list is empty.");
          xAxis = { ...named, categories: a.list };
        } else if (a.range !== undefined) {
          if (!(a.range[0] < a.range[1]))
            fail(
              l,
              `the range ${a.range[0]} --> ${a.range[1]} must run from a smaller to a larger number.`,
            );
          xAxis = { ...named, min: a.range[0], max: a.range[1] };
        } else
          fail(
            l,
            "the x-axis needs categories `[a, b, c]` or a range `1 --> 10`. A title alone has nothing to draw.",
          );
      } else {
        if (a.list !== undefined)
          fail(l, "the y-axis is numeric: write a range such as `y-axis Sales 0 --> 100`.");

        if (a.range !== undefined && !(a.range[0] < a.range[1]))
          fail(
            l,
            `the range ${a.range[0]} --> ${a.range[1]} must run from a smaller to a larger number.`,
          );
        yAxis = {
          ...named,
          ...(a.range && { min: a.range[0], max: a.range[1] }),
        };
      }

      continue;
    }

    const s = SERIES.exec(l.text);

    if (!s) fail(l, `cannot read this line. ${SUPPORTED}`);
    const [, type, quoted, bare, inner = ""] = s!;
    const label = clean(quoted ?? bare ?? "");

    const values = listOf(l, inner).map((v) => {
      if (!NUMBER.test(v)) return fail(l, `the value "${v}" is not a number.`);

      return Number(v);
    });

    at.push(l);
    series.push({
      type: type === "bar" ? "bar" : "line",
      ...(label !== "" && { label }),
      values,
    });
  }

  if (series.length === 0)
    return fail(header, "the chart has no series. Add lines such as `bar [1, 2, 3]`.");

  const wanted =
    xAxis && "categories" in xAxis ? xAxis.categories.length : series[0]!.values.length;

  const why =
    xAxis && "categories" in xAxis ? "one per x-axis category" : "as many as the first series";

  series.forEach((s, i) => {
    if (s.values.length !== wanted)
      fail(at[i]!, `this series has ${s.values.length} values but needs ${wanted}, ${why}.`);
  });

  return {
    kind: "xychart",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    horizontal: head[2] === "horizontal",
    ...(xAxis && { xAxis }),
    yAxis,
    series,
  };
};

export const drawXyChart = (
  doc: XyChartDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): XyChart =>
  xyChart(
    {
      title: doc.title,
      horizontal: doc.horizontal,
      x: doc.xAxis,
      y: doc.yAxis,
      series: doc.series,
    },
    options,
  );
