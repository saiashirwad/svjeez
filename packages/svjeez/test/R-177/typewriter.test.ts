import { describe, expect, test } from "bun:test";
import { code, typewriter } from "svjeez/extras";

describe("typewriter", () => {
  test("typewriter reports when each line types, a blank line taking only its newline", () => {
    const { spans, end } = typewriter(code("ab\n\ncde"), { at: 1, cps: 10 });
    expect(spans.map(({ at, over }) => [at, over].map((n) => Number(n.toFixed(9))))).toEqual([
      [1, 0.2],
      [1.3, 0],
      [1.4, 0.3],
    ]);
    expect(end).toBeCloseTo(spans.at(-1)!.at + spans.at(-1)!.over, 9);
  });
});

describe("errors name the call, the constraint and the value", () => {
  test.each([
    [
      "typewriter",
      () => typewriter(code("a"), { at: -1 }),
      "typewriter() needs a non-negative start and a positive cps, got at -1 and cps 28.",
    ],
  ])("%s", (_, make, message) => {
    expect(make).toThrow(message);
  });
});
