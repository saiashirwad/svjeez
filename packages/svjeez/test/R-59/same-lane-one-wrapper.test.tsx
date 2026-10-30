import { describe, expect, test } from "bun:test";
import { enter, exit } from "svjeez";
import { body, scene } from "../helpers/compile-scene";

describe("stacking", () => {
  test("motions on the same lane get exactly one wrapper", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={[enter({ at: 0, over: 1 }), exit({ at: 8, over: 1 })]}
      />,
    );

    expect(body(svg).match(/<g /g)).toHaveLength(1);
    expect(body(svg)).toMatch(/<g class="a m\d+">\s*<rect [^>]*class="a m\d+"\/>\s*<\/g>/);
  });
});
