import { describe, expect, test } from "bun:test";
import { el, render } from "svjeez";
import { code, morph, type Morphable, type MorphPiece } from "svjeez/extras";

test("a run renamed under the same id cross-fades: both texts render, each animated", () => {
  const a = code([[["fn", "useState", "hook"]]]);
  const b = code([[["fn", "useReducer", "hook"]]]);

  const svg = render(
    { width: 100, height: 100, duration: 4, title: "morph" },
    morph([a, b], { at: [1] }).node,
  );

  for (const word of ["useState", "useReducer"])
    expect(svg).toMatch(new RegExp(`<text[^>]*class="a [^"]*"[^>]*>${word}</text>`));
});

test("morph reports when each transition runs and when the last settles", () => {
  const [a, b, c] = [code([[["fn", "a"]]]), code([[["fn", "b"]]]), code([[["fn", "c"]]])];
  const two = morph([a, b, c], { at: [1, 3], over: 0.5 });
  expect(two.spans).toEqual([
    { at: 1, over: 0.5 },
    { at: 3, over: 0.5 },
  ]);
  expect(two.end).toBe(3.5);
  expect(morph([a], { at: [] })).toMatchObject({ spans: [], end: 0 });
});

describe("morph over any Morphable", () => {
  const dots = (...pieces: MorphPiece[]): Morphable => ({
    words: pieces,
    draw: (p, animation) =>
      el.circle({ cx: p.x, cy: p.y, r: 2, class: `dot-${p.text}`, animation }),
  });

  test("a piece present in both versions travels, one only in the second fades in, and each is drawn by its own source", () => {
    const a = dots({ text: "k", x: 10, y: 10 });
    const b = dots({ text: "k", x: 50, y: 10 }, { text: "n", x: 80, y: 10 });

    const svg = render(
      { width: 100, height: 20, duration: 4, title: "dots" },
      morph([a, b], { at: [1], over: 1 }).node,
    );

    expect(svg.match(/class="[^"]*dot-k/g)).toHaveLength(1);
    expect(svg.match(/class="[^"]*dot-n/g)).toHaveLength(1);
    expect(svg).toMatch(/translate:40px 0px/);
  });
});
