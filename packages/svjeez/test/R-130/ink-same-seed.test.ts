import { describe, expect, test } from "bun:test";
import { inkPath, tool } from "svjeez";

describe("tools", () => {
  test("the same seed draws the same line", () => {
    const line = "M0 50H200";
    expect(inkPath(line, tool.pencil({ seed: 3 }))).toBe(inkPath(line, tool.pencil({ seed: 3 })));
  });
});
