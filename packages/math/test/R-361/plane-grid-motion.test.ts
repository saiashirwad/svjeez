import { describe, expect, test } from "bun:test";
import { base, numbers, shear, svg } from "../helpers/plane";

describe("plane", () => {
  test("a matrix step is one CSS transform: the grid stays in plane units and registered properties move", () => {
    const out = svg(shear.css, shear.grid);
    expect(out).toMatch(/\.plane-map\{transform:matrix\(var\(--p\d+\),/);
    expect(out).toContain("vector-effect:non-scaling-stroke");
    expect(out).toMatch(/@property --p\d+\{syntax:'<number>'/);
    expect(out).toMatch(/@keyframes [\w-]+\{0%,[\d.]+%\{--p\d+:0\}[\d.]+%,100%\{--p\d+:1\}/);
    expect(out).toContain('d="M-4 -4V4M-3 -4V4');
    expect(out).not.toContain("<animate");
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

  test("a function that is not finite names the point", () => {
    const broken = base.applyFunction((x) => [1 / x, 0], { at: 0, over: 1 });
    expect(() => broken.grid).toThrow("plane.applyFunction() sent (0, -4) to (Infinity, 0)");
  });
});
