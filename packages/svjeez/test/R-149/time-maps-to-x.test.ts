import { describe, expect, test } from "bun:test";
import { lanesOut as out } from "../helpers/layout-fixtures";

describe("lanes", () => {
  test("time maps linearly onto x after the label column", () => {
    expect(out.x(2) - out.x(1)).toBe(50);
    expect(out.x(0)).toBeGreaterThan(80);
    expect(out.spans[0]).toMatchObject({ x: out.x(1), w: 100 });
  });
});
