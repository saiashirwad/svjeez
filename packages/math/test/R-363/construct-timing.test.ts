import { describe, expect, test } from "bun:test";
import { construct } from "../../src/index";
import { svg } from "../helpers/construct";

describe("construct", () => {
  test("elements start one after another, and at overrides the order", () => {
    const g = construct({ pace: { point: 1, gap: 0 } });

    g.point(0, 0);
    expect(g.time).toBe(1);
    g.point(1, 0, undefined, { at: 5 });
    expect(g.time).toBe(6);
    g.together(() => {
      g.point(2, 0);
      g.point(3, 0, undefined, { over: 3 });
    });
    expect(g.time).toBe(9);
    expect(g.end).toBe(9);
  });

  test("settle fades aids but not the figure", () => {
    const g = construct({ at: { x: 50, y: 50 }, unit: 10, faint: 0.3 });
    const [a, b] = [g.point(0, 0), g.point(5, 0)];

    g.circle(a, b, { aid: true });
    g.segment(a, b);
    g.settle();
    const out = svg(g.node);

    expect(out.match(/opacity: ?0\.3/g)?.length).toBe(1);
  });
});
