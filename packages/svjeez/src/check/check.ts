import type { Seconds } from "../model/time";
import type { Source } from "../model/ir";
import type { Code, Problem } from "./inspect-context";
import { openScene, type SceneOptions } from "../frames";
import {
  measure,
  setup,
  sweep,
  type PageBox,
  type PageElement,
  type PageSeries,
} from "./check-page";

interface Found extends Problem {
  readonly element: string;
  /** The `data-source` text the problem was read from, for grouping. */
  readonly at?: string;
}

export interface CheckOptions extends SceneOptions {
  readonly times?: readonly Seconds[];
  readonly cues?: readonly Seconds[];
}

export interface PixelReport {
  readonly duration: Seconds;
  readonly times: readonly Seconds[];
  readonly problems: Problem[];
}

const sourceOf = (text: string | undefined): Source | undefined => {
  const match = text === undefined ? null : /^(.*?):(\d+)(?::(\d+))?$/.exec(text);

  return match
    ? {
        file: match[1] ?? "",
        line: Number(match[2]),
        ...(match[3] !== undefined && { column: Number(match[3]) }),
      }
    : undefined;
};

const SWEEP = 96;

const SLACK = 1;

const HOLD = 0.1;

const round = (time: Seconds): Seconds => Number(time.toFixed(3));

const kindOf = (tag: string): string =>
  tag === "text" ? "text" : tag === "image" ? "picture" : "shape";

const name = (element: PageElement): string =>
  element.key !== undefined
    ? `${kindOf(element.tag)} "${element.key}"${element.text === undefined ? "" : ` ("${element.text}")`}`
    : element.text === undefined
      ? `<${element.tag}>`
      : `<text "${element.text.length >= 40 ? `${element.text}…` : element.text}">`;

const list = (times: readonly Seconds[]): string =>
  times.map((time) => `${round(time)}s`).join(", ");

const area = (b: PageBox): number => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);

const overlapArea = (a: PageBox, b: PageBox): number =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

const visible = (b: PageBox): boolean => b[5] === 1 && b[4] > 0.05;

const sampleTimes = (duration: Seconds): Seconds[] => [
  ...Array.from({ length: 8 }, (_, i) => (i * duration) / 8),
  duration - Math.min(0.05, duration / 100),
];

export const checkPixels = async (
  svg: string,
  options: CheckOptions = {},
): Promise<PixelReport> => {
  for (const time of options.times ?? options.cues ?? [])
    if (!(Number.isFinite(time) && time >= 0))
      throw new Error(`checkPixels() needs finite, non-negative times, got ${time}.`);

  if (options.times?.length === 0)
    throw new Error("checkPixels() needs at least one time, got an empty list.");

  const scene = await openScene(svg, options, "checkPixels()");

  try {
    const { duration } = scene;
    const page = await scene.evaluate(setup, undefined);

    const times = options.times
      ? [...new Set(options.times)]
      : [...new Set([...sampleTimes(duration), ...(options.cues ?? [])])]
          .filter((time) => time >= 0 && (time < duration || time === 0))
          .sort((a, b) => a - b);

    const step = Math.min(0.05, duration / 100);
    const boxes: PageBox[][] = [];

    for (const time of times)
      boxes.push(
        await scene.evaluate(measure, { time, before: time >= step ? time - step : time + step }),
      );

    const seamBefore = Math.max(0, duration - step);

    const seamTimes = [
      Math.max(0, duration - 3 * step),
      Math.max(0, duration - 2 * step),
      seamBefore,
      duration,
    ];

    const edges: PageBox[][] = [];

    for (const time of seamTimes) edges.push(await scene.evaluate(measure, { time, before: time }));

    const series =
      duration > 0 ? await scene.evaluate(sweep, { duration, steps: SWEEP, within: HOLD }) : [];

    const findings: Found[] = [
      ...offCanvas(page.leaves, boxes, times, page),
      ...textOverflow(page.leaves, boxes, times, page),
      ...overlap(page.leaves, boxes, times),
      ...still(page.animated, series),
      ...visibleAtZero(page.animated, series, duration),
      ...seam(page.leaves, edges, seamBefore, page, duration),
    ];

    return {
      duration,
      times,
      problems: group(findings).map(plain),
    };
  } finally {
    await scene.close();
  }
};

const plain = (found: Found): Problem => ({
  code: found.code,
  severity: found.severity,
  key: found.key,
  ...(found.source && { source: found.source }),
  message: found.message,
  fix: found.fix,
  ...(found.times && { times: found.times }),
});

