import { describe, expect, test } from "bun:test";
import { code, defaultDark } from "svjeez/extras";

describe("code", () => {
  test("runs carry a role's theme color", () => {
    const theme = { ...defaultDark, base0D: "#00f" } as const;

    const named = code(
      [
        ["  ", ["fn", "f(a,", "call"]],
        [["fn", "b)", "call"], " x"],
      ],
      { advance: 6, fontSize: 10, lineHeight: 2, theme },
    );

    expect(named.words.map((w) => w.color)).toEqual(["#00f", "#00f", undefined]);
  });
});
