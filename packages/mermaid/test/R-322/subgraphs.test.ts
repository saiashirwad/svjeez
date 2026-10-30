import { describe, expect, test } from "bun:test";
import { flow, message } from "../helpers/mermaid";

describe("parse flowchart", () => {
  test("subgraphs collect the nodes mentioned inside them, the first subgraph keeping a shared one", () => {
    const doc = flow(`flowchart TD
      start --> a
      subgraph one [Group One]
        a --> b
      end
      subgraph "Two words"
        c
        a
      end
      b --> c`);

    expect(doc.subgraphs).toEqual([
      { id: "one", title: "Group One", nodes: ["a", "b"] },
      { id: "Two words", title: "Two words", nodes: ["c"] },
    ]);
  });
});

describe("parse errors", () => {
  test("reject an unclosed subgraph", () => {
    expect(message("flowchart TD\nsubgraph s\nA --> B")).toContain("never closed");
  });

  test("reject nested subgraphs, empty subgraphs and edges to a subgraph", () => {
    expect(message("flowchart TD\nsubgraph a\nsubgraph b\nX\nend\nend")).toContain("flat");
    expect(message("flowchart TD\nsubgraph a\nend\nB")).toContain("no nodes");
    expect(message("flowchart TD\nsubgraph s\nA\nend\nB --> s")).toContain("subgraph and a node");
  });
});
