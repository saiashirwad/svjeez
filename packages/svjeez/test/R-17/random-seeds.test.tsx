import { describe, expect, test } from "bun:test";
import { random } from "svjeez";

const draw = (next: () => number, count = 50) => Array.from({ length: count }, next);

describe("random", () => {
  test("the same seed gives the same numbers from 0 up to 1, and another seed others", () => {
    const a = draw(random(7));

    expect(draw(random(7))).toEqual(a);
    expect(draw(random(8))).not.toEqual(a);
    expect(draw(random("leg-3"))).toEqual(draw(random("leg-3")));
    expect(draw(random("leg-3"))).not.toEqual(draw(random("leg-4")));
    expect(a.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  test("a whole number seed is not hashed: its stream is the known mulberry32 one", () => {
    expect(random(1)()).toBe(0.6270739405881613);
  });

  test("a fractional seed is an error", () => {
    expect(() => random(0.5)).toThrow("random() needs a whole number or a string seed, got 0.5.");
  });
});
