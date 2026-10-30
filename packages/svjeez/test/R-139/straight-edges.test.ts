import { describe, expect, test } from "bun:test";
import { layered } from "../../src/layout/layered";
import { edges, nodes } from "../helpers/layout-fixtures";

describe("layered", () => {
  test("a chain with backward edges round both sides stays straight", () => {
    const out = layered({
      nodes: nodes("start closed open half"),
      edges: edges("start>closed closed>open open>half half>closed half>open"),
    });

    const centers = ["start", "closed", "open", "half"].map(
      (id) => out.nodes.get(id)!.x + out.nodes.get(id)!.w / 2,
    );

    for (const x of centers) expect(x).toBeCloseTo(centers[0]!, 3);

    for (const e of out.edges.slice(0, 3)) expect(e.points).toHaveLength(2);
  });

  test("a wide node sends each of its edges out from above its target", () => {
    const out = layered({
      nodes: [{ id: "hub", w: 400, h: 40 }, ...nodes("a b c")],
      edges: edges("hub>a hub>b hub>c"),
    });

    for (const e of out.edges) expect(e.points.length).toBeLessThanOrEqual(2);
  });
});
