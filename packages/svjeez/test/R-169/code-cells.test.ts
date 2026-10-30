import { describe, expect, test } from "bun:test";
import { code } from "svjeez/extras";
import { sample } from "../helpers/extras-code";

describe("code", () => {
  const c = sample();

  test("cells are advance wide and lineHeight × fontSize tall, 1-based", () => {
    expect(c.at(2, 3)).toEqual({ x: 22, y: 40 });
  });

  test("words are the non-space runs, placed by column", () => {
    expect(
      c.words.filter((w) => w.line === 2).map(({ text, column, x }) => ({ text, column, x })),
    ).toEqual([
      { text: "x", column: 1, x: 10 },
      { text: "cd", column: 3, x: 22 },
    ]);
  });

  test("a gutter shifts the code right by the digits plus two columns", () => {
    expect(code("a", { x: 10, advance: 6, gutter: true }).at(1, 1).x).toBe(28);
  });
});
