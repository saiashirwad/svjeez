import { describe, expect, test } from "bun:test";
import { chart } from "../helpers/diagram-fixtures";

describe("flowchart", () => {
  test("a decision's edges end on the diamond, not its bounding box", () => {
    const into = chart.edge("start", "check").at(-1)!;
    const b = chart.get("check");
    expect(
      Math.abs(into.x - b.center.x) / (b.w / 2) + Math.abs(into.y - b.center.y) / (b.h / 2),
    ).toBeCloseTo(1, 6);
  });
});
