import { describe, expect, test } from "bun:test";
import { wiggle } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("a wiggle whose rate divides its period unevenly still renders", () => {
    expect(() =>
      scene(<rect width={10} height={10} animation={wiggle({ x: 3 }, { seed: 1, rate: 12 })} />),
    ).not.toThrow();
  });
});
