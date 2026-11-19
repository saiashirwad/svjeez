import { SceneError } from "../model/scene-error";
import type { Font } from "../font/font";
import { blendNumber, valueAt } from "../model/sample";
import { isLane } from "../model/lane";
import { ease, type Seconds } from "../model/time";
import type {
  Animated,
  Box,
  Face,
  Geometry,
  Key,
  Paint,
  SceneNode,
  TextLine,
  TextNode,
  TextRun,
  Vec,
} from "../model/ir";
import type { Anim } from "./track";
import type { SceneElement, TextChild } from "./nodes";
import { layoutRuns, type TextAlign } from "./text";

export interface CountFormat {
  readonly decimals?: number;
  readonly separator?: string;
  readonly point?: string;
  readonly pad?: number;
  readonly rate?: number;
}

export interface Count {
  readonly kind: "count";
  readonly value: Anim<number>;
  readonly format: CountFormat;
}

export type TextContent = TextChild | Count | readonly TextContent[];

export const count = (value: Anim<number>, format: CountFormat = {}): Count => ({
  kind: "count",
  value,
  format,
});

export const isCount = (value: unknown): value is Count =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "count";

export type Format = Required<CountFormat>;

const DIGITS = "0123456789";

const whole = (value: number, from: number, to: number): boolean =>
  Number.isInteger(value) && value >= from && value <= to;

const mark = (value: string): boolean =>
  [...value].length === 1 && !DIGITS.includes(value) && value !== "-" && !/\s/.test(value);

export const formatOf = (format: CountFormat, where: string): Format => {
  const { decimals = 0, separator = ",", point = ".", pad = 1, rate = 30 } = format;

  if (!whole(decimals, 0, 10))
    throw new SceneError(`count() in ${where} takes decimals from 0 to 10, got ${decimals}.`);

  if (!whole(pad, 1, 20))
    throw new SceneError(`count() in ${where} takes a pad of 1 to 20 digits, got ${pad}.`);

  if (!(rate > 0 && Number.isFinite(rate)))
    throw new SceneError(
      `count() in ${where} needs a positive rate, the most times a second the number changes, got ${rate}.`,
    );

  if (separator !== "" && separator !== " " && !mark(separator))
    throw new SceneError(
      `count() in ${where} groups thousands with one character that isn't a digit or a minus sign, got ${JSON.stringify(separator)}.`,
      'Write separator="," or separator=" ", or separator="" for none.',
    );

  if (!mark(point))
    throw new SceneError(
      `count() in ${where} marks its decimals with one character that isn't a digit or a minus sign, got ${JSON.stringify(point)}.`,
    );

  if (point === separator)
    throw new SceneError(
      `count() in ${where} marks its decimals with ${JSON.stringify(point)} and groups thousands with it too, so the two can't be told apart.`,
      `Give it another separator, as in { point: ${JSON.stringify(point)}, separator: ${JSON.stringify(point === "." ? "," : ".")} }.`,
    );

  return { decimals, separator, point, pad, rate };
};

export const formatted = (value: number, format: Format): string => {
  const [int = "", frac] = Math.abs(value).toFixed(format.decimals).split(".");
  const digits = int.padStart(format.pad, "0");

  const grouped = format.separator ? digits.replace(/\B(?=(\d{3})+$)/g, format.separator) : digits;

  const body = frac === undefined ? grouped : `${grouped}${format.point}${frac}`;

  return value < 0 && /[1-9]/.test(body) ? `-${body}` : body;
};

export interface Counting {
  readonly before: string;
  readonly count: Count;
  readonly after: string;
}

const isList = (content: TextContent): content is readonly TextContent[] => Array.isArray(content);

const isWords = (content: TextContent): content is string | number =>
  typeof content === "string" || typeof content === "number";

const isWord = (item: string | Count | SceneElement): item is string => typeof item === "string";

const flatten = (content: TextContent): (string | Count | SceneElement)[] => {
  if (content === undefined || content === null || content === false) return [];

  if (isList(content)) return content.flatMap(flatten);

  if (isWords(content)) return [String(content)];

  return [content];
};

