import { describe, expect, test } from "bun:test";
import { tree } from "../../src/layout/tree";
import { onBorder, treeInput as input } from "../helpers/layout-fixtures";

describe("tree", () => {
  for (const direction of ["TB", "LR"] as const) {
    const out = tree({ ...input, direction });

    test(`${direction}: edges run from the parent's border to the child's`, () => {
      for (const e of out.edges)
        expect([
          onBorder(e.points[0]!, out.nodes.get(e.from)!),
          onBorder(e.points.at(-1)!, out.nodes.get(e.to)!),
        ]).toEqual([true, true]);
    });
  }

  test("breadth-first order", () => {
    expect(tree(input).order).toEqual(["root", "a", "b", "c", "a1", "a2", "a3", "b1", "c1", "c11"]);
  });
});
