import { describe, expect, test } from "bun:test";
import { strokeFont } from "svjeez";
import { tiny } from "../helpers/strokefont";

describe("strokeFont", () => {
  test("reads the family, glyphs and advances of an SVG font", () => {
    expect(tiny.family).toBe("Tiny");
    expect(tiny.has("a") && tiny.has("&") && tiny.has(" ")).toBe(true);
    expect(tiny.has("b")).toBe(false);
    expect(tiny.measure("a &", 10)).toBeCloseTo(6 + 3 + 5, 9);
  });

  test("reads the same font from a string, bytes or an ArrayBuffer", () => {
    const markup = `<svg><defs><font horiz-adv-x="500"><font-face font-family="Tiny" units-per-em="1000" /><glyph unicode="a" d="M 0 0 L 0 500" /></font></defs></svg>`;
    const bytes = new TextEncoder().encode(markup);

    // SAFETY: TextEncoder.encode allocates a fresh ArrayBuffer, never a SharedArrayBuffer, so the cast to ArrayBuffer holds.
    const [fromString, fromBytes, fromBuffer] = [
      strokeFont(markup),
      strokeFont(bytes),
      strokeFont(bytes.buffer as ArrayBuffer),
    ];

    expect(fromBytes.path("a", { size: 10 }).d).toBe(fromString.path("a", { size: 10 }).d);
    expect(fromBuffer.path("a", { size: 10 }).d).toBe(fromString.path("a", { size: 10 }).d);
  });

  test("throws on markup that is not an SVG font", () => {
    expect(() => strokeFont("<svg/>")).toThrow(/no <font>/);
  });
});
