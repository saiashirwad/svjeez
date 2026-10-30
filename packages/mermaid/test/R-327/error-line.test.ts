import { describe, expect, test } from "bun:test";
import { MermaidSyntaxError, parse } from "../../src/index";

describe("parse errors", () => {
  test("carry the line on the error", () => {
    expect(() => parse("flowchart TD\n%% x\nA --> \n")).toThrow(MermaidSyntaxError);
    expect(() => parse("flowchart TD\n%% x\nA --> \n")).toThrow(/line 3/);
  });
});
