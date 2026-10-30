import { describe, expect, test } from "bun:test";
import { allure, tiny } from "../helpers/strokefont";

describe("strokeFont", () => {
  test("places glyphs left to right from the baseline, y down", () => {
    const { glyphs, width } = tiny.path("a&", { size: 100, x: 10, y: 50 });
    expect(width).toBeCloseTo(110, 9);
    expect(glyphs.map((g) => [g.char, g.x])).toEqual([
      ["a", 10],
      ["&", 70],
    ]);
    expect(glyphs[0]!.d.startsWith("M10 50")).toBe(true);
    expect(glyphs[0]!.d).toContain("20 0");
    expect(glyphs[1]!.d).toBe("M70 50L70 -20");
  });

  test("keeps a corner sharper than a right angle as a corner, and smooths gentle turns", () => {
    const corner = tiny.path("a", { size: 100 }).d;
    expect(corner).toBe("M0 0C0 0 10 -50 10 -50C10 -50 20 0 20 0");
    expect(allure.path("o", { size: 100 }).d).toMatch(/^M[^C]+C/);
  });

  test("a space and an unknown character advance without drawing", () => {
    const { glyphs } = tiny.path(" b", { size: 10 });
    expect(glyphs.map((g) => g.d)).toEqual(["", ""]);
    expect(glyphs[1]!.advance).toBeCloseTo(5, 9);
  });
});