export const countingIn = (content: TextContent, where: string): Counting | undefined => {
  const items = flatten(content);
  const counts = items.filter(isCount);

  if (counts.length === 0) return undefined;

  if (counts.length > 1)
    throw new SceneError(
      `${where} holds ${counts.length} count()s, and a <Text> counts one number.`,
      'Give each number a <Text> of its own, side by side in a <Stack direction="row">.',
    );

  if (items.some((item) => !isWord(item) && !isCount(item)))
    throw new SceneError(
      `${where} counts, so it holds strings around its count() and no <Run>s.`,
      "Style the whole <Text>, or put the styled words in a <Text> beside it.",
    );
  const at = items.indexOf(counts[0]!);
  const words = (part: readonly (string | Count | SceneElement)[]) => part.join("");
  const [before, after] = [words(items.slice(0, at)), words(items.slice(at + 1))];

  if (/\n/.test(before + after))
    throw new SceneError(
      `${where} counts, and a counting <Text> draws one line, but its words hold a line break.`,
      "Put the other lines in a <Text> of their own.",
    );

  return { before, count: counts[0]!, after };
};

export interface Tick {
  readonly t: Seconds;
  readonly text: string;
}

const FINE = 1 / 1000;

const later = (t: Seconds): Seconds => Math.ceil(t * 1e4 - 1e-6) / 1e4;

export const ticksOf = (
  value: Animated<number>,
  duration: Seconds,
  format: Format,
  where: string,
): Tick[] => {
  const show = (t: Seconds): string => {
    const at = valueAt(value, t, blendNumber);

    if (!Number.isFinite(at))
      throw new SceneError(
        `count() in ${where} reads ${at} at ${Math.round(t * 1000) / 1000}s, which isn't a number it can show.`,
      );

    return formatted(at, format);
  };

  const ticks: Tick[] = [{ t: 0, text: show(0) }];

  if (!isLane(value)) return ticks;
  const gap = 1 / format.rate;
  let t = later(gap);

  while (t < duration) {
    const last = ticks.at(-1)!.text;

    if (show(t) !== last) {
      ticks.push({ t, text: show(t) });
      t = later(t + gap);
      continue;
    }

    let [a, b] = [t, t + FINE];

    while (b < duration && show(b) === last) [a, b] = [b, b + FINE];

    if (b >= duration) break;

    for (let i = 0; i < 24; i++) {
      const mid = (a + b) / 2;

      if (show(mid) === last) a = mid;
      else b = mid;
    }

    const at = later(b);

    if (at >= duration) break;
    ticks.push({ t: at, text: show(at) });
    t = later(at + gap);
  }

  const final = show(duration - FINE / 10);
  const last = ticks.at(-1)!;

  if (final === last.text) return ticks;
  const at = Math.min(later(last.t + gap), Math.floor((duration - FINE) * 1e4) / 1e4);

  if (at > last.t) return [...ticks, { t: at, text: final }];

  return [...ticks.slice(0, -1), { t: last.t, text: final }];
};

export interface CountLook {
  readonly key: string;
  readonly where: string;
  readonly font: Font;
  readonly face: Face;
  readonly size: number;
  readonly align: TextAlign;
  readonly fill: (box: Box) => Animated<Paint>;
}

export interface Counted {
  readonly box: Box;
  readonly baseline: number;
  readonly node: SceneNode;
}

const rounded = (n: number): number => Math.round(n * 1000) / 1000 || 0;

const sum = (values: readonly number[]): number => values.reduce((total, each) => total + each, 0);

const placed = (ticks: readonly Tick[], place: (text: string) => Vec): Animated<Vec> => {
  const keys: Key<Vec>[] = [];

  for (const { t, text } of ticks) {
    const [x, y] = place(text);
    const value: Vec = [rounded(x), rounded(y)];
    const last = keys.at(-1);

    if (last && last.value[0] === value[0] && last.value[1] === value[1]) continue;
    keys.push(last ? { t, value, ease: ease.hold } : { t, value });
  }

  const [first, second, ...rest] = keys;

  return second ? { kind: "lane", keys: [first!, second, ...rest] } : first!.value;
};

