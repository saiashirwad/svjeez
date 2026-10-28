import { describe, expect, test } from "bun:test";
import { render, type SvgNode } from "svjeez";
import { plane } from "../src/index";

const svg = (css: Parameters<typeof render>[0]["css"], ...children: SvgNode[]) =>
  render({ width: 400, height: 300, duration: 8, title: "plane", css }, children);

const base = plane({ origin: { x: 200, y: 150 }, unit: 20, extent: 4 });

const shear = base.apply(
  [
    [1, 1],
    [0, 1],
  ],
  { at: 1, over: 2 },
);

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("plane", () => {
  test("point() puts (0, 0) at the origin, with y up", () => {
    expect(base.point(0, 0)).toEqual({ x: 200, y: 150 });
    expect(base.point(1, 2)).toEqual({ x: 220, y: 110 });
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
    expect(() => plane({ origin: { x: 0, y: 0 }, unit: 0 })).toThrow(
      "plane() needs a finite origin",
    );

    const broken = base.applyFunction((x) => [1 / x, 0], { at: 0, over: 1 });
    expect(() => broken.grid).toThrow("plane.applyFunction() sent (0, -4) to (Infinity, 0)");
  });
});
