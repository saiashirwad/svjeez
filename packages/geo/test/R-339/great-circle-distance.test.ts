import { describe, expect, test } from "bun:test";
import { distance } from "../../src/index.ts";
import { LONDON, NEW_YORK } from "../helpers/geo-world.ts";

describe("distance()", () => {
  test("measures great circles in kilometres", () => {
    expect(distance([NEW_YORK, LONDON])).toBeCloseTo(5570, -1);
    expect(distance([NEW_YORK, LONDON, NEW_YORK])).toBeCloseTo(2 * distance([NEW_YORK, LONDON]));
  });
});
