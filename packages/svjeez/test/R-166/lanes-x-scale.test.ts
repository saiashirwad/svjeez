import { describe, expect, test } from "bun:test";
import { run } from "../helpers/diagram-fixtures";

describe("lanes", () => {
  test("x maps seconds onto the lane axis at the given scale", () => {
    expect(run.x(2) - run.x(1)).toBe(50);
    expect(run.x(0)).toBeGreaterThan(run.get("a").x);
    expect(run.get("b").y).toBe(run.get("a").y + run.get("a").h);
  });
});
