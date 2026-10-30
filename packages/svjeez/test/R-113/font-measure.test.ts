import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { black, fixture, mono, sans } from "../helpers/font";

describe("font", () => {
  test("measure applies pair kerning", () => {
    const apart = sans.measure("A", 100) + sans.measure("V", 100);
    expect(sans.measure("AV", 100)).toBeCloseTo(apart - 6.5, 5);
    expect(mono.measure("AV", 100)).toBeCloseTo(mono.measure("A", 100) * 2, 5);
  });

  test("measure applies standard ligatures", () => {
    expect(black.path("fi", { size: 10 }).glyphs.map((glyph) => glyph.char)).toEqual(["fi"]);
    expect(black.measure("fi", 100)).not.toBeCloseTo(
      black.measure("f", 100) + black.measure("i", 100),
      1,
    );
  });

  test("measure scales with size", () => {
    expect(sans.measure("Wave", 48)).toBeCloseTo(sans.measure("Wave", 24) * 2, 6);
  });

  test("has() reports missing glyphs", () => {
    expect(sans.has("a")).toBe(true);
    expect(sans.has("😀")).toBe(false);
  });

  test("with ligatures off, text draws one glyph per character", async () => {
    const plain = font(await readFile(fixture("ArchivoBlack-Regular")), { ligatures: false });
    expect(plain.path("fi", { size: 10 }).glyphs.map((glyph) => glyph.char)).toEqual(["f", "i"]);
    expect(plain.measure("fi", 100)).toBeCloseTo(
      plain.measure("f", 100) + plain.measure("i", 100),
      6,
    );
  });
});
