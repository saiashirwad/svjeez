import { describe, expect, test } from "bun:test";
import { team, touches } from "../helpers/diagram-fixtures";

describe("tree", () => {
  test("route runs from one node up through the common ancestor and down to the other", () => {
    const trip = team.route("a1", "b");
    expect(touches(trip[0]!, team.get("a1"))).toBe(true);
    expect(touches(trip.at(-1)!, team.get("b"))).toBe(true);
    expect(Math.min(...trip.map((p) => p.y))).toBeCloseTo(
      team.get("root").y + team.get("root").h,
      6,
    );
  });
});
