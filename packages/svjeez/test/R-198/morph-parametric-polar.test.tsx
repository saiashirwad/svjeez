import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez";
import { commands, graph, smilValues, square, svgOf } from "../helpers/calculus";

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
