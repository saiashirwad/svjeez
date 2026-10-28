import { describe, expect, test } from "bun:test";
import { strokeFont } from "svjeez";

const allure = await strokeFont.load(new URL("../examples/fonts/EMSAllure.svg", import.meta.url));
const tiny = strokeFont(`<svg><defs><font id="T" horiz-adv-x="500"><font-face font-family="Tiny" units-per-em="1000" />
  <glyph unicode="a" horiz-adv-x="600" d="M 0 0 L 100 500 L 200 0" />
  <glyph unicode="&amp;" d="M 0 0 L 0 700" />
  <glyph unicode=" " horiz-adv-x="300" />
</font></defs></svg>`);

describe("strokeFont", () => {
  test("reads the family, glyphs and advances of an SVG font", () => {
    expect(tiny.family).toBe("Tiny");
    expect(tiny.has("a") && tiny.has("&") && tiny.has(" ")).toBe(true);
    expect(tiny.has("b")).toBe(false);
    expect(tiny.measure("a &", 10)).toBeCloseTo(6 + 3 + 5, 9);
  });

  test("places glyphs left to right from the baseline, y down", () => {
    const { glyphs, width } = tiny.path("a&", { size: 100, x: 10, y: 50 });
    expect(width).toBeCloseTo(110, 9);
    expect(glyphs.map((g) => [g.char, g.x])).toEqual([["a", 10], ["&", 70]]);
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

  test("reads the same font from a string, bytes or an ArrayBuffer", () => {
    const markup = `<svg><defs><font horiz-adv-x="500"><font-face font-family="Tiny" units-per-em="1000" /><glyph unicode="a" d="M 0 0 L 0 500" /></font></defs></svg>`;
    const bytes = new TextEncoder().encode(markup);
    const [fromString, fromBytes, fromBuffer] = [strokeFont(markup), strokeFont(bytes), strokeFont(bytes.buffer as ArrayBuffer)];
    expect(fromBytes.path("a", { size: 10 }).d).toBe(fromString.path("a", { size: 10 }).d);
    expect(fromBuffer.path("a", { size: 10 }).d).toBe(fromString.path("a", { size: 10 }).d);
  });

  test("throws on markup that is not an SVG font", () => {
    expect(() => strokeFont("<svg/>")).toThrow(/no <font>/);
  });
});
