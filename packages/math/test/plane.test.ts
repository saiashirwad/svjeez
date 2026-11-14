import { describe, expect, test } from "bun:test";
import { motion, render, type SvgNode } from "svjeez";
import { plane } from "../src/index";

const svg = (css: Parameters<typeof render>[0]["css"], ...children: SvgNode[]) =>
  render({ width: 400, height: 300, duration: 8, title: "plane", css }, children);

/** Four units each way at 20px a unit, with (0, 0) at (200, 150). */
const base = plane({
  x: [-4, 4],
  y: [-4, 4],
  width: 160,
  height: 160,
  at: { x: 120, y: 70 },
  ticks: 1,
});

const shear = base.apply(
  [
    [1, 1],
    [0, 1],
  ],
  { at: 1, over: 2 },
);

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("plane", () => {
  test("a range with max at or below min is rejected", () => {
    expect(() => plane({ x: [3, -3], y: [-3, 3], width: 100, height: 100 })).toThrow(
      "plane() needs a finite x range with max above min, got [3, -3].",
    );
  });

  test("point() puts (0, 0) where the range says, with y up", () => {
    const at = (p: { x: number; y: number }) => [Math.round(p.x), Math.round(p.y)];
    expect(at(base.point(0, 0))).toEqual([200, 150]);
    expect(at(base.point(1, 2))).toEqual([220, 110]);
  });

  test("the pixels per unit may differ per axis, and a vector's head turns with the pixels", () => {
    const wide = plane({ x: [0, 2], y: [0, 2], width: 400, height: 100 }).apply(
      [
        [1, 0],
        [0, 1],
      ],
      { at: 1, over: 1 },
    );

    expect(wide.point(1, 1)).toEqual({ x: 200, y: 50 });
    const out = svg(wide.css, wide.vector([1, 1]));
    expect(out).toContain("translate(0 100) scale(200 -50)");
    expect(out).toContain('style="--p1:200;--p2:50"');
  });

  test("ticks as one number are the same on both axes, and an axis without ticks has no grid lines", () => {
    const only = plane({ x: [-2, 2], y: [-2, 2], width: 100, height: 100, ticks: { x: 1 } });
    expect(svg(undefined, only.grid)).not.toContain("H");
    expect(svg(undefined, only.grid)).toContain("V");
    expect(svg(undefined, base.grid)).toContain("V");
    expect(svg(undefined, base.grid)).toContain("H");
  });

  test("a plot follows the steps, and calculus asks to be called before them", () => {
    const moving = svg(shear.css, shear.plot((x) => x).node);
    expect(moving).toContain("plane-map");
    expect(() =>
      shear.plot((x) => x, { animation: motion({ draw: 0 }).at(0).to({ draw: 1 }, 1) }),
    ).toThrow("plot() cannot draw on a plane that has steps");
    expect(() => shear.dot((x) => x, 1)).toThrow(
      "plane.dot() draws on a plane that does not move. Call it on the plane before its first step.",
    );
    expect(base.dot((x) => x, 1).point(0)).toEqual(base.point(1, 1));
  });

  test("steps compose: map() follows each matrix in order, and reset() returns home", () => {
    const rotate = shear.apply(
      [
        [0, -1],
        [1, 0],
      ],
      { at: 3, over: 1 },
    );

    expect(shear.map(0, 1)).toEqual(base.point(1, 1));
    expect(rotate.map(0, 1)).toEqual(base.point(-1, 1));
    expect(rotate.reset({ at: 5, over: 1 }).map(0, 1)).toEqual(base.point(0, 1));
  });

  test("a matrix step is one CSS transform: the grid stays in plane units and registered properties move", () => {
    const out = svg(shear.css, shear.grid);
    expect(out).toMatch(/\.plane-map\{transform:matrix\(var\(--p\d+\),/);
    expect(out).toContain("vector-effect:non-scaling-stroke");
    expect(out).toMatch(/@property --p\d+\{syntax:'<number>'/);
    expect(out).toMatch(/@keyframes [\w-]+\{0%,[\d.]+%\{--p\d+:0\}[\d.]+%,100%\{--p\d+:1\}/);
    expect(out).toContain('d="M-4 -4V4M-3 -4V4');
    expect(out).not.toContain("<animate");
  });

  test("a vector under a matrix keeps an upright head that turns with atan2", () => {
    const out = svg(shear.css, shear.vector([1, 0], { label: "v" }));
    expect(out).toContain("rotate:atan2(");
    expect(out).toMatch(/<polygon points="4,0 -8,-5.5 -8,5.5"/);
  });

  test("a function step morphs the grid through d, with every key written in the same commands", () => {
    const square = base.applyFunction((x, y) => [x * x - y * y, 2 * x * y], { at: 1, over: 2 });
    const out = svg(square.css, square.grid);
    const values = out.match(/<animate attributeName="d" values="([^"]*)"/)![1]!.split(";");
    const counts = new Set(values.map((d) => numbers(d).length));
    expect(counts.size).toBe(1);
    expect(values.at(-1)).not.toBe(values[0]);
    expect(square.map(1, 1)).toEqual(base.point(0, 2));
  });

  test("a vector under a function keeps its head the same triangle at every key", () => {
    const bent = base.applyFunction((x, y) => [Math.cos(y) * (1 + x), Math.sin(y) * (1 + x)], {
      at: 1,
      over: 2,
    });

    const out = svg(bent.css, bent.vector([0, 2]));

    const heads = out.match(
      /<path d="[^"]*Z" fill="[^"]*" class="dm">\s*<animate attributeName="d" values="([^"]*)"/,
    )![1]!;

    const sides = heads.split(";").map((d) => {
      const [ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0] = numbers(d);

      return [
        Math.hypot(ax - bx, ay - by),
        Math.hypot(bx - cx, by - cy),
        Math.hypot(cx - ax, cy - ay),
      ];
    });

    for (const s of sides) s.forEach((side, i) => expect(side).toBeCloseTo(sides[0]![i]!, 0));
  });

  test("errors name the fix", () => {
    expect(() =>
      shear.apply(
        [
          [1, 0],
          [0, 1],
        ],
        { at: 2, over: 1 },
      ),
    ).toThrow("A plane step starts at 2s, before the previous step ends at 3s.");
    expect(() => base.vector([0, 0])).toThrow(
      "plane.vector() needs a finite arrow of nonzero length",
    );
    expect(() => plane({ x: [0, 1], y: [0, 1], width: 0, height: 10 })).toThrow(
      "plane() needs a positive width and height",
    );

    const broken = base.applyFunction((x) => [1 / x, 0], { at: 0, over: 1 });
    expect(() => broken.grid).toThrow("plane.applyFunction() sent (0, -4) to (Infinity, 0)");
  });
});
