import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import { graphs, overlap } from "../helpers/layout-fixtures";

describe("layered", () => {
  for (const [name, graph] of Object.entries<LayeredInput>(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });
      const boxes = [...out.nodes.entries()];

      test(`${name} ${direction}: no node sits inside a group it is not in`, () => {
        for (const g of graph.groups ?? []) {
          const box = out.groups.get(g.id)!;

          for (const [id, b] of boxes)
            expect(`${id} in ${g.id}: ${overlap(b, box)}`).toBe(
              `${id} in ${g.id}: ${g.members.includes(id)}`,
            );
        }
      });
    }
  }
});
