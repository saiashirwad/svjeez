import { describe, expect, test } from "bun:test";
import { inkPath, tool } from "svjeez";

describe("tools", () => {
  test("each subpath becomes its own closed outline", () => {
    expect(inkPath("M0 0H50M0 20H50", tool.pen()).match(/Z/g)).toHaveLength(2);
  });
});
