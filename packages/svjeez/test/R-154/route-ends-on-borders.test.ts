import { describe, expect, test } from "bun:test";
import { chart, touches } from "../helpers/diagram-fixtures";

describe("flowchart", () => {
  test("route runs edge to edge from the first node to the last", () => {
    const trip = chart.route("start", "end");
    expect(touches(trip[0]!, chart.get("start"))).toBe(true);
    expect(touches(trip.at(-1)!, chart.get("end"))).toBe(true);
  });
});
