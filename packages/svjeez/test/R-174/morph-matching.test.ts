import { describe, expect, test } from "bun:test";
import { code } from "svjeez/extras";
import { match } from "../../src/extras/morph";

describe("morph matching", () => {
  const sorted = (pairs: [number, number][]) => pairs.sort((p, q) => p[0] - q[0]);

  test("swapped words both move", () => {
    expect(sorted(match(code("a b").words, code("b a").words))).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  test("a line inserted above repeated words keeps each word on its own line", () => {
    const before = code("let x\nx").words;
    const after = code("x = 1\nlet x\nx").words;
    expect(sorted(match(before, after))).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ]);
  });
});

test("morph pairs runs by id before content, so a renamed word moves instead of fading", () => {
  const before = code([[["variable", "count", "n"], " = 1"]]).words;
  const after = code([["let ", ["variable", "total", "n"], " = 1"]]).words;
  expect(match(before, after)).toContainEqual([0, 1]);
});
