import { describe, expect, test } from "bun:test";
import type { Box } from "../../src/layout/box";
import { tree } from "../../src/layout/tree";
import { overlap, treeInput as input } from "../helpers/layout-fixtures";

describe("tree", () => {
  for (const direction of ["TB", "LR"] as const) {
    const out = tree({ ...input, direction });
    const cross = (b: Box) => (direction === "TB" ? b.x + b.w / 2 : b.y + b.h / 2);

    test(`${direction}: each parent is centered over its first and last child`, () => {
      for (const id of ["root", "a", "b", "c", "c1"]) {
        const kids = input.nodes
          .filter((n) => n.parent === id)
          .map((n) => cross(out.nodes.get(n.id)!));

        expect(cross(out.nodes.get(id)!)).toBeCloseTo((kids[0]! + kids.at(-1)!) / 2, 6);
      }
    });

    test(`${direction}: subtrees never overlap and siblings keep their order`, () => {
      const boxes = [...out.nodes.values()];

      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false);
      expect(["a", "b", "c"].map((id) => cross(out.nodes.get(id)!))).toEqual(
        ["a", "b", "c"].map((id) => cross(out.nodes.get(id)!)).sort((p, q) => p - q),
      );
    });
  }
});
