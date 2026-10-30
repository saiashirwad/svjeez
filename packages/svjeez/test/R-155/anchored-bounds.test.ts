import { describe, expect, test } from "bun:test";
import { sequence, stateMachine } from "svjeez/extras";
import { chart, inside } from "../helpers/diagram-fixtures";

describe("flowchart", () => {
  test("bounds start at x, y and hold every node and group", () => {
    expect([chart.bounds.x, chart.bounds.y]).toEqual([100, 50]);

    for (const id of ["start", "check", "work", "db", "end", "core"] as const)
      expect(inside(chart.bounds, chart.get(id))).toBe(true);
    expect(inside(chart.get("core"), chart.get("work"))).toBe(true);
  });
});

describe("state", () => {
  test("anchor puts that point of the bounds on x, y", () => {
    const centered = stateMachine(
      { states: { a: "A", b: "B" }, initial: "a", transitions: [["a", "b"]] },
      { x: 400, y: 300, anchor: "center" },
    );

    expect(centered.bounds.center).toEqual({ x: 400, y: 300 });

    const below = sequence({ actors: { a: "A" }, messages: [] }, { x: 50, y: 20, anchor: "top" });
    expect(below.bounds.top).toEqual({ x: 50, y: 20 });
  });
});
