import { describe, expect, test } from "bun:test";
import { polylinePath } from "svjeez";

describe("polylinePath", () => {
  test("writes M then L to each point, rounded to one place by default", () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 10.04, y: -2.36 },
      ]),
    ).toBe("M0 0L10 -2.4");
  });

  test("closes the shape and keeps more places when asked", () => {
    expect(
      polylinePath(
        [
          { x: 0.123, y: 0 },
          { x: 1, y: 1 },
        ],
        { closed: true, precision: 2 },
      ),
    ).toBe("M0.12 0L1 1Z");
  });
});
