import { describe, expect, test } from "bun:test";
import { Stroke, brush, ink, nib, pen, pencil, render, type Child } from "svjeez";
import { flatten } from "../src/ink/path";

const scene = (child: Child) => render({ width: 200, height: 100, duration: 2, title: "Ink" }, child);

/** Width of an outline across its middle, measured perpendicular to a horizontal stroke. */
const thickness = (d: string, x: number): number => {
  const ys: number[] = [];
  let [px, py] = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MlLqZ])([^MlLqZ]*)/g)) {
    const n = (args!.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const visit = (nx: number, ny: number) => {
      [px, py] = [nx, ny];
      if (Math.abs(px - x) < 1) ys.push(py);
    };
    if (cmd === "M" || cmd === "L") visit(n[0]!, n[1]!);
    else if (cmd === "l") for (let i = 0; i < n.length; i += 2) visit(px + n[i]!, py + n[i + 1]!);
    else if (cmd === "q") visit(px + n[2]!, py + n[3]!);
  }
  return Math.max(...ys) - Math.min(...ys);
};

describe("flatten", () => {
  test("reads absolute and relative lines, curves and arcs", () => {
    const [line] = flatten("M0 0L10 0l0 10H0v-10Z");
    expect(line!.closed).toBe(true);
    expect(line!.points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const curve = flatten("M0 0C0 10 10 10 10 0")[0]!.points;
    expect(curve.at(-1)).toEqual({ x: 10, y: 0 });
    expect(Math.max(...curve.map((p) => p.y))).toBeCloseTo(7.5, 1);
    const arc = flatten("M0 0A10 10 0 0 1 20 0")[0]!.points;
    expect(arc.at(-1)!.x).toBeCloseTo(20, 6);
    expect(Math.min(...arc.map((p) => p.y))).toBeCloseTo(-10, 0);
  });

  test("splits subpaths and mirrors smooth control points", () => {
    expect(flatten("M0 0L5 0M10 0L15 0")).toHaveLength(2);
    const smooth = flatten("M0 0C0 10 10 10 10 0S20 -10 20 0")[0]!.points;
    expect(Math.min(...smooth.map((p) => p.y))).toBeCloseTo(-7.5, 1);
  });

  test("a smooth curve after the other curve type starts its control point at the current point", () => {
    for (const d of ["M0 0Q10 10 20 0S30 0 40 0", "M0 0C0 10 20 10 20 0T40 0"]) {
      expect(Math.min(...flatten(d)[0]!.points.map((p) => p.y))).toBeCloseTo(0, 6);
    }
  });

  test("an arc that ends where it starts is skipped", () => {
    expect(flatten("M0 0A10 10 0 0 1 0 0L10 0")[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  test("rejects malformed data", () => {
    expect(() => flatten("10 10")).toThrow("must start with a command");
    expect(() => flatten("M0")).toThrow("needs 2 numbers");
  });
});

describe("tools", () => {
  const line = "M0 50H200";

  test("a pen draws an even line at its size", () => {
    const d = ink(line, pen({ size: 2, taper: 0 }));
    expect(thickness(d, 100)).toBeCloseTo(2, 0);
  });

  test("a brush is widest mid-stroke and comes to a point at the ends", () => {
    const d = ink(line, brush({ size: 8, pressure: 0, wobble: 0 }));
    expect(thickness(d, 100)).toBeCloseTo(8, 0);
    expect(thickness(d, 3)).toBeLessThan(2);
  });

  test("a nib is thick across its edge and thin along it", () => {
    const tool = nib({ size: 6, angle: 0, thin: 0.1 });
    expect(thickness(ink(line, tool), 100)).toBeCloseTo(0.6, 0);
    expect(tool.width(0.5, 50, Math.PI / 2)).toBeCloseTo(6, 6);
  });

  test("a pencil wavers with a seed, and the same seed draws the same line", () => {
    expect(ink(line, pencil({ seed: 3 }))).toBe(ink(line, pencil({ seed: 3 })));
    expect(ink(line, pencil({ seed: 3 }))).not.toBe(ink(line, pencil({ seed: 4 })));
  });

  test("each subpath becomes its own closed outline", () => {
    expect(ink("M0 0H50M0 20H50", pen()).match(/Z/g)).toHaveLength(2);
  });
});

describe("Stroke", () => {
  test("a still stroke is one filled outline from a symbol", () => {
    const svg = scene(<Stroke d="M10 50H190" tool={brush()} color="#123456" />);
    expect(svg).toContain('fill="#123456"');
    expect(svg.match(/<use /g)).toHaveLength(1);
    expect(svg).not.toContain("<mask");
  });

  test("draw reveals it through a mask, then hands over to an unmasked copy", () => {
    const svg = scene(<Stroke d="M10 50H190" tool={brush()} draw={{ at: 0.2, over: 1 }} />);
    expect(svg.match(/<mask /g)).toHaveLength(1);
    expect(svg.match(/<use /g)).toHaveLength(2);
    expect(svg.match(/<symbol /g)).toHaveLength(1);
    expect(svg).toContain('pathLength="1"');
  });

  test("the same path and tool embed their outline once", () => {
    const tool = pen();
    const svg = scene(
      <>
        <Stroke d="M10 50H190" tool={tool} />
        <Stroke d="M10 50H190" tool={tool} color="red" />
      </>,
    );
    expect(svg.match(/<symbol /g)).toHaveLength(1);
  });
});
