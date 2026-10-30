import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { fixture, italic, sans, scene } from "../helpers/font";

describe("font", () => {
  test("a font is not a string", () => {
    expect(() => `${sans}`).toThrow("Pass it as fontFamily={font}");
    expect(() => `${font.family(sans, italic)}`).toThrow("fontFamily={family}");
  });

  test("embeds a used font with its fallback in the attribute", () => {
    const svg = scene(
      <>
        <text fontFamily={sans}>One</text>
        <text fontFamily={sans}>Two</text>
      </>,
    );

    expect(svg).toContain(`font-family="'ABeeZee', sans-serif"`);
  });

  test("a family name cannot break out of the CSS string", async () => {
    const hostile = font(await readFile(fixture("ABeeZee-Regular")), {
      family: "x\n;}svg *{display:none}/*",
    });

    const style = /<style>([\s\S]*)<\/style>/.exec(
      scene(<text fontFamily={hostile}>Hi</text>),
    )![1]!;

    expect(style).toContain("@font-face{font-family:'x\\a ;}svg *{display:none}/*'");
    expect(style).not.toContain("\n;}");
  });
});
