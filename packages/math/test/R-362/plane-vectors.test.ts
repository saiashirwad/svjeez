import { describe, expect, test } from "bun:test";
import { base, numbers, shear, svg } from "../helpers/plane";

describe("plane", () => {
  test("a vector under a matrix keeps an upright head that turns with atan2", () => {
    const out = svg(shear.css, shear.vector([1, 0], { label: "v" }));
    expect(out).toContain("rotate:atan2(");
    expect(out).toMatch(/<polygon points="4,0 -8,-5.5 -8,5.5"/);
  });

  test("a vector under a function keeps its head the same triangle at every key", () => {
    const bent = base.applyFunction((x, y) => [Math.cos(y) * (1 + x), Math.sin(y) * (1 + x)], {
      at: 1,
      over: 2,
    });

    const out = svg(bent.css, bent.vector([0, 2]));

    const heads = out.match(
      /<path d="[^"]*Z" fill="[^"]*" class="dm">\s*<animate attributeName="d" values="([^"]*)"/,
    )![1]!;

    const sides = heads.split(";").map((d) => {
      const [ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0] = numbers(d);

      return [
        Math.hypot(ax - bx, ay - by),
        Math.hypot(bx - cx, by - cy),
        Math.hypot(cx - ax, cy - ay),
      ];
    });

    for (const s of sides) s.forEach((side, i) => expect(side).toBeCloseTo(sides[0]![i]!, 0));
  });

  test("a vector needs a finite arrow of nonzero length", () => {
    expect(() => base.vector([0, 0])).toThrow(
      "plane.vector() needs a finite arrow of nonzero length",
    );
  });
});
