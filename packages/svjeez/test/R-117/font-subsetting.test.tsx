import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { sfnt } from "../../src/font/sfnt";
import { typesetter } from "../../src/font/shape";
import { subset } from "../../src/font/subset";
import { fixture, sans, scene } from "../helpers/font";

describe("fontFamily", () => {
  test("embeds only the glyphs the scene's text uses", () => {
    const embedded = (svg: string) => /url\(data:font\/ttf;base64,([^)]+)\)/.exec(svg)![1]!;
    const cut = Buffer.from(embedded(scene(<text fontFamily={sans}>Hi</text>)), "base64");
    expect(cut.length).toBeLessThan(sans.bytes / 4);
    const parsed = font(cut);
    expect(parsed).toMatchObject({ family: "ABeeZee", weight: 400 });
    expect(parsed.has("H") && parsed.has("i")).toBe(true);
    expect(parsed.has("Q")).toBe(false);
    expect(parsed.measure("Hi", 40)).toBeCloseTo(sans.measure("Hi", 40), 6);
  });

  test("the cut keeps pair kerning among the glyphs it keeps", () => {
    const cut = font(
      Buffer.from(
        /base64,([^)]+)\)/.exec(scene(<text fontFamily={sans}>AV To</text>))![1]!,
        "base64",
      ),
    );

    expect(cut.measure("AV", 100)).toBeCloseTo(sans.measure("AV", 100), 6);
    expect(cut.measure("To", 100)).toBeCloseTo(sans.measure("To", 100), 6);
  });

  test("the cut maps characters beyond the BMP", async () => {
    const bytes = new Uint8Array(await readFile(fixture("ABeeZee-Regular")));
    const parsed = sfnt(bytes);
    const real = typesetter(parsed);
    const clef = "\u{1d11e}";
    const remapped = { ...real, glyph: (char: string) => real.glyph(char === clef ? "H" : char) };
    const cut = font(subset(bytes, parsed, remapped, real.kern, [`${clef}i`])!);
    expect(cut.has(clef) && cut.has("i")).toBe(true);
    expect(cut.has("H")).toBe(false);
  });
});
