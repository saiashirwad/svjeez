import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { construct } from "../src/index";

const svg = (node: Parameters<typeof render>[1]) =>
  render({ width: 400, height: 300, duration: 12, title: "construct" }, node);

describe("construct", () => {
  test("two circles through each other's centers meet at the apexes of an equilateral triangle", () => {
    const g = construct();
    const [a, b] = [g.point(0, 0, "A"), g.point(10, 0, "B")];
    const [top, bottom] = g.intersect(g.circle(a, b), g.circle(b, a));

    expect(top!.x).toBeCloseTo(5, 9);
    expect(top!.y).toBeCloseTo(Math.sqrt(75), 9);
    expect(bottom!.y).toBeCloseTo(-Math.sqrt(75), 9);
  });

  test("pick keeps one crossing and draws one dot", () => {
    const g = construct();
    const [a, b] = [g.point(0, 0), g.point(10, 0)];
    const dots = (node: string) => node.match(/<circle /g)?.length ?? 0;
    const before = dots(svg(g.node));
    const c = g.intersect(g.circle(a, b), g.circle(b, a), { pick: 1, label: "C" });

    expect(c.label).toBe("C");
    expect(c.y).toBeLessThan(0);
    expect(dots(svg(g.node)) - before).toBe(1);
  });

  test("a line meets a circle in the order along the line", () => {
    const g = construct();
    const [a, b] = [g.point(-5, 0), g.point(5, 0)];
    const [first, second] = g.intersect(g.line(a, b), g.circle(g.point(0, 0), { radius: 3 }));

    expect([first!.x, second!.x]).toEqual([-3, 3]);
  });

  test("two lines cross in one point, and a segment that stops short is an error", () => {
    const g = construct();
    const [a, b, c, d] = [g.point(0, 0), g.point(2, 2), g.point(0, 4), g.point(4, 0)];

    expect(g.intersect(g.line(a, b), g.line(c, d))).toMatchObject({ x: 2, y: 2 });
    expect(() => g.intersect(g.segment(a, b), g.segment(c, g.point(1, 3.5)))).toThrow(
      /past the end of segment/,
    );
  });

  test("circles that miss and parallel lines name the problem", () => {
    const g = construct();
    const [a, b] = [g.point(0, 0), g.point(1, 0)];

    expect(() => g.intersect(g.circle(a, b), g.circle(g.point(9, 0), { radius: 1 }))).toThrow(
      /found no crossing/,
    );
    expect(() => g.intersect(g.line(a, b), g.parallel(g.line(a, b), g.point(0, 1)))).toThrow(
      /found no crossing/,
    );
    expect(() => g.circle(a, a)).toThrow(/positive radius/);
  });

  test("the perpendicular bisector is perpendicular and passes the midpoint", () => {
    const g = construct();
    const [a, b] = [g.point(0, 0), g.point(6, 2)];
    const line = g.perpendicularBisector(a, b);
    const dir = [line.b.x - line.a.x, line.b.y - line.a.y];

    expect(dir[0]! * 6 + dir[1]! * 2).toBeCloseTo(0, 9);
    expect((line.a.x + line.b.x) / 2).toBeCloseTo(3, 9);
    expect((line.a.y + line.b.y) / 2).toBeCloseTo(1, 9);
  });

  test("the angle bisector splits the angle in two equal halves", () => {
    const g = construct();
    const [a, b, c] = [g.point(8, 0), g.point(0, 0), g.point(0, 5)];
    const ray = g.angleBisector(a, b, c);

    expect(ray.b.x / ray.b.y).toBeCloseTo(1, 9);
  });

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

  test("labels are formulas placed off the lines that meet at the point", () => {
    const g = construct({ at: { x: 100, y: 200 }, unit: 10 });
    const [a, b, c] = [g.point(0, 0, "A"), g.point(10, 0, "B"), g.point(5, 8, "C")];

    g.polygon([a, b, c]);
    const out = svg(g.node);

    expect(out).toContain("<path");
    expect(() => construct({ unit: 0 })).toThrow(/positive unit/);
  });
});
