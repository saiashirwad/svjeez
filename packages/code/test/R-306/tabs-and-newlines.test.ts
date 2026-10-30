import { describe, expect, test } from "bun:test";
import { highlight } from "../../src/index.ts";
import { flat } from "../helpers/code.ts";

describe("highlight", () => {
  test("expands tabs to the next tab stop", () => {
    expect(flat(highlight("\tx\ty", "js", { tabSize: 4 }))).toEqual(["    x   y"]);
    expect(flat(highlight("\tx", "js"))).toEqual(["  x"]);
  });

  test("accepts CRLF input", () => {
    expect(highlight("a\r\nb", "js")).toHaveLength(2);
  });

  test("a bad tab size throws", () => {
    expect(() => highlight("x", "js", { tabSize: 0 })).toThrow(/tabSize/);
  });
});
