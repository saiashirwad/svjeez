import { describe, expect, test } from "bun:test";
import { construct } from "../../src/index";
import { svg } from "../helpers/construct";

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
  });
});
