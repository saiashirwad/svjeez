import { describe, expect, test } from "bun:test";
import { layered } from "../../src/layout/layered";
import { nodes, overlap } from "../helpers/layout-fixtures";

describe("layered", () => {
  test("edges both ways between two nodes take separate lines and labels", () => {
    const label = { w: 40, h: 16 };

    const out = layered({
      nodes: nodes("a b c"),
      edges: [
        { from: "a", to: "b", label },
        { from: "b", to: "a", label },
        { from: "a", to: "b", label },
        { from: "b", to: "c" },
      ],
    });

    const [ab, ba, ab2] = out.edges;
    expect(ab!.points).not.toEqual([...ba!.points].reverse());
    expect(ab!.points).not.toEqual(ab2!.points);
    expect([overlap(ab!.label!, ba!.label!), overlap(ab!.label!, ab2!.label!)]).toEqual([
      false,
      false,
    ]);
  });
});
