import { describe, expect, test } from "bun:test";
import { render, sampled } from "svjeez";
import { lane, scene } from "../helpers/timeline-sampled";

describe("sampled", () => {
  test("a jump in the function is a cut, not a tween across it", () => {
    const svg = render(
      { width: 100, height: 100, duration: 2, title: "Test" },
      <rect
        width={10}
        height={10}
        animation={sampled((t) => ({ rotate: t < 1 ? 360 * t : 0 }), {
          duration: 2,
          tolerance: { rotate: 0.5 },
        })}
      />,
    );

    const [body] = lane(svg, "rotate");

    const keys = [...body!.matchAll(/([\d.%,]+)\{rotate:(-?[\d.]+)deg([^}]*)\}/g)]
      .flatMap(([, percents, value, rest]) =>
        percents!.split(",").map((percent) => ({
          at: parseFloat(percent) / 50,
          rotate: Number(value),
          held: rest!.includes("steps(1)"),
        })),
      )
      .sort((a, b) => a.at - b.at);

    const top = keys.findIndex((key) => key.rotate > 359);
    expect(keys[top]!.held).toBe(true);
    expect(keys[top + 1]!.rotate).toBe(0);
    expect(keys[top + 1]!.at - keys[top]!.at).toBeLessThan(0.001);
  });

  test("a steep but smooth function keeps its tween", () => {
    const steep = (t: number) => ({ x: 100 / (1 + Math.exp(-(t - 1) * 400)) });

    const [body] = lane(
      scene(sampled(steep, { duration: 2, tolerance: { translate: 0.5 } }), 2),
      "translate",
    );

    expect(body).not.toContain("steps(1)");
  });
});
