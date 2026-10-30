import { describe, expect, test } from "bun:test";
import { lifelineX as x, sequenceOut as out } from "../helpers/layout-fixtures";

describe("sequence", () => {
  test("arrows run lifeline to lifeline, one row below the last", () => {
    expect(out.rows[0]!.points).toEqual([
      { x: x("user"), y: out.rows[0]!.points[0]!.y },
      { x: x("api"), y: out.rows[0]!.points[0]!.y },
    ]);
    const tops = out.rows.map((r) => Math.min(r.box.y, ...r.points.map((p) => p.y)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(out.lifelines.get("api")![1].y).toBeGreaterThan(
      Math.max(...out.rows.map((r) => r.box.y + r.box.h)),
    );
  });

  test("a self message's label clears the next lifeline", () => {
    const self = out.rows[3]!;
    expect(self.points[1]!.x).toBeGreaterThan(x("api"));
    expect(self.box.x + self.box.w).toBeLessThan(x("db"));
  });
});
