import { describe, expect, test } from "bun:test";
import { font } from "svjeez";
import { browser } from "../helpers/frames-browser";
import { fontFile, paintText, sans } from "../helpers/frames-font";
import { same } from "../helpers/frames";

describe.if(browser)("embedded fonts", () => {
  test("a font cut down to the scene's glyphs paints the same as the whole file", async () => {
    const whole = font(await Bun.file(fontFile).bytes(), { subset: false });

    const line = (
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        To AVA, café!
      </text>
    );

    const full = (
      <text x={10} y={40} fontSize={28} fontFamily={whole}>
        To AVA, café!
      </text>
    );

    expect(same(await paintText(line), await paintText(full))).toBe(true);
  });
});
