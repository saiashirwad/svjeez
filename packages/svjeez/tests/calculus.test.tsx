import { describe, expect, test } from "bun:test";
import { ease, render, validateSvg, type Child } from "svjeez";
import { axes, readout } from "svjeez/extras";

const graph = () =>
  axes({ x: [-3, 3], y: [-1, 9], width: 400, height: 260, at: { x: 300, y: 60 } });

const svgOf = (...nodes: Child[]): string =>
  render({ width: 800, height: 400, duration: 6, title: "Calculus", reducedMotion: false }, nodes);

const smilValues = (svg: string): string[] =>
  [...svg.matchAll(/attributeName="d" values="([^"]*)"/g)].flatMap(([, v]) => v!.split(";"));

const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

const square = (x: number) => x * x;

describe("dot()", () => {
  test("sits on the curve and rides it as x sweeps", () => {
    const ax = graph();
    const dot = ax.dot(square, { from: -2, to: 2, at: 1, over: 2, ease: ease.linear });
    const svg = svgOf(dot.node);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(dot.point(0)).toEqual(ax.point(-2, 4));
    expect(dot.point(3)).toEqual(ax.point(2, 4));
    expect(dot.point(2).x).toBeCloseTo(ax.point(0, 0).x);
    expect(svg).toContain("@keyframes");
  });

  test("chained sweeps hold between them", () => {
    const ax = graph();

    const dot = ax.dot(square, [
      { from: 0, to: 2, at: 0, over: 1 },
      { from: 2, to: -1, at: 3, over: 1 },
    ]);

    expect(dot.point(2)).toEqual(ax.point(2, 4));
    expect(dot.point(5)).toEqual(ax.point(-1, 1));
  });
});

describe("tangent() and secant()", () => {
  test("the tangent's slope is the derivative", () => {
    const line = graph().tangent(square, 1.5);

    expect(line.slope(0)).toBeCloseTo(3, 6);
  });

  test("a secant whose h shrinks to 0 ends on the tangent", () => {
    const ax = graph();
    const secant = ax.secant(square, 1, { from: 1.5, to: 0, at: 0, over: 3 });
    const tangent = ax.tangent(square, 1);

    expect(secant.slope(0)).toBeCloseTo(3.5, 9);
    expect(secant.slope(3)).toBeCloseTo(2, 6);

    const moving = smilValues(svgOf(secant.node));
    const still = svgOf(tangent.node).match(/<path [^>]*\bd="([^"]*)"/)![1]!;

    expect(moving.length).toBeGreaterThan(2);
    expect(moving.at(-1)).toBe(still);
  });

  test("a tangent sliding along x moves its d through SMIL", () => {
    const values = smilValues(
      svgOf(graph().tangent(square, { from: -2, to: 2, at: 0, over: 4 }).node),
    );

    expect(new Set(values.map(commands)).size).toBe(1);
    expect(values.length).toBeGreaterThan(3);
  });
});

describe("area()", () => {
  test("measures the region and grows with its right bound", () => {
    const area = graph().area(square, 0, { from: 0, to: 2, at: 1, over: 2 });

    expect(area.value(0)).toBeCloseTo(0);
    expect(area.value(3)).toBeCloseTo(8 / 3, 3);
    expect(smilValues(svgOf(area.node)).at(-1)).toMatch(/Z$/);
  });
});

describe("riemann()", () => {
  test("every stage is one path with the same commands, and the sums converge", () => {
    const sums = (n: number) =>
      graph().riemann(square, { from: 0, to: 2, n, rule: "left" }).sums[0]!;

    const r = graph().riemann(square, { from: 0, to: 2, n: [2, 4, 8], at: [1, 3] });
    const values = smilValues(svgOf(r.node));

    expect(sums(2)).toBeCloseTo(1);
    expect(r.sums[2]!).toBeCloseTo(8 / 3, 1);
    expect(new Set(values.map(commands)).size).toBe(1);
    expect(values[0]!.match(/M/g)).toHaveLength(8);
  });

  test("needs one start time per later stage", () => {
    expect(() => graph().riemann(square, { n: [4, 8, 16], at: [1] })).toThrow(
      "riemann() has 3 stages, so it needs 2 start times in at, got 1.",
    );
  });
});

describe("morph()", () => {
  test("one curve bends through each function, its stroke with it", () => {
    const ax = graph();

    const bend = ax.morph([() => 1, (x) => 1 + x, square], {
      at: [1, 3],
      color: ["#ff0000", "#00ff00", "#0000ff"],
    });

    const svg = svgOf(bend.node);
    const values = smilValues(svg);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(new Set(values.map(commands)).size).toBe(1);
    expect(values.at(-1)).toContain(`${ax.point(3, 9).x} ${ax.point(3, 9).y}`);
    expect(svg).toMatch(/stroke:#0000ff/);
  });
});

describe("parametric() and polar()", () => {
  test("a unit circle both ways lands on the same points", () => {
    const ax = graph();

    const circle = ax.parametric((t) => [Math.cos(t), 4 + Math.sin(t)], [0, Math.PI], {
      samples: 3,
    });

    const rose = ax.polar(() => 1, [0, Math.PI], { samples: 3 });

    const at = (x: number, y: number) => {
      const p = ax.point(x, y);

      return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    };

    expect(circle.points).toEqual([at(1, 4), at(0, 5), at(-1, 4)]);
    expect(rose.points[1]).toEqual(at(0, 1));
  });
});

describe("readout()", () => {
  test("shows one text per value it holds", () => {
    const svg = svgOf(readout((t) => (t < 2 ? "low" : "high"), { at: 1, over: 2, step: 0.5 }));

    expect(svg.match(/<text/g)).toHaveLength(2);
    expect(svg).toContain(">low</text>");
    expect(svg).toContain(">high</text>");
  });
});