export const countedNodes = (
  look: CountLook,
  { before, after }: Counting,
  ticks: readonly Tick[],
): Counted => {
  const { key, where, font, face, size, align, fill } = look;
  const width = (text: string): number => font.measure(text, size);

  const laid = (text: string) =>
    layoutRuns(font, [{ text, face: font, style: undefined }], { size }, where);

  const probe = laid("0");
  const top = probe.lines[0]!.at[1];
  const height = probe.box.height;
  const step = Math.ceil(height + size / 2);

  const digit = Math.max(...[...DIGITS].map(width));
  const texts = [...new Set(ticks.map((tick) => tick.text))];
  const reversed = new Map(texts.map((text) => [text, [...text].reverse()]));
  const columns = Math.max(...texts.map((text) => reversed.get(text)!.length));

  const strips = Array.from({ length: columns }, (_, j) =>
    [...new Set(texts.flatMap((text) => reversed.get(text)![j] ?? []))].sort(),
  );

  const widths = strips.map((chars) =>
    Math.max(
      ...chars.map((char) => (/[0-9-]/.test(char) ? Math.max(digit, width(char)) : width(char))),
    ),
  );

  const [lead, tail] = [width(before), width(after)];
  const full = lead + sum(widths) + tail;
  const right = full - tail;
  const share = { start: 0, center: 0.5, end: 1 }[align];

  const lefts = widths.map((_, j) => right - sum(widths.slice(0, j + 1)));
  const numberWidth = (text: string): number => sum(widths.slice(0, reversed.get(text)!.length));

  const shift = (text: string): number => -(full - (lead + numberWidth(text) + tail)) * (1 - share);
  const box: Box = { x: 0, y: 0, width: full, height };
  const paint = fill(box);

  const node = (
    part: string,
    lines: readonly TextLine[],
    at: Animated<Vec>,
    own: Box,
  ): TextNode => ({
    kind: "text",
    key: `${key}/${part}`,
    box: own,
    at,
    origin: [0, 0],
    layers: [],
    effects: [],
    size,
    lines,
  });

  const linesOf = (text: string, y: number, dx: number): TextLine[] =>
    laid(text).lines.map((line) => ({
      at: [line.at[0] + dx, line.at[1] + y],
      runs: line.runs.map((run): TextRun => ({
        text: run.text,
        at: [run.at[0] + dx, run.at[1] + y],
        advances: run.advances,
        face,
        fill: paint,
        ...(run.outline && { outline: run.outline }),
      })),
    }));

  const digits = strips.flatMap((chars, j) => {
    if (!chars.some((char) => char.trim())) return [];

    const lines = chars.flatMap((char, r) =>
      char.trim() ? linesOf(char, r * step, lefts[j]! + (widths[j]! - width(char)) / 2) : [],
    );

    const at = placed(ticks, (text) => {
      const char = reversed.get(text)![j];

      return [0, -(char === undefined ? chars.length : chars.indexOf(char)) * step];
    });

    return [
      node(String(j), lines, at, {
        x: lefts[j]!,
        y: 0,
        width: widths[j]!,
        height: (chars.length - 1) * step + height,
      }),
    ];
  });

  const words = [
    ...(before.trim()
      ? [
          node(
            "before",
            linesOf(before, 0, 0),
            placed(ticks, (text) => [right - numberWidth(text) - lead + shift(text), 0]),
            { x: 0, y: 0, width: lead, height },
          ),
        ]
      : []),
    ...(after.trim()
      ? [
          node(
            "after",
            linesOf(after, 0, right),
            placed(ticks, (text) => [shift(text), 0]),
            { x: right, y: 0, width: tail, height },
          ),
        ]
      : []),
  ];

  const [across, down] = [size, size / 4];

  const clip: Geometry = {
    kind: "points",
    points: [
      [-across, -down],
      [full + across, -down],
      [full + across, height + down],
      [-across, height + down],
    ],
    closed: true,
  };

  return {
    box,
    baseline: top,
    node: {
      kind: "group",
      key: `${key}/digits`,
      box,
      at: [0, 0],
      origin: [0, 0],
      layers: [],
      effects: [],
      clip,
      children: [
        {
          kind: "group",
          key: `${key}/number`,
          box,
          at: placed(ticks, (text) => [shift(text), 0]),
          origin: [0, 0],
          layers: [],
          effects: [],
          children: digits.reverse(),
        },
        ...words,
      ],
    },
  };
};
