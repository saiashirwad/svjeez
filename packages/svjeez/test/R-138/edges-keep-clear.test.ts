import { describe, expect, test } from "bun:test";
import { layered, type LayeredInput } from "../../src/layout/layered";
import { collinear, routed, segments, through } from "../helpers/layout-fixtures";

describe("layered", () => {
  describe("edges keep clear of each other", () => {
    for (const [name, graph] of Object.entries<LayeredInput>(routed)) {
      for (const direction of ["TB", "LR"] as const) {
        const out = layered({ ...graph, direction });
        const lines = out.edges.map((e) => ({ ...e, segments: segments(e.points) }));

        test(`${name} ${direction}: no two edges share a stretch of line, except a final approach into one port`, () => {
          const merging = (
            e: (typeof lines)[number],
            s: (typeof e.segments)[number],
            f: (typeof lines)[number],
            t: (typeof f.segments)[number],
          ) => {
            const [p, q] = [e.points.at(-1)!, f.points.at(-1)!];

            return s === e.segments.at(-1) && t === f.segments.at(-1) && p.x === q.x && p.y === q.y;
          };

          for (const [i, e] of lines.entries())
            for (const f of lines.slice(i + 1))
              for (const s of e.segments)
                for (const t of f.segments)
                  expect(
                    `${e.from}>${e.to} / ${f.from}>${f.to}: ${collinear(s, t) && !merging(e, s, f, t)}`,
                  ).toEndWith("false");
        });

        test(`${name} ${direction}: no edge runs through a node`, () => {
          for (const e of lines)
            for (const [id, b] of out.nodes)
              for (const s of e.segments)
                expect(`${e.from}>${e.to} through ${id}: ${through(s, b)}`).toEndWith("false");
        });
      }
    }
  });
});
