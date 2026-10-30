import { describe, expect, test } from "bun:test";
import { layered } from "../../src/layout/layered";
import { edges, nodes } from "../helpers/layout-fixtures";

describe("layered", () => {
  test("an edge to an unknown id throws", () => {
    expect(() => layered({ nodes: nodes("a"), edges: edges("a>b") })).toThrow();
  });

  test("a node in two groups throws", () => {
    expect(() =>
      layered({
        nodes: nodes("a b"),
        edges: [],
        groups: [
          { id: "x", members: ["a"], label: { w: 1, h: 1 } },
          { id: "y", members: ["a"], label: { w: 1, h: 1 } },
        ],
      }),
    ).toThrow();
  });
});
