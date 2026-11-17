/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { font, motion, render, span, valuesAt, type SvgNode } from "svjeez";
import { typefaces } from "../src/draw/faces.ts";
import { hold } from "../src/draw/hold.ts";
import { drag, snap } from "../src/flow.ts";
import {
  Dom,
  type Box,
  type Item,
  type Shadow,
  type Snapshot,
  type TextRun,
} from "../src/index.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures", name));

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

/** Every state turns into the next over a second, a second apart. */
const film = (states: Snapshot[]) =>
  render(
    { width: 400, height: 300, duration: 2 * states.length, title: "hold" },
    <Dom states={states.map((s, i) => (i === 0 ? s : ([s, { over: 1 }] as const)))} />,
  );

const count = (svg: string, text: string) => svg.split(`>${text}</text>`).length - 1;

/** How much of `text` shows at `t`, for each copy drawn: every opacity above it, multiplied. */
const inkOf = (node: SvgNode, text: string, t: number, duration: number): number[] => {
  if (node.kind === "fragment") return node.children.flatMap((c) => inkOf(c, text, t, duration));

  if (node.kind !== "element") return [];

  const own =
    Number(node.attrs.opacity ?? 1) *
    node.motions.reduce((o, m) => o * (valuesAt(m, t, { duration }).opacity ?? 1), 1);

  if (node.tag === "text")
    return node.children.some((c) => c.kind === "text" && c.value === text) ? [own] : [];

  return node.children.flatMap((c) => inkOf(c, text, t, duration).map((o) => o * own));
};

describe("holding what doesn't change", () => {
  test("an element the same in every state is drawn once, and what changes is drawn per state", () => {
    const svg = film(
      ["one", "two", "three"].map((word) =>
        page([box(20, 20, 200, 40, [run("Static", 30, 45)]), run(word, 30, 100)]),
      ),
    );

    expect(count(svg, "Static")).toBe(1);
    // The word that changes fades in with one transition and out with the next.
    expect(count(svg, "two")).toBe(2);
  });

  test("a box that only moves is one element sliding, however many times it moves", () => {
    const svg = film(
      [20, 80, 140].map((y) => page([box(20, y, 200, 40, [run("Card", 30, y + 25)])])),
    );

    expect(count(svg, "Card")).toBe(1);
  });

  test("it never runs more animations than one drawing per transition", () => {
    const cut = (k: number) => ({ at: k, over: 1 });

    // Every transition moves one leaf among still ones, the worst case for holding.
    const drawings: SvgNode[] = [0, 1, 2, 3].map((k) => (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <text
            x={i * 20}
            y={10}
            animation={i === k ? motion({ opacity: 0 }).to({ opacity: 1 }, span(k, 1)) : undefined}
          >
            {String(i)}
          </text>
        ))}
      </g>
    ));

    const held = hold(drawings, drawings, (from) => cut(from), 4);

    const animations = (nodes: readonly SvgNode[]): number =>
      nodes.reduce(
        (n, c) => n + (c.kind === "element" ? c.motions.length + animations(c.children) : 0),
        0,
      );

    // One drawing per transition runs each one's motion, plus a cut for each.
    expect(animations(held)).toBeLessThanOrEqual(animations(drawings) + drawings.length);
    expect(held.length).toBeGreaterThan(0);
  });
});

describe("keys pair across parents", () => {
  const lanes = (into: 0 | 1) => {
    const card = box(30 + into * 180, 60, 140, 40, [run("Card", 40 + into * 180, 85)], {
      key: "card",
    });

    return page([
      box(20, 20, 160, 260, into === 0 ? [card] : [], { key: "todo" }),
      box(200, 20, 160, 260, into === 1 ? [card] : [], { key: "done" }),
    ]);
  };

  test("a keyed card that changes column slides there instead of fading", () => {
    const node = <Dom states={[lanes(0), [lanes(1), { over: 1 }]]} />;

    // Halfway through, one copy shows, whole.
    for (const t of [0.2, 0.5, 0.8])
      expect(inkOf(node, "Card", t, 2).filter((o) => o > 0)).toEqual([1]);
  });

  test("an unkeyed element still pairs only among its siblings", () => {
    const strip = (b: Box): Box => ({
      ...b,
      key: undefined,
      children: b.children.map((c) => (c.kind === "box" ? strip(c) : c)),
    });

    const plain = (into: 0 | 1) => {
      const s = lanes(into);

      return { ...s, root: strip(s.root) };
    };

    const node = <Dom states={[plain(0), [plain(1), { over: 1 }]]} />;

    // It fades out of one column and into the other.
    expect(inkOf(node, "Card", 0.5, 2).filter((o) => o > 0).length).toBeLessThanOrEqual(1);
    expect(inkOf(node, "Card", 0.1, 2).reduce((a, b) => a + b, 0)).toBeGreaterThan(0.5);
  });
});

