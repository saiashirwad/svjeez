import { describe, expect, test } from "bun:test";
import { highlight } from "../../src/index.ts";
import { flat } from "../helpers/code.ts";

describe("highlight", () => {
  test("tags runs with roles and keeps plain text bare", () => {
    expect(highlight("const x = 1;", "ts")).toEqual([
      [["keyword", "const"], " x ", ["punct", "="], " ", ["number", "1"], ["punct", ";"]],
    ]);
  });

  test("returns one array per line and gives an empty line no pieces", () => {
    const lines = highlight("a\n\n// b\n", "ts");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]).toEqual([["comment", "// b"]]);
  });

  test("the pieces of a line spell the source line", () => {
    const source = 'export const f = async (a: string) => <A b="c">{a}</A>;';

    expect(flat(highlight(source, "tsx"))).toEqual([source]);
  });

  test("merges adjacent runs of one role", () => {
    const [line] = highlight("// one two three", "ts");

    expect(line).toEqual([["comment", "// one two three"]]);
  });
});
