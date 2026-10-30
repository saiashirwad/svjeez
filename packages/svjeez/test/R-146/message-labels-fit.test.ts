import { describe, expect, test } from "bun:test";
import { lifelineX as x, sequenceOut as out } from "../helpers/layout-fixtures";

describe("sequence", () => {
  test("every message label fits between the lifelines it spans", () => {
    const pairs = [
      ["user", "api"],
      ["api", "db"],
      ["user", "db"],
    ] as const;

    pairs.forEach(([a, b], i) => {
      const label = out.rows[i]!.box;
      expect(label.x).toBeGreaterThan(x(a));
      expect(label.x + label.w).toBeLessThan(x(b));
    });
  });
});
