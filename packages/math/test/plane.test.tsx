import { describe, expect, test } from "bun:test";
import { Group, Shape, morph, span, track } from "svjeez";
import { svg } from "svjeez/tools";
import { Axes, plane } from "../src/index.ts";
import { find, made, mono } from "./helpers.ts";

const graph = plane({ x: [-2, 2], y: [0, 4], size: [200, 100] });

describe("plane()", () => {
  test("point() maps the ranges onto the size, y up", () => {
    expect(graph.point([-2, 4])).toEqual([0, 0]);
    expect(graph.point([2, 0])).toEqual([200, 100]);
    expect(graph.point([0, 2])).toEqual([100, 50]);
  });

  test("bad ranges and sizes say what they need", () => {
    expect(() => plane({ x: [1, 1], y: [0, 1], size: [10, 10] })).toThrow("x as [min, max]");
    expect(() => plane({ x: [0, 1], y: [0, 1], size: [0, 10] })).toThrow(
      "a size of two lengths above 0",
    );
  });

  test("plot() splits where the curve leaves the range", () => {
    const geometry = graph.plot((x) => (Math.abs(x) < 0.5 ? 99 : 1));

    const model = made(() => (
      <Shape key="curve" geometry={geometry} stroke={{ color: "#000000" }} />
    ));

    const d = svg.emit(model).match(/<path d="([^"]+)"/)?.[1] ?? "";

    expect(d.match(/M/g)?.length).toBe(2);
    expect(() => graph.plot(() => 99)).toThrow("plot() draws nothing");
  });

  test("riemann() keys bars by their left edge, so halving keeps every other bar", () => {
    const f = (x: number) => x * x;
    const two = graph.riemann(f, { from: 0, to: 2, n: 2 });
    const four = graph.riemann(f, { from: 0, to: 2, n: 4 });

    expect(two.bars.map((bar) => bar.key)).toEqual(["0", "1"]);
    expect(four.bars.map((bar) => bar.key)).toEqual(["0", "0.5", "1", "1.5"]);
    expect(four.sum).toBeCloseTo(0.5 * (0 + 0.25 + 1 + 2.25));
    expect(graph.riemann(f, { from: 0, to: 2, n: 2, at: 1 }).sum).toBeCloseTo(5);
    expect(() => graph.riemann(f, { from: 0, to: 2, n: 1.5 })).toThrow("whole number of bars");
    expect(() => graph.riemann(f, { from: 0, to: 2, n: 2, at: 2 })).toThrow("at between 0 and 1");

    const bars = (n: number) => (
      <Group>
        {graph.riemann(f, { from: 0, to: 2, n }).bars.map((bar) => (
          <Shape key={bar.key} geometry={bar.geometry} fill="#000000" />
        ))}
      </Group>
    );

    expect(() => made(() => morph(bars(2), bars(4), span(1, 1)))).not.toThrow();
  });

  test("slope, tangent and secant agree on a parabola", () => {
    const f = (x: number) => x * x;

    expect(graph.slope(f, 1)).toBeCloseTo(2);
    expect(() => graph.secant(f, 1, 0.5)).not.toThrow();
    expect(graph.secant(f, 1, 0)).toEqual(graph.tangent(f, 1));
  });

  test("transform() blends points toward a matrix or a function", () => {
    const shear = graph.transform([
      [1, 1],
      [0, 1],
    ]);

    expect(shear.point([0, 1])).toEqual(graph.point([1, 1]));
    expect(graph.transform(([x, y]) => [x * 2, y], 0.5).point([1, 1])).toEqual(
      graph.point([1.5, 1]),
    );
    expect(() => graph.transform(() => [Number.NaN, 0]).point([1, 1])).toThrow(
      "which is not a point",
    );
  });

  test("a grid follows a track through derived geometry", () => {
    const amount = track(0).to(1, span(0.5, 1)).rewind(1);

    const model = made(() => (
      <Shape
        key="grid"
        geometry={amount.map((t) =>
          graph
            .transform(
              [
                [2, 1],
                [0, 1],
              ],
              t,
            )
            .grid(1),
        )}
        stroke={{ color: "#000000" }}
      />
    ));

    expect(svg.emit(model)).toContain("<animate");
  });

  test("vector() is one filled outline from tail to tip", () => {
    expect(() => graph.vector([0, 0])).toThrow("needs a tip away from its tail");
    expect(() =>
      made(() => <Shape geometry={graph.vector([1, 2])} fill="#000000" />),
    ).not.toThrow();
  });

  test("<Axes> draws axes, ticks, a grid and numbers", () => {
    const model = made(() => (
      <Axes
        key="axes"
        plane={graph}
        stroke={{ color: "#000000" }}
        grid={{ color: "#888888", width: 0.5 }}
        labels={{ font: mono, size: 10, fill: "#000000" }}
      />
    ));

    expect(find(model, "axes/grid").kind).toBe("shape");
    expect(find(model, "labels/x -2").kind).toBe("text");
    expect(find(model, "labels/y 4").kind).toBe("text");
    expect(() =>
      made(() => <Axes plane={graph} stroke={{ color: "#000000" }} ticks={0} />),
    ).toThrow("<Axes> needs ticks above 0");
  });
});
