import { describe, expect, test } from "bun:test";
import { everyForm, flow, message } from "../helpers/mermaid";

describe("parse flowchart", () => {
  test("reads every node form and the direction", () => {
    const doc = flow(everyForm);

    expect(doc.direction).toBe("LR");
    expect(doc.nodes.map((n) => [n.id, n.label, n.form])).toEqual([
      ["A", "Rect", "rect"],
      ["B", "Round", "round"],
      ["C", "Stadium", "stadium"],
      ["D", "Decide", "diamond"],
      ["E", "Circle", "circle"],
      ["F", "Sub", "subroutine"],
      ["G", "Store", "cylinder"],
    ]);
  });

  test("a later definition names a node declared bare, and quoted labels may hold brackets", () => {
    const doc = flow('flowchart TD\nA --> B\nB["list[0]"]\nA{Which?}');

    expect(doc.nodes.map((n) => [n.label, n.form])).toEqual([
      ["Which?", "diamond"],
      ["list[0]", "rect"],
    ]);
  });

  test("TD is the default direction", () => {
    expect(flow("flowchart\nA --> B").direction).toBe("TD");
  });
});

describe("parse errors", () => {
  test("reject a bad direction", () => {
    expect(message("flowchart XY\nA --> B")).toContain("TD, TB, BT, LR or RL");
  });

  test("reject an unclosed bracket", () => {
    expect(message("flowchart TD\nA[open --> B")).toContain("never closes");
  });
});
