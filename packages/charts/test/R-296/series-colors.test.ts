import { describe, expect, test } from "bun:test";
import { defaultDark, tint } from "svjeez/extras";
import { band, scene } from "../helpers/charts.ts";

describe("bars", () => {
  test("series take the theme's accents in a fixed order unless told a color", () => {
    const c = band();
    const first = scene(c.bars({ Q1: 1 }).node);
    const second = scene(c.bars({ Q1: 1 }).node);
    expect(first).toContain(tint(defaultDark, "blue"));
    expect(second).toContain(tint(defaultDark, "number"));
    expect(scene(c.bars({ Q1: 1 }, { color: "#ff0000" }).node)).toContain("#ff0000");
  });
});
