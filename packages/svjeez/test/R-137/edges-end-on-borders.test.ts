import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import { graphs, onBorder } from "../helpers/layout-fixtures";

describe("layered", () => {
  for (const [name, graph] of Object.entries<LayeredInput>(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });

      test(`${name} ${direction}: edges start and end on node borders`, () => {
        for (const e of out.edges) {
          expect(onBorder(e.points[0]!, out.nodes.get(e.from)!)).toBe(true);
          expect(onBorder(e.points.at(-1)!, out.nodes.get(e.to)!)).toBe(true);

          for (const [k, p] of e.points.slice(1).entries())
            expect(p.x === e.points[k]!.x || p.y === e.points[k]!.y).toBe(true);
        }
      });
    }
  }

  test("a reversed cycle edge still ends on the border of its target", () => {
    const out = layered(graphs.cycle!);
    const back = out.edges.find((e) => e.from === "wait" && e.to === "run")!;
    expect(onBorder(back.points.at(-1)!, out.nodes.get("run")!)).toBe(true);
  });
});
