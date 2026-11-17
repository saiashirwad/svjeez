/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { render, valuesAt, type SvgNode } from "svjeez";
import {
  Dom,
  type Box,
  type Item,
  type Shadow,
  type Snapshot,
  type TextRun,
} from "../src/index.ts";

// Browsers start SMIL's clock apart from CSS's (WebKit by ~50ms, Chromium by a frame when the page is busy), and
// seeking hides it, since a seek sets both. So parts of one moving thing must never be split between the two.

const run = (text: string, x: number, y: number): TextRun => ({
  kind: "text",
  text,
  x,
  y,
  size: 16,
  weight: 400,
  family: "sans-serif",
  style: "normal",
  color: "rgb(17,17,17)",
  letterSpacing: 0,
  advances: [...text].map((_, i) => (i + 1) * 9),
});

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  children: Item[] = [],
  extra: Partial<Box> = {},
): Box => ({
  kind: "box",
  tag: "div",
  box: { x, y, width, height },
  radii: [8, 8, 8, 8],
  background: "rgb(255,255,255)",
  shadows: [],
  opacity: 1,
  clip: false,
  children,
  ...extra,
});

const page = (children: Item[]): Snapshot => {
  const root = box(0, 0, 400, 300, children, { background: "rgb(240,240,240)" });

  return { width: 400, height: 300, pad: 0, box: root.box, root };
};

const lifted: Shadow = { color: "rgba(0,0,0,0.3)", x: 0, y: 6, blur: 16, spread: 0 };

/** A card with a title and a pill, at `(x, y)`; lifted, it casts a shadow and tints. */
const card = (x: number, y: number, lift: boolean) =>
  box(
    x,
    y,
    160,
    60,
    [
      run("Card", x + 12, y + 24),
      box(x + 12, y + 34, 60, 18, [run("Pill", x + 20, y + 48)], {
        background: "rgb(230,230,250)",
      }),
    ],
    {
      key: "card",
      shadows: lift ? [lifted] : [],
      background: lift ? "rgb(250,250,250)" : "rgb(255,255,255)",
    },
  );

/** Every mark's own place and how far its groups have moved it at `t`, with whether it morphs its outline. */
const marks = (
  node: SvgNode,
  t: number,
  at = { x: 0, y: 0 },
): { tag: string; x: number; y: number; dx: number; dy: number }[] => {
  if (node.kind === "fragment") return node.children.flatMap((c) => marks(c, t, at));

  if (node.kind !== "element") return [];

  const moved = node.motions.reduce(
    (p, m) => {
      const v = valuesAt(m, t, { duration: 2 });

      return { x: p.x + (v.x ?? 0), y: p.y + (v.y ?? 0) };
    },
    { ...at },
  );

  if (node.tag === "text")
    return [
      { tag: "text", x: Number(node.attrs.x), y: Number(node.attrs.y), dx: moved.x, dy: moved.y },
    ];

  if (node.tag === "path") {
    const [x, y] = String(node.attrs.d)
      .slice(1)
      .split(/[ A-Z]/)
      .map(Number);

    return [{ tag: "path", x: x!, y: y!, dx: moved.x, dy: moved.y }];
  }

  return node.children.flatMap((c) => marks(c, t, moved));
};

describe("one clock for one moving thing", () => {
  test("a box that moves and changes carries everything in it as one group", () => {
    const node = (
      <Dom states={[page([card(20, 20, false)]), [page([card(200, 140, true)]), { over: 1 }]]} />
    );

    // Whatever lands inside the card moves by the same amount at every moment.
    for (const t of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
      const inside = marks(node, t).filter(
        (m) => m.x >= 200 && m.x <= 360 && m.y >= 140 && m.y <= 200,
      );

      const moves = new Set(inside.map((m) => `${m.dx.toFixed(2)},${m.dy.toFixed(2)}`));

      expect(inside.length).toBeGreaterThan(2);
      expect([...moves]).toHaveLength(1);
    }

    // And no outline in it moves on SMIL's clock: a `d` that changes place would run apart from the group.
    const svg = render({ width: 400, height: 300, duration: 2, title: "card" }, node);

    for (const [, values] of svg.matchAll(/<animate [^>]*attributeName="d" values="([^"]*)"/g)) {
      const starts = new Set(values!.split(";").map((d) => d.match(/^M[-\d.]+ [-\d.]+/)![0]));

      expect([...starts]).toHaveLength(1);
    }
  });

  test("typed text and its caret step on the same keyframes, in CSS", () => {
    const field = (children: Item[]) =>
      page([box(20, 20, 300, 40, children, { tag: "input", key: "field" })]);

    const svg = render(
      { width: 400, height: 300, duration: 2, title: "typing" },
      <Dom states={[field([]), [field([run("Hello", 30, 45)]), { over: 1 }]]} />,
    );

    // The reveal doesn't animate `width`, which only SMIL can do in every browser.
    expect(svg).not.toMatch(/attributeName="width"/);

    // The clip's edge and the caret are both translated, at the same moments.
    const stops = [...svg.matchAll(/@keyframes [\w-]+\{([^@]*?translate[^@]*?)\}\}/g)].map((m) =>
      [...m[1]!.matchAll(/([\d.,%]+)\{translate/g)].map((s) => s[1]).join(" "),
    );

    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(new Set(stops).size).toBe(1);

    // At every keystroke the clip's right edge is where the caret is.
    const edges = [...svg.matchAll(/@keyframes [\w-]+\{([^@]*?translate[^@]*?)\}\}/g)].map((m) =>
      [...m[1]!.matchAll(/translate:(-?[\d.]+)px/g)].map((s) => Number(s[1])),
    );

    const clip = svg.match(/<clipPath[^>]*>\s*<rect x="([-\d.]+)"[^>]*width="([\d.]+)"/)!;
    const right = Number(clip[1]) + Number(clip[2]);

    const caret = svg.match(
      /<rect x="([\d.]+)" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="rgb\(17,17,17\)"/,
    )!;

    const [a, b] = edges;
    const caretXs = (a![a!.length - 1]! > b![b!.length - 1]! ? b : a)!;
    const clipXs = (caretXs === a ? b : a)!;

    caretXs
      .slice(0, -1)
      .forEach((x, i) => expect(right + clipXs[i]!).toBeCloseTo(Number(caret[1]) + x, 2));
  });
});

describe("a box going see-through", () => {
  test("fades where it was instead of sliding to where it can't be seen", () => {
    const button = (y: number, opacity: number) =>
      page([box(20, y, 16, 16, [], { key: "add", opacity, background: "rgb(200,200,200)" })]);

    const node = <Dom states={[button(40, 0.5), [button(68, 0), { over: 1 }]]} />;

    for (const t of [0, 0.3, 0.6, 0.9])
      for (const m of marks(node, t).filter((m) => m.tag === "path" && m.x > 10 && m.x < 50))
        expect(m.y + m.dy).toBe(40);
  });
});
