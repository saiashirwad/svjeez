import { describe, expect, test } from "bun:test";
import { layered } from "../../src/layout/layered";
import { edges, nodes, onBorder } from "../helpers/layout-fixtures";

describe("layered", () => {
  test("a self loop leaves and returns to the node's far side", () => {
    const out = layered({ nodes: nodes("a b"), edges: edges("a>b b>b") });
    const loop = out.edges[1]!;
    const b = out.nodes.get("b")!;
    expect(loop.points.every((p) => p.x >= b.x + b.w - 1e-6)).toBe(true);
    expect([onBorder(loop.points[0]!, b), onBorder(loop.points.at(-1)!, b)]).toEqual([true, true]);
  });
});
