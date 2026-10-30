import { describe, expect, test } from "bun:test";
import { morph } from "svjeez/extras";
import { tex } from "../../src/index";
import { f, svg } from "../helpers/tex";

describe("tex", () => {
  test("a superscript is a smaller glyph, raised above the baseline", () => {
    const [base, power] = [f.words.find((g) => g.char === ")")!, f.words.at(-1)!];
    expect(base.size).toBe(1);
    expect(power.size).toBeCloseTo(0.707, 3);
    expect(power.y).toBeLessThan(base.y);
  });

  test("fractions, roots and sums come out as glyphs and bars", () => {
    const g = tex(String.raw`\frac{a}{b}+\sqrt{x}+\sum_{i=1}^n i`);
    expect(g.words.filter((w) => w.char === "rect")).toHaveLength(2);
    expect(g.words.map((w) => w.char)).toContain("∑");
  });

  test("a boxed or struck term draws its outline as shapes", () => {
    const g = tex(String.raw`\boxed{x}\cancel{y}`);
    expect(g.words.map((w) => w.char)).toEqual(["x", "rect", "y", "line"]);
  });
});

describe("morph over equations", () => {
  const a = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 40 });
  const b = tex(String.raw`a^2 + 2ab + b^2`, { x: 40, y: 80, fontSize: 40 });

  test("glyphs of the same character and size carry over, and the rest fade", () => {
    const out = svg(morph([a, b], { at: [1], over: 1 }).node);
    // a, +, b and the superscript 2 carry over. The full-size 2 is new, since a 2 cannot scale.
    expect(out.match(/<path /g)).toHaveLength(a.words.length + b.words.length - 4);
  });

  test("a carried glyph moves by the distance between its places, on the wrapping group", () => {
    const out = svg(morph([a, b], { at: [1], over: 1 }).node);
    const power = b.words.at(-1)!;
    const from = a.words.at(-1)!;
    expect(out).toContain(`translate:${power.x - from.x}px ${power.y - from.y}px`);
    expect(out).toMatch(/<g class="a m\d+">\s*<path d=/);
  });

  test("a version morphs back to itself, so a loop can close", () => {
    const m = morph([a, b, a], { at: [1, 3], over: 1 });
    expect(m.end).toBe(4);
    expect(() => svg(m.node)).not.toThrow();
  });
});
