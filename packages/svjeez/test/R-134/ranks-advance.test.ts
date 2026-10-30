import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import type { Box } from "../../src/layout/box";
import { graphs } from "../helpers/layout-fixtures";

describe("layered", () => {
  for (const [name, graph] of Object.entries<LayeredInput>(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });

      test(`${name} ${direction}: ranks advance along the direction`, () => {
        const along = (b: Box) => (direction === "TB" ? [b.y, b.y + b.h] : [b.x, b.x + b.w]);

        for (const e of graph.edges) {
          const [from, to] = [out.nodes.get(e.from)!, out.nodes.get(e.to)!];
          const [ra, rb] = [out.rank.get(e.from)!, out.rank.get(e.to)!];
          const [first, second] = ra < rb ? [from, to] : [to, from];
          expect(ra).not.toBe(rb);
          expect(along(second)[0]!).toBeGreaterThan(along(first)[1]!);
        }
      });
    }
  }

  test("a cycle reverses one edge for ranking but still points the right way", () => {
    const out = layered(graphs.cycle!);
    expect(out.rank.get("wait")).toBeGreaterThan(out.rank.get("run")!);
  });
});