const group = (findings: readonly Found[]): Found[] => {
  const groups = new Map<string, { first: Found; count: number; times: Set<Seconds> }>();

  for (const found of findings) {
    const key =
      found.at && found.code !== "overlap" ? `${found.code} ${found.at}` : `${groups.size}`;

    const known = groups.get(key);

    if (known) {
      known.count++;

      for (const time of found.times ?? []) known.times.add(time);
    } else groups.set(key, { first: found, count: 1, times: new Set(found.times ?? []) });
  }

  return [...groups.values()]
    .map(({ first, count, times }) => ({
      ...first,
      ...(times.size > 0 && { times: [...times].sort((a, b) => a - b) }),
      message:
        count > 1
          ? first.message.replace(
              first.element,
              `${first.element} and ${count - 1} more written here`,
            )
          : first.message,
    }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
};

type Canvas = { readonly width: number; readonly height: number };

const finding = (
  code: Code,
  severity: Problem["severity"],
  element: PageElement,
  times: readonly Seconds[],
  message: string,
  fix: string,
): Found => ({
  code,
  severity,
  key: element.key ?? "",
  ...(sourceOf(element.source) && { source: sourceOf(element.source) }),
  message,
  fix,
  ...(times.length > 0 && { times: times.map(round) }),
  element: name(element),
  ...(element.source && { at: element.source }),
});

const past = (b: PageBox, x0: number, y0: number, x1: number, y1: number) =>
  [x0 - b[0], y0 - b[1], b[2] - x1, b[3] - y1] as const;

const EDGES = ["left", "top", "right", "bottom"] as const;

const placed = (seen: readonly { readonly b: PageBox }[]): boolean =>
  seen.every(({ b }) => [0, 1, 2, 3].every((i) => Math.abs(b[i]! - seen[0]!.b[i]!) < 0.5));

const offCanvas = (
  leaves: readonly PageElement[],
  boxes: readonly PageBox[][],
  times: readonly Seconds[],
  { width, height }: Canvas,
): Found[] =>
  leaves.flatMap((leaf, index) => {
    const seen = times.flatMap((time, t) => {
      const b = boxes[t]?.[index];

      return b && visible(b) && area(b) > 0 ? [{ time, b }] : [];
    });

    if (seen.length === 0) return [];

    const outside = ({ b }: { b: PageBox }) =>
      b[2] <= 0 || b[3] <= 0 || b[0] >= width || b[1] >= height;

    if (seen.every((s) => outside(s) && s.b[6] === 1))
      return [
        finding(
          "off-canvas",
          "error",
          leaf,
          seen.map((s) => s.time),
          `${name(leaf)} is outside the ${width}x${height} canvas at every time it is visible (${list(seen.map((s) => s.time))}).`,
          "Move it onto the canvas, or remove it.",
        ),
      ];

    if (leaf.tag === "text" || leaf.soft) return [];

    const cut = seen.filter(({ b }) => {
      if (b[6] !== 1) return false;
      const w = b[2] - b[0];
      const h = b[3] - b[1];

      if (w >= width / 2 || h >= height / 2) return false;
      const [l, t, r, d] = past(b, 0, 0, width, height);
      const over = Math.max(l, r) / w > Math.max(t, d) / h ? Math.max(l, r) : Math.max(t, d);
      const size = Math.max(l, r) / w > Math.max(t, d) / h ? w : h;

      return over > SLACK && over < size / 4;
    });

    if (cut.length === 0 || !placed(seen)) return [];
    const b = cut[0]!.b;
    const sides = past(b, 0, 0, width, height);
    const edge = EDGES[sides.indexOf(Math.max(...sides))];

    return [
      finding(
        "off-canvas",
        "warning",
        leaf,
        cut.map((c) => c.time),
        `${name(leaf)} is cut off ${Math.round(Math.max(...sides))} past the ${edge} edge of the canvas while it rests (${list(cut.map((c) => c.time))}).`,
        "Move it inside, or let it bleed well past the edge if the crop is meant.",
      ),
    ];
  });

const textOverflow = (
  leaves: readonly PageElement[],
  boxes: readonly PageBox[][],
  times: readonly Seconds[],
  { width, height }: Canvas,
): Found[] =>
  leaves.flatMap((leaf, index) => {
    if (leaf.tag !== "text" || !leaf.text) return [];
    const canvas: Seconds[] = [];
    const boxed = new Map<number, Seconds[]>();

    const shown = times.flatMap((_, t) => {
      const b = boxes[t]?.[index];

      return b && visible(b) ? [{ b }] : [];
    });

    let worst = { by: 0, edge: "", of: "" };

    times.forEach((time, t) => {
      const b = boxes[t]?.[index];

      if (!b || !visible(b) || b[6] !== 1) return;
      const sides = past(b, 0, 0, width, height);
      const by = Math.max(...sides);

      if (by > SLACK && b[2] > 0 && b[3] > 0 && b[0] < width && b[1] < height) {
        if (!placed(shown)) return;
        canvas.push(time);

        if (by > worst.by) worst = { by, edge: EDGES[sides.indexOf(by)]!, of: "the canvas" };

        return;
      }

      const cx = (b[0] + b[2]) / 2;
      const cy = (b[1] + b[3]) / 2;
      let holder = -1;

      leaves.forEach((other, o) => {
        const r = boxes[t]?.[o];

        if (other.tag !== "rect" || other.order > leaf.order || !r || !visible(r) || r[6] !== 1)
          return;

        if (cx < r[0] || cx > r[2] || cy < r[1] || cy > r[3]) return;

        if (area(r) > (width * height) / 2 || r[3] - r[1] < (b[3] - b[1]) * 0.8) return;
        const held = boxes[t]?.[holder];

        if (!held || area(r) < area(held)) holder = o;
      });

      const r = boxes[t]?.[holder];

      if (!r) return;
      const sides2 = past(b, r[0], r[1], r[2], r[3]);
      const side = Math.max(sides2[0], sides2[2]);
      const margin = Math.max(2, (b[3] - b[1]) * 0.25);

      if (side <= margin) return;
      boxed.set(holder, [...(boxed.get(holder) ?? []), time]);

      if (side > worst.by)
        worst = {
          by: side,
          edge: sides2[0] > sides2[2] ? "left" : "right",
          of: `the ${name(leaves[holder]!)}${leaves[holder]!.source ? ` at ${leaves[holder]!.source}` : ""} it sits on`,
        };
    });

    const seen = [...canvas, ...[...boxed.values()].flat()].sort((a, b) => a - b);

    return seen.length === 0
      ? []
      : [
          finding(
            "text-overflow",
            "warning",
            leaf,
            [...new Set(seen)],
            `${name(leaf)} runs ${Math.round(worst.by)} past the ${worst.edge} edge of ${worst.of} (${list([...new Set(seen)])}).`,
            "Shorten it, shrink the font, or widen what holds it.",
          ),
        ];
  });

const ink = (b: PageBox): PageBox => {
  const h = b[3] - b[1];

  return [b[0], b[1] + h * 0.25, b[2], b[3] - h * 0.25, b[4], b[5], b[6], b[7], b[8], b[9]];
};

const overlap = (
  leaves: readonly PageElement[],
  boxes: readonly PageBox[][],
  times: readonly Seconds[],
): Found[] => {
  const texts = leaves.flatMap((leaf, index) =>
    leaf.tag === "text" && leaf.text && !leaf.masked ? [index] : [],
  );

  const pairs = new Map<string, Seconds[]>();

  times.forEach((time, t) => {
    const row = boxes[t] ?? [];

    const covers = leaves.flatMap((leaf, index) => {
      const b = row[index];

      return leaf.tag !== "text" && b && visible(b) && b[4] > 0.95
        ? [{ order: leaf.order, b }]
        : [];
    });

    const covered = (lower: number, upper: number, b: PageBox) =>
      covers.some(
        (cover) =>
          cover.order > leaves[lower]!.order &&
          cover.order < leaves[upper]!.order &&
          overlapArea(cover.b, b) > 0.8 * area(b),
      );

    for (let i = 0; i < texts.length; i++) {
      const a = row[texts[i]!];

      if (!a || !visible(a) || a[6] !== 1) continue;

      for (let j = i + 1; j < texts.length; j++) {
        const b = row[texts[j]!];

        if (!b || !visible(b) || b[6] !== 1) continue;

        if (leaves[texts[i]!]!.text === leaves[texts[j]!]!.text) continue;
        const shared = overlapArea(ink(a), ink(b));

        if (shared <= 0.3 * Math.min(area(ink(a)), area(ink(b)))) continue;

        const [lower, upper] =
          leaves[texts[i]!]!.order < leaves[texts[j]!]!.order
            ? [texts[i]!, texts[j]!]
            : [texts[j]!, texts[i]!];

        if (covered(lower, upper, row[lower]!)) continue;
        const key = `${texts[i]}:${texts[j]}`;
        pairs.set(key, [...(pairs.get(key) ?? []), time]);
      }
    }
  });

  return [...pairs].map(([key, seen]) => {
    const [i, j] = key.split(":").map(Number);
    const a = leaves[i!]!;
    const b = leaves[j!]!;

    return finding(
      "overlap",
      "warning",
      a,
      seen,
      `${name(a)} and ${name(b)}${b.source ? ` at ${b.source}` : ""} overlap while both are visible (${list(seen)}).`,
      "Move one, or hide one while the other shows.",
    );
  });
};

const still = (animated: readonly PageElement[], series: readonly PageSeries[]): Found[] =>
  animated.flatMap((element, index) =>
    series[index]?.empty
      ? [
          finding(
            "static",
            "warning",
            element,
            [],
            `${name(element)} carries an animation but draws nothing at any time in the loop.`,
            "Attach the motion to the element you see, or give this one content.",
          ),
        ]
      : series[index] && !series[index].changes && !series[index].shownThroughout
        ? [
            finding(
              "static",
              "warning",
              element,
              [],
              `${name(element)} carries an animation, yet none of its animated values change across the loop.`,
              "The motion is not attached to what moves, its values never differ, or it starts after the scene's duration.",
            ),
          ]
        : [],
  );

const visibleAtZero = (
  animated: readonly PageElement[],
  series: readonly PageSeries[],
  duration: Seconds,
): Found[] =>
  animated.flatMap((element, index) => {
    const s = series[index];

    if (!s || s.shown <= 0.05) return [];
    const at = (step: number) => round((step * duration) / s.opacity.length);
    const { opacity, drawn } = s;

    const cut = opacity.findIndex(
      (value, i) => i > 0 && value <= 0.05 && (opacity[i - 1] ?? 0) > 0.5,
    );

    const rise = cut > 0 ? opacity.findIndex((value, i) => i > cut && value >= 0.5) : -1;

    if (s.hold !== undefined && s.hold < HOLD && rise > 0)
      return [
        finding(
          "visible-at-zero",
          "error",
          element,
          [0],
          `${name(element)} shows from 0s, cuts to hidden at ${at(cut)}s, and comes straight back in by ${at(rise)}s.`,
          "Start it hidden, as in opacity={track(0).to(1, span(…))}, or bring it in with enter().",
        ),
      ];

    const full = drawn.findIndex((value) => value >= 0.99);

    if ((drawn[0] ?? 1) <= 0.01 && full > 0 && s.filled)
      return [
        finding(
          "visible-at-zero",
          "error",
          element,
          [0],
          `${name(element)} has its fill showing at 0s while its stroke only draws in by ${at(full)}s.`,
          "Leave the fill off, or fade the fill in after the draw.",
        ),
      ];

    return [];
  });

const seam = (
  leaves: readonly PageElement[],
  [first, earlier, end, start]: readonly (readonly PageBox[])[],
  before: Seconds,
  { width, height }: Canvas,
  duration: Seconds,
): Found[] => {
  const seen = (b: PageBox | undefined): b is PageBox =>
    b !== undefined && visible(b) && b[2] > 0 && b[3] > 0 && b[0] < width && b[1] < height;

  const KEYS = [7, 8, 9, 4] as const;
  const groups = new Map<string, { index: number; guess: number[] }[]>();

  leaves.forEach((leaf, index) => {
    const [w, e, a, z] = [first?.[index], earlier?.[index], end?.[index], start?.[index]];

    if (leaf.masked || !seen(w) || !seen(e) || !seen(a) || !seen(z)) return;
    const cycles = leaf.cycle === undefined ? 0 : duration / leaf.cycle;

    if (cycles > 1.5 && Math.abs(cycles - Math.round(cycles)) < 0.01) return;

    if (KEYS.some((k) => Math.abs(a[k] - 2 * e[k] + w[k]) > (k === 4 ? 0.1 : 1))) return;
    const key = leaf.source ?? `#${index}`;
    groups.set(key, [
      ...(groups.get(key) ?? []),
      { index, guess: KEYS.map((k) => 2 * a[k] - e[k]) },
    ]);
  });

  return [...groups.values()].flatMap((group) =>
    group.flatMap(({ index }) => {
      const z = start?.[index];

      if (!z) return [];
      let best = { shift: Infinity, fade: Infinity };

      for (const { guess } of group) {
        const shift = Math.max(...[0, 1, 2].map((i) => Math.abs((guess[i] ?? 0) - z[KEYS[i]!])));
        const fade = Math.abs((guess[3] ?? 0) - z[4]);

        if (Math.max(shift / 3, fade / 0.3) < Math.max(best.shift / 3, best.fade / 0.3))
          best = { shift, fade };
      }

      if (best.shift <= 3 && best.fade <= 0.3) return [];
      const leaf = leaves[index]!;
      const a = end?.[index];

      const what = [
        ...(best.shift > 3 ? [`moves ${Math.round(best.shift)}`] : []),
        ...(best.fade > 0.3
          ? [`jumps from opacity ${(a?.[4] ?? 0).toFixed(2)} to ${z[4].toFixed(2)}`]
          : []),
      ].join(" and ");

      return [
        finding(
          "loop-seam",
          "warning",
          leaf,
          [before, 0],
          `${name(leaf)} ${what} when the loop restarts, between ${round(before)}s and 0s.`,
          "End its motion where it starts (.rewind() closes a loop), or fade it out before the end.",
        ),
      ];
    }),
  );
};
