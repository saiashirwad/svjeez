import { describe, expect, test } from "bun:test";
import { chart } from "../helpers/diagram-fixtures";

describe("flowchart", () => {
  test("route begins with the first hop's edge, and throws with no path", () => {
    expect(chart.route("work", "end").slice(0, chart.edge("work", "check").length)).toEqual(
      chart.edge("work", "check"),
    );
    expect(() => chart.route("end", "start")).toThrow();
    expect(() => chart.edge("start", "end")).toThrow();
  });
});
