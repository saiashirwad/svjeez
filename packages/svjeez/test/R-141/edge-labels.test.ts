import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import { nodes, overlap, routed, segments, through } from "../helpers/layout-fixtures";

describe("layered", () => {
  test("an edge label sits beside its edge, clear of every node", () => {
    const out = layered({
      nodes: nodes("a b c"),
      edges: [
        { from: "a", to: "b", label: { w: 40, h: 16 } },
        { from: "a", to: "c", label: { w: 30, h: 16 } },
      ],
    });

    for (const e of out.edges)
      for (const b of out.nodes.values()) expect(overlap(e.label!, b)).toBe(false);
  });

  describe("edges keep clear of each other", () => {
    for (const [name, graph] of Object.entries<LayeredInput>(routed)) {
      for (const direction of ["TB", "LR"] as const) {
        const out = layered({ ...graph, direction });
        const lines = out.edges.map((e) => ({ ...e, segments: segments(e.points) }));

        test(`${name} ${direction}: labels clear nodes, other labels and other edges`, () => {
          const labelled = lines.filter((e) => e.label);

          for (const e of labelled) {
            for (const [id, b] of out.nodes)
              expect(`${e.from}>${e.to} label on ${id}: ${overlap(e.label!, b)}`).toEndWith(
                "false",
              );

            for (const f of labelled)
              if (f !== e)
                expect(
                  `${e.from}>${e.to} label on ${f.from}>${f.to} label: ${overlap(e.label!, f.label!)}`,
                ).toEndWith("false");

            for (const f of lines)
              if (f !== e)
                for (const s of f.segments)
                  expect(
                    `${e.from}>${e.to} label on ${f.from}>${f.to}: ${through(s, e.label!)}`,
                  ).toEndWith("false");
          }
        });
      }
    }
  });
});
