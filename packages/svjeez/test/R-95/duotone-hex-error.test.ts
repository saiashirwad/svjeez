import { describe, expect, test } from "bun:test";
import { fx } from "svjeez";

describe("image filters", () => {
  test("duotone refuses a named color with the hex message", () => {
    // @ts-expect-error a named color is a type error; untyped callers still get the runtime check
    expect(() => fx.duotone({ dark: "red", light: "#fff" })).toThrow(
      "fx.duotone() needs #rgb or #rrggbb colors, got red.",
    );
  });
});
