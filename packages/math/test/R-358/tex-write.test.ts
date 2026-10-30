import { describe, expect, test } from "bun:test";
import { f, svg } from "../helpers/tex";

describe("tex", () => {
  test("write() draws each glyph's outline, then its fill, one glyph after another", () => {
    const out = svg(f.write({ at: 0.5, over: 2 }));
    expect(out.match(/<path /g)).toHaveLength(f.words.length * 2);
    expect(out.match(/stroke-dasharray="1"/g)).toHaveLength(f.words.length);
    // Outline, its fade and the fill, at times of each glyph's own, so no two glyphs share keyframes.
    expect(out.match(/@keyframes/g)).toHaveLength(f.words.length * 3);
  });

  test("write() rejects a negative span", () => {
    expect(() => f.write({ at: 0, over: -1 })).toThrow(/tex.write\(\) needs a non-negative span/);
  });
});
