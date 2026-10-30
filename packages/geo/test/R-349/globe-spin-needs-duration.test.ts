import { describe, expect, test } from "bun:test";
import { globe } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { frame } from "../helpers/moving.ts";

describe("globe()", () => {
  test("needs a duration with a spin function", () => {
    expect(() => globe(world, { frame, spin: (t) => [t, 0] })).toThrow(
      "globe() with a spin function needs a duration",
    );
  });
});