describe("a resized box", () => {
  const soft: Shadow = { color: "rgba(0,0,0,0.5)", x: 0, y: 8, blur: 24, spread: -4 };

  test("its blurred shadow follows it, even when it shrinks below the blur", () => {
    const svg = render(
      { width: 400, height: 300, duration: 2, title: "shadow" },
      <Dom
        states={[
          page([box(40, 40, 200, 120, [], { shadows: [soft] })]),
          [page([box(40, 40, 30, 20, [], { shadows: [soft] })]), { over: 1 }],
        ]}
      />,
    );

    // Old and new shadows each have nine pieces, and every one of them changes shape with the box.
    const pieces = svg.match(/<path[^>]*fill="url\(#g\d+\)"[^>]*>/g) ?? [];

    expect(pieces.length).toBeGreaterThanOrEqual(16);
    expect((svg.match(/<animate [^>]*attributeName="d"/g) ?? []).length).toBeGreaterThanOrEqual(16);
  });

  test("content replaced whole hands over, so the box is never empty", () => {
    const sheet = (child: Item) => page([box(40, 40, 300, 200, [child], { key: "sheet" })]);

    const node = (
      <Dom
        states={[
          sheet(box(50, 50, 200, 40, [run("Palette", 60, 75)], { key: "palette" })),
          [sheet(box(50, 50, 280, 180, [run("Dialog", 60, 75)], { key: "dialog" })), { over: 1 }],
        ]}
      />
    );

    for (const t of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const shown = [...inkOf(node, "Palette", t, 2), ...inkOf(node, "Dialog", t, 2)];

      expect(shown.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.5);
    }
  });
});

describe("given fonts", () => {
  const runs = (family: string, ...texts: string[]): Map<string, TextRun[]> =>
    new Map([[family, texts.map((t) => ({ ...run(t, 0, 0), family }))]]);

  test("a face that forms no ligature in the drawn text cuts down to its glyphs", () => {
    const face = font(fixture("ABeeZee-Regular.ttf"), { family: "ABeeZee" });
    const { byName } = typefaces([face], [], runs("ABeeZee", "Hello there"));
    const drawn = byName.get("ABeeZee");

    expect(drawn).not.toBe(face);
    expect(drawn && "embed" in drawn && drawn.ligatures).toBe(false);
    expect(drawn && "embed" in drawn && drawn.embed(["Hello there"]).length).toBeLessThan(
      face.href.length / 2,
    );
  });

  test("a monospaced face keeps its layout, where coding fonts form their ligatures", () => {
    const face = font(fixture("JetBrainsMono.ttf"), { family: "JetBrains Mono" });
    const { byName } = typefaces([face], [], runs("JetBrains Mono", "a => b"));

    expect(byName.get("JetBrains Mono")).toBe(face);
  });
});

describe("drag", () => {
  test("presses on one target, moves to the other in steps, and lets go, with snaps between", () => {
    expect(drag("card", "lane")).toEqual([
      { pointer: { to: "card", button: "down" } },
      { pointer: { to: "lane", steps: 10 } },
      snap({ over: 0.6 }),
      { pointer: { button: "up" } },
      snap({ over: 0.2 }),
    ]);

    expect(
      drag("card", "lane", { grab: [0.5, 0.2], lifted: snap("lifted"), carried: false, steps: 3 }),
    ).toEqual([
      { pointer: { to: "card", at: [0.5, 0.2], button: "down" } },
      snap("lifted"),
      { pointer: { to: "lane", steps: 3 } },
      { pointer: { button: "up" } },
      snap({ over: 0.2 }),
    ]);
  });

  test("needs a whole number of steps", () => {
    expect(() => drag("a", "b", { steps: 0 })).toThrow(
      "drag() needs a whole number of steps, 1 or more, got 0.",
    );
  });
});
