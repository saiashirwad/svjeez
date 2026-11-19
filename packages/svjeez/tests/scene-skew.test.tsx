import { describe, expect, test } from "bun:test";
import { Group, Shape, ease, enter, rect, scene, span, track } from "svjeez";
import { boxesOf, check, placements, svg } from "svjeez/tools";

const made = (child: () => ReturnType<typeof Shape>, duration = 2) =>
  scene({ size: [200, 100], duration, title: "Skew" }, child);

const matrixOf = (model: ReturnType<typeof made>, t: number, key = "s") =>
  placements(model, t).find((placed) => placed.key === key)!.matrix;

describe("skew", () => {
  test("shears x about the origin, before scale and rotate", () => {
    const model = made(() => (
      <Shape key="s" geometry={rect(20, 10)} fill="#000000" origin="top-left" skew={45} />
    ));

    const [a, b, c, d] = matrixOf(model, 0);

    expect([a, b, c, d].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([1, 0, 1, 1]);

    const both = made(() => (
      <Shape
        key="s"
        geometry={rect(20, 10)}
        fill="#000000"
        origin="top-left"
        skew={45}
        scale={[2, 3]}
        rotate={90}
      />
    ));

    // rotate(90) · scale(2, 3) · skewX(45): the first column turns to [0, 2], the second to [-3, 2].
    expect(matrixOf(both, 0).map((n) => Math.round(n * 1e6) / 1e6)).toEqual([0, 2, -3, 2, 0, 0]);
  });

  test("a track animates it, and a motion layer takes it", () => {
    const model = made(() => (
      <Group>
        <Shape
          key="s"
          geometry={rect(20, 10)}
          fill="#000000"
          origin="top-left"
          skew={track(0).to(45, span(0, 1), ease.linear)}
        />
        <Shape
          key="m"
          geometry={rect(20, 10)}
          fill="#000000"
          origin="top-left"
          motion={{ skew: 45 }}
        />
      </Group>
    ));

    expect(matrixOf(model, 0.5)[2]).toBeCloseTo(Math.tan(Math.PI / 8), 6);
    expect(matrixOf(model, 1)[2]).toBeCloseTo(1, 6);
    expect(matrixOf(model, 0, "m")[2]).toBeCloseTo(1, 6);
  });

  test("it widens the box a node takes up", () => {
    const model = made(() => (
      <Shape key="s" geometry={rect(20, 10)} fill="#000000" origin="top-left" skew={45} />
    ));

    expect(boxesOf(model, 0).s).toMatchObject({ x: 0, y: 0, width: 30, height: 10 });
  });

  test("enter() can start skewed", () => {
    const model = made(() => (
      <Shape
        key="s"
        geometry={rect(20, 10)}
        fill="#000000"
        origin="top-left"
        motion={enter(span(0, 1), { from: { skew: 45 } })}
      />
    ));

    expect(matrixOf(model, 0)[2]).toBeCloseTo(1, 6);
    expect(matrixOf(model, 1)[2]).toBeCloseTo(0, 6);
  });

  test("the SVG skews in a wrapper of its own, around the pivot", () => {
    const still = svg.emit(
      made(() => <Shape key="s" geometry={rect(20, 10)} at={[10, 10]} fill="#000000" skew={20} />),
    );

    expect(still).toContain("transform:skewX(20deg)");
    expect(still).toContain("transform-origin");
    expect(still).toMatch(/<g [^>]*skewX[^>]*>\s*<rect/);

    const moving = svg.emit(
      made(() => (
        <Shape
          key="s"
          geometry={rect(20, 10)}
          fill="#000000"
          skew={track(0).to(30, span(0, 1))}
          rotate={15}
          scale={2}
        />
      )),
    );

    expect(moving).toContain("transform:skewX(0deg)");
    expect(moving).toContain("transform:skewX(30deg)");
    expect(moving).toContain("rotate:15deg");
  });

  test("check sees a skewing node as moving", () => {
    const report = check(
      made(() => (
        <Shape key="s" geometry={rect(20, 10)} fill="#000000" skew={track(0).to(30, span(0, 1))} />
      )),
    );

    expect(report.lanes.some((lane) => lane.lane === "skew")).toBe(true);
  });
});
