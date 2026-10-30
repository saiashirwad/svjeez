import { describe, expect, test } from "bun:test";
import { matchPaths } from "svjeez";
import { commands } from "../helpers/paths";

describe("matchPaths", () => {
  test("rewrites shapes with different commands to the same commands", () => {
    const [square, circle, star] = matchPaths([
      "M0 0H10V10H0Z",
      "M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z",
      "m5 0 2 3h3l-2 3 1 4-4-2-4 2 1-4-2-3h3z",
    ]);

    expect(commands(square!)).toBe(commands(circle!));
    expect(commands(circle!)).toBe(commands(star!));
  });

  test("keeps the corners of a polygon it splits", () => {
    const [square] = matchPaths(["M0 0H10V10H0Z", "M0 0L1 0L2 0L3 0L4 0L5 0L6 0L7 0L8 0Z"]);

    for (const corner of ["10 0", "10 10", "0 10"]) expect(square).toContain(corner);
  });
});
