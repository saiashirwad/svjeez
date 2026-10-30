import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { axes, contourSweep } from "svjeez/extras";

describe("contourSweep", () => {
  const plot = axes({ x: [-2, 2], y: [-2, 2], width: 200, height: 200 });

  test("morphs one path through every level", () => {
    const sweep = contourSweep((x, y) => x * x + y * y, {
      axes: plot,
      from: 0.25,
      to: 3,
      at: 1,
      over: 2,
      frames: 6,
    });

    const svg = render(
      { width: 220, height: 220, duration: 4, title: "Sweep" },
      <path d={sweep.d} animation={sweep.animation} />,
    );

    expect(svg).toContain('attributeName="d"');
  });

  test("names the level that has no line", () => {
    expect(() =>
      contourSweep((x, y) => x * x + y * y, { axes: plot, from: -1, to: 1, at: 0, over: 1 }),
    ).toThrow("contourSweep() found no line at level -1.");
  });
});
