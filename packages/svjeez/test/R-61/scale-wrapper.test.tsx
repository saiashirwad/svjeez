import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { body, scene } from "../helpers/compile-scene";

describe("stacking", () => {
  test("scale on text pivots on a wrapper, since WebKit ignores fill-box on <text>", () => {
    const svg = scene(<text animation={motion().to({ scale: 2 }, 1)}>hi</text>);
    expect(body(svg)).toMatch(/<g class="a m1 fb">\s*<text>hi<\/text>/);
  });

  test("scale on an element with a transform attribute wraps instead of re-pivoting it", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        transform="rotate(45)"
        animation={motion().to({ scale: 2 }, 1)}
      />,
    );

    expect(body(svg)).toMatch(
      /<g class="a m1 fb">\s*<rect width="10" height="10" transform="rotate\(45\)"\/>/,
    );
  });
});
