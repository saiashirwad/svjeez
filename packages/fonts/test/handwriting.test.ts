import { describe, expect, test } from "bun:test";
import { casual, handwrite, strokeFont } from "../src/handwriting.tsx";

const font = strokeFont(`<svg><defs><font horiz-adv-x="500">
<font-face units-per-em="1000"/>
<glyph unicode="i" horiz-adv-x="300" d="M100 0L100 700"/>
<glyph unicode="t" horiz-adv-x="400" d="M100 0L100 700M0 500L300 500"/>
</font></defs></svg>`);

describe("strokeFont", () => {
  test("path has one M per stroke", () => {
    expect(font.path("it", { size: 100 }).match(/M/g)).toHaveLength(3);
  });

  test("path starts at x, y", () => {
    expect(font.path("i", { size: 100, x: 10, y: 50 })).toMatch(/^M20 50/);
  });
});

describe("handwrite", () => {
  test("strokes follow one another and the pen ends after the last", async () => {
    const { strokes, end } = handwrite(await casual(), "hello world", {
      width: 300,
      y: 80,
      from: 1,
    });

    expect(strokes.length).toBeGreaterThan(5);
    expect(strokes[0]!.at).toBe(1);

    for (const [i, stroke] of strokes.entries())
      if (i > 0)
        expect(stroke.at).toBeGreaterThanOrEqual(strokes[i - 1]!.at + strokes[i - 1]!.over);

    const last = strokes.at(-1)!;
    expect(end).toBeGreaterThan(last.at + last.over);
  });

  test("a faster pen finishes sooner", async () => {
    const hand = await casual();
    const slow = handwrite(hand, "svjeez", { width: 300, y: 80 });
    const fast = handwrite(hand, "svjeez", { width: 300, y: 80, speed: 1200 });

    expect(fast.end).toBeLessThan(slow.end);
  });
});
