import { describe, expect, test } from "bun:test";
import { team } from "../helpers/diagram-fixtures";

describe("tree", () => {
  test("a parent sits centered over its children", () => {
    expect(team.get("root").center.x).toBeCloseTo(
      (team.get("a").center.x + team.get("b").center.x) / 2,
      6,
    );
  });
});
