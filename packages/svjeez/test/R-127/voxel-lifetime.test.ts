import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { build, place, presenceAt, uses } from "../helpers/voxel";

describe("voxel.scene", () => {
  test("from and to toggle visibility at those times", () => {
    const svg = build([place([0, 0, 0], { from: 2, to: 6 })]);
    const cls = uses(svg)[0]!.cls!;
    expect([0, 1.9, 2.1, 5.9, 6.1, 9.9].map((t) => presenceAt(svg, cls, t))).toEqual([
      0, 0, 1, 1, 0, 0,
    ]);
  });

  test("a block with no lifetime has no animation", () => {
    expect(uses(build([place([0, 0, 0])]))[0]!.cls).toBeUndefined();
  });

  test("a block animation rides on its own use", () => {
    const svg = build([place([0, 0, 0], { animation: motion({ y: -20 }).to({ y: 0 }, 1) })]);
    expect(uses(svg)[0]!.cls).toMatch(/\ba\b/);
    expect(svg).toContain("translate:0px -20px");
  });
});
