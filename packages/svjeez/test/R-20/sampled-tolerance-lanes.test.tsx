import { describe, expect, test } from "bun:test";
import { def, render, sampled } from "svjeez";
import { PERIOD, circle, lane, translateKeys } from "../helpers/timeline-sampled";

describe("sampled", () => {
  test("a property is its own lane with its own tolerance", () => {
    const depth = def.property("depth", { syntax: "number", inherits: false, initial: 0 });
    const flat = def.property("flat", { syntax: "number", inherits: false, initial: 0 });

    const motion = sampled((t) => ({ ...circle(t), [depth]: circle(t).x, [flat]: 2 }), {
      duration: PERIOD,
      tolerance: { translate: 1, [depth]: 0.001, [flat]: 0.01 },
    });

    const svg = render(
      { width: 100, height: 100, duration: PERIOD, title: "Test" },
      <rect width={10} height={10} animation={motion} />,
    );

    const [depthLane] = lane(svg, "--p1");
    expect(depthLane!.split("}").length).toBeGreaterThan(translateKeys(svg, PERIOD).length);
    expect(lane(svg, "--p2")).toEqual(["0%,100%{--p2:2}"]);
  });

  test("a lane without a tolerance is an error", () => {
    // @ts-expect-error opacity has no tolerance
    expect(() => sampled(() => ({ opacity: 1 }), { duration: 1, tolerance: {} })).toThrow(
      /tolerance for `opacity`/,
    );
  });
});
