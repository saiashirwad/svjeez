import { describe, expect, test } from "bun:test";
import { everyForm, flow, message } from "../helpers/mermaid";

describe("parse flowchart", () => {
  test("reads every edge style and label form", () => {
    const doc = flow(everyForm);

    expect(doc.edges.map((e) => [e.from, e.to, e.label, e.line, e.arrow])).toEqual([
      ["A", "B", undefined, "solid", true],
      ["B", "C", undefined, "solid", true],
      ["C", "D", undefined, "dotted", true],
      ["D", "E", undefined, "thick", true],
      ["E", "F", undefined, "solid", false],
      ["F", "G", "text", "solid", true],
      ["G", "A", "piped", "solid", true],
      ["A", "B", "dotted label", "dotted", true],
      ["B", "C", "thick label", "thick", true],
    ]);
  });

  test("chains and & lists expand to every edge", () => {
    const doc = flow("graph TD\nA & B --> C & D --> E");

    expect(doc.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      "A>C",
      "A>D",
      "B>C",
      "B>D",
      "C>E",
      "D>E",
    ]);
  });
});

describe("parse errors", () => {
  test("reject an edge with no target", () => {
    expect(message("flowchart TD\nA --> ")).toContain("line 2");
  });
});
