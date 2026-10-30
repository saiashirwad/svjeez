import { describe, expect, test } from "bun:test";
import { machine } from "../helpers/diagram-fixtures";

describe("state", () => {
  test("walk lights each state for its dwell, with travel time between", () => {
    const walk = machine.walk(["idle", "run", "idle", "run", "done"], {
      at: 1,
      dwell: 1,
      speed: 1e9,
    });

    expect(walk.spans.idle.map((s) => s.at)).toEqual([1, expect.closeTo(3.7, 9)]);
    expect(walk.spans.done[0]!.at).toBeCloseTo(1 + 4 * 1.35, 9);
    expect(walk.end).toBeCloseTo(1 + 5 + 4 * 0.35, 9);
  });

  test("with one time per state, each lights then, the token arriving as it does", () => {
    const walk = machine.walk(["idle", "run", "done"], { at: [1, 5, 6], dwell: 2, speed: 1e9 });
    expect([walk.spans.idle[0]!.at, walk.spans.run[0]!.at, walk.spans.done[0]!.at]).toEqual([
      1, 5, 6,
    ]);
    expect(walk.spans.idle[0]!.over).toBeCloseTo(4 - 0.35, 9);
    expect(walk.spans.run[0]!.over).toBeCloseTo(1 - 0.35, 9);
    expect(walk.end).toBe(8);
  });
});
