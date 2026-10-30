import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { code, reveal } from "svjeez/extras";

describe("reveal", () => {
  const source = code("class A {\n  a = 1;\n\n  b() {}\n}");

  test("by default each paragraph enters in turn, a blank line joining the block after it", () => {
    const shown = reveal(source, { at: 1, step: 0.5, over: 0.4 });
    expect(shown.spans).toEqual([
      { at: 1, over: 0.4 },
      { at: 1.5, over: 0.4 },
    ]);
    expect(shown.end).toBeCloseTo(1.9, 9);
    expect(reveal(source, { at: [0.5, 3] }).spans.map((s) => s.at)).toEqual([0.5, 3]);
  });

  test("lines outside every block render unanimated, so a skeleton stays put", () => {
    const svg = render(
      { width: 100, height: 100, duration: 4, title: "reveal" },
      reveal(source, { at: 1, blocks: [[2], [4]] }).node,
    );

    expect(svg).toMatch(/<text(?![^>]*class=)[^>]*>class<\/text>/);
    expect(svg).toMatch(/<g class="[^"]+">\s*<text[^>]*>a<\/text>/);
  });

  test('one block per line with "line", and overlapping or out-of-range blocks throw', () => {
    expect(reveal(source, { at: 0, blocks: "line" }).spans).toHaveLength(5);
    expect(() =>
      reveal(source, {
        at: 0,
        blocks: [
          [1, 2],
          [2, 3],
        ],
      }),
    ).toThrow();
    expect(() => reveal(source, { at: 0, blocks: [[4, 9]] })).toThrow();
  });
});
