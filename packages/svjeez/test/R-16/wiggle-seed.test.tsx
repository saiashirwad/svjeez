import { describe, expect, test } from "bun:test";
import { random, render, wiggle } from "svjeez";

describe("random", () => {
  test("wiggle takes its noise from random(String(seed))", () => {
    const svg = render(
      { width: 10, height: 10, duration: 2, title: "t" },
      <rect width={1} height={1} animation={wiggle({ x: 10 }, { seed: 5 })} />,
    );

    const first = Number(/0%\{translate:(-?[\d.]+)px/.exec(svg)?.[1]);

    expect(first).toBeCloseTo(10 * (random("5")() * 2 - 1), 2);
  });
});
