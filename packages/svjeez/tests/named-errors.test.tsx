import { describe, expect, test } from "bun:test";
import { ease, motion, render, sampled, strokeFont, wiggle, type RenderOptions } from "svjeez";

const scene = (options: Partial<RenderOptions>) =>
  render(
    { width: 10, height: 10, duration: 1, title: "T", ...options },
    <rect width={1} height={1} />,
  );

describe("named errors", () => {
  test("motion() rejects a non-finite or unknown initial channel", () => {
    expect(() => motion({ x: NaN })).toThrow("motion() needs a finite x, got NaN.");
    // @ts-expect-error nope is not a channel
    expect(() => motion({ nope: 1 })).toThrow('"nope" is not an animatable channel.');
    expect(() => motion({ x: 1 })).not.toThrow();
  });

  test("ease.bezier rejects NaN and an x outside 0 to 1", () => {
    expect(() => ease.bezier(NaN, 0, 1, 1)).toThrow("ease.bezier needs x1 and x2 between 0 and 1");
    expect(() => ease.bezier(0, 0, 1.5, 1)).toThrow("ease.bezier needs x1 and x2 between 0 and 1");
    expect(() => ease.bezier(0.2, -2, 0.8, 3)).not.toThrow();
  });

  test("sampled() keeps a channel that is never finite out of the initial values", () => {
    const m = sampled(() => ({ x: Number("nope") }), {
      over: 1,
      tolerance: { translate: 1 },
    });

    expect(
      render(
        { width: 10, height: 10, duration: 1, title: "T" },
        <rect width={1} height={1} animation={m} />,
      ),
    ).not.toContain("NaN");
  });

  test("wiggle() names its own period", () => {
    expect(() => wiggle({ x: 1 }, { seed: 1, period: 0 })).toThrow(
      "wiggle() needs a positive period, got 0.",
    );
  });

  test("render() rejects a non-finite reducedMotion.at, duration and width", () => {
    expect(() => scene({ reducedMotion: { at: NaN } })).toThrow(
      "render() needs a finite reducedMotion.at, got NaN.",
    );
    expect(() => scene({ duration: Infinity })).toThrow("render() needs a positive duration");
    expect(() => scene({ width: Infinity })).toThrow("render() needs a positive width and height");
  });

  test("Font.has('') is false and a bad weight throws", async () => {
    const { font } = await import("svjeez");

    const bytes = new Uint8Array(
      await Bun.file(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)).arrayBuffer(),
    );

    const f = font(bytes);
    expect(f.has("")).toBe(false);
    expect(() => font(bytes, { weight: 0 })).toThrow(
      "font() needs a weight between 1 and 1000, got 0.",
    );
  });

  test("strokeFont() names an entity past U+10FFFF", () => {
    const svg = (code: string) =>
      `<svg><defs><font horiz-adv-x="500"><font-face font-family="T" units-per-em="1000" /><glyph unicode="${code}" d="M 0 0 L 1 1" /></font></defs></svg>`;

    expect(() => strokeFont(svg("&#x110000;"))).toThrow("past the last code point U+10FFFF");
    expect(() => strokeFont(svg("&#x41;"))).not.toThrow();
  });
});
