import { describe, expect, test } from "bun:test";
import { paramLiteral, parse } from "../../src/source";
import { meadow } from "../helpers/live-source";

describe("literals", () => {
  test("the parser finds each declared param's literal, and its options apart from it", () => {
    const source = parse(meadow);
    const flowers = paramLiteral(source, "flowers")!;

    expect(flowers).toMatchObject({ kind: "number", value: 5, param: { key: "flowers" } });
    expect(paramLiteral(source, "petal")).toMatchObject({ kind: "color", value: "#FF5D8F" });
    expect(paramLiteral(source, "rise")).toMatchObject({ kind: "ease", name: "bezier" });
    expect(
      source.literals
        .filter((l) => l.param?.key === "flowers")
        .map((l) => [l.text, l.param?.option]),
    ).toEqual([
      ["5", undefined],
      ["1", "min"],
      ["12", "max"],
      ['"how many"', "label"],
    ]);
  });
});
