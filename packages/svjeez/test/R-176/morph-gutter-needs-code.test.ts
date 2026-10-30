import { describe, expect, test } from "bun:test";
import { el } from "svjeez";
import { morph, type Morphable, type MorphPiece } from "svjeez/extras";

describe("morph over any Morphable", () => {
  const dots = (...pieces: MorphPiece[]): Morphable => ({
    words: pieces,
    draw: (p, animation) =>
      el.circle({ cx: p.x, cy: p.y, r: 2, class: `dot-${p.text}`, animation }),
  });

  test("a gutter needs code, because only code has lines to number", () => {
    const a = dots({ text: "k", x: 10, y: 10 });
    // SAFETY: the overloads reject this call at compile time, and a plain-JS caller would still reach the runtime check.
    expect(() => morph([a, a], { at: [1], gutter: true } as never)).toThrow(/gutter only for code/);
  });
});
