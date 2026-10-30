import { describe, expect, test } from "bun:test";
import { parse } from "../../src/index";
import { message } from "../helpers/mermaid";

describe("parse errors", () => {
  test("reject another diagram type", () => {
    expect(message('pie title Pets\n"Dogs": 3')).toContain("Supported diagram types");
    expect(message("erDiagram\nA ||--o{ B : has")).toContain("line 1");
  });

  test("reject empty text", () => {
    expect(() => parse("  \n%% only a comment")).toThrow(/no Mermaid text/);
  });
});
