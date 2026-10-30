import { describe, expect, test } from "bun:test";
import { enter, motion } from "svjeez";
import { body, scene } from "../helpers/compile-scene";

describe("stacking", () => {
  test("motions on disjoint lanes share the element", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={[enter({ at: 0, over: 1 }), motion().at(2).to({ scale: 2 }, 1)]}
      />,
    );

    expect(body(svg)).not.toContain("<g");
  });
});
