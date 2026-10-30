import { describe, expect, test } from "bun:test";
import { calc, css } from "svjeez";
import { px, style, yaw } from "../helpers/timeline-calc";

const { add, mul, sin, cos, length } = calc;

describe("calc", () => {
  test("the README orbit renders the same file as the hand-written css", () => {
    const built = css`.dot{translate:${add(length(100), mul(length(60), px, cos(yaw)))} 100px}`;
    expect(style(built)).toContain(
      ".dot{translate:calc(100px + 60px * var(--p1) * cos(var(--p2))) 100px}",
    );
  });

  test("properties read through the builder are registered once, under their render names", () => {
    const rule = style(css`.d{a:${mul(px, cos(yaw))};b:${mul(px, sin(yaw))}}`);
    expect(rule).toContain(
      ".d{a:calc(var(--p1) * cos(var(--p2)));b:calc(var(--p1) * sin(var(--p2)))}",
    );
    expect(rule.match(/@property/g)).toHaveLength(2);
  });
});
