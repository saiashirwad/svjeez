import { describe, expect, test } from "bun:test";
import { flowchart } from "svjeez/extras";
import { spec } from "../helpers/diagram-fixtures";

describe("diagram options", () => {
  test("direction is an option and turns the ranks sideways", () => {
    const [down, across] = [flowchart(spec), flowchart(spec, { direction: "LR" })];
    expect(down.get("c").y).toBeGreaterThan(down.get("a").y);
    expect(across.get("c").x).toBeGreaterThan(across.get("a").x);
    expect(across.get("c").y).toBeCloseTo(across.get("a").y, 6);
  });
});
