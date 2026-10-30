import { describe, expect, test } from "bun:test";
import { rect } from "svjeez";
import { toBars } from "../../src/index.ts";
import { map } from "../helpers/geo-world.ts";

describe("toBars()", () => {
  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60 };
  const frame = rect(600, 100, 300, 200);
  const { bars } = toBars(map, people, { at: 1, frame });

  test("sorts the biggest first and scales width to value", () => {
    expect(bars.map((b) => b.region.properties?.name)).toEqual([
      "Germany",
      "France",
      "Italy",
      "Spain",
    ]);
    expect(bars[0]!.rect.w).toBe(300);
    expect(bars[1]!.rect.w).toBeCloseTo((300 * 67) / 83, 0);
    expect(bars[0]!.rect.y).toBeLessThan(bars[1]!.rect.y);
    expect(bars.at(-1)!.rect.y + bars.at(-1)!.rect.h).toBeLessThanOrEqual(300);
  });

  test("keeps only the top few and can run smallest first", () => {
    const two = toBars(map, people, { at: 1, frame, top: 2, order: "asc" });

    expect(two.bars.map((b) => b.region.properties?.name)).toEqual(["France", "Germany"]);
    expect(two.rest).toContain(map.region("Spain").d);
  });
});
