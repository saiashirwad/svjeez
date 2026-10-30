import { describe, expect, test } from "bun:test";
import { tex } from "../../src/index";
import { f, svg } from "../helpers/tex";

describe("tex", () => {
  test("the box starts at x, y and scales with fontSize, 1000 units to the em", () => {
    expect(f.bounds).toMatchObject({ x: 40, y: 80 });
    const double = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 80 });
    expect(double.width).toBeCloseTo(f.width * 2, 2);
    expect(double.height).toBeCloseTo(f.height * 2, 2);
  });

  test("every glyph sits inside the box, in reading order", () => {
    const slack = 1;

    for (const g of f.words) {
      expect(g.bounds.x).toBeGreaterThanOrEqual(f.bounds.x - slack);
      expect(g.bounds.y).toBeGreaterThanOrEqual(f.bounds.y - slack);
      expect(g.bounds.x + g.bounds.w).toBeLessThanOrEqual(f.bounds.x + f.bounds.w + slack);
      expect(g.bounds.y + g.bounds.h).toBeLessThanOrEqual(f.bounds.y + f.bounds.h + slack);
    }

    expect(f.words.map((g) => g.char).join("")).toBe("(a+b)2");
    expect(f.words.map((g) => g.x)).toEqual(f.words.map((g) => g.x).sort((a, b) => a - b));
  });

  test("glyphs draw upright: y grows downward on screen, so the matrix flips the font's y-up path", () => {
    for (const g of f.words) {
      expect(g.matrix[0]).toBeGreaterThan(0);
      expect(g.matrix[3]).toBeLessThan(0);
    }
  });

  test("bad options name the call and the value", () => {
    expect(() => tex("x", { fontSize: 0 })).toThrow(/tex\(\) needs finite coordinates/);
    expect(() => tex("x", { anchor: [Number.NaN, 0] })).toThrow(/tex\(\) needs finite coordinates/);
  });

  test("anchor places that point of the box at x, y", () => {
    const centered = tex(String.raw`(a+b)^2`, { x: 200, y: 100, fontSize: 40, anchor: [0.5, 0.5] });
    expect(centered.bounds.x + centered.width / 2).toBeCloseTo(200, 0);
    expect(centered.bounds.y + centered.height / 2).toBeCloseTo(100, 0);
    expect(centered.width).toBe(f.width);
  });

  test("the static node is one group per glyph, with the glyph's matrix on the path", () => {
    const out = svg(f.node);
    expect(out.match(/<path /g)).toHaveLength(f.words.length);
    expect(out).toMatch(/<g>\s*<path d="M[^"]+" transform="matrix\(0\.04 0 0 -0\.04 /);
  });
});
