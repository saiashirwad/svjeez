import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import { graphs, overlap } from "../helpers/layout-fixtures";

describe("layered", () => {
  for (const [name, graph] of Object.entries<LayeredInput>(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });
      const boxes = [...out.nodes.entries()];

      test(`${name} ${direction}: no two nodes overlap`, () => {
        for (const [i, [a, ba]] of boxes.entries())
          for (const [b, bb] of boxes.slice(i + 1))
            expect(`${a}/${b} ${overlap(ba, bb)}`).toBe(`${a}/${b} false`);
      });
    }
  }
});
