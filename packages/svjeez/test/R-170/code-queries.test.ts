import { describe, expect, test } from "bun:test";
import { code } from "svjeez/extras";
import { sample } from "../helpers/extras-code";

describe("code", () => {
  const c = sample();

  test("cells are advance wide and lineHeight × fontSize tall, 1-based", () => {
    expect(c.lines(1, 2)).toMatchObject({ x: 10, y: 20, w: 24, h: 40 });
    expect(() => c.at(3, 1)).toThrow();
  });

  test("find matches across token boundaries and counts occurrences", () => {
    expect(c.find("bc")).toMatchObject({ x: 16, y: 20, w: 12, h: 20 });
    expect(c.find("cd", 2)).toMatchObject({ x: 22, y: 40, w: 12 });
    expect(() => c.find("cd", 3)).toThrow();
  });

  test("runs carry an id that get() bounds", () => {
    const named = code(
      [
        ["  ", ["fn", "f(a,", "call"]],
        [["fn", "b)", "call"], " x"],
      ],
      { advance: 6, fontSize: 10, lineHeight: 2 },
    );

    expect(named.get("call")).toMatchObject({ x: 0, y: 0, w: 36, h: 40 });
  });
});
