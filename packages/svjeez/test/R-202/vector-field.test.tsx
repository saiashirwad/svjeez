import { describe, expect, test } from "bun:test";
import { vectorField } from "svjeez/extras";
import { bounds } from "../helpers/field";

describe("vectorField", () => {
  test("draws one arrow per lattice point that has a field", () => {
    const { arrows, d } = vectorField((x) => [x < 200 ? 0 : 1, 0], { bounds, spacing: 50 });

    expect(arrows.length).toBe(4 * 6);
    expect(d.match(/M/g)).toHaveLength(arrows.length * 2);
    expect(arrows.every((a) => a.to.x > a.from.x && a.to.y === a.from.y)).toBe(true);
  });
});
