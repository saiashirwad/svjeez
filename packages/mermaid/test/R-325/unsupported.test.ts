import { describe, expect, test } from "bun:test";
import { message } from "../helpers/mermaid";

describe("parse errors", () => {
  test("name the line number, the line and what is supported", () => {
    const m = message("flowchart TD\nA --> B\n\nclassDef red fill:#f00\n");

    expect(m).toContain("line 4");
    expect(m).toContain("classDef red fill:#f00");
    expect(m).toContain("not supported");
    expect(m).toContain("Supported:");
  });

  test("reject junk after a node", () => {
    expect(message("flowchart TD\nA:::red --> B")).toContain("expected an edge");
  });

  test("reject sequence blocks", () => {
    expect(message("sequenceDiagram\nloop every\nA->>B: x\nend")).toContain("not drawn");
  });

  test("reject state descriptions and choices", () => {
    expect(message("stateDiagram-v2\n[*] --> A\nA : some text")).toContain("not supported");
    expect(message("stateDiagram-v2\nstate c <<choice>>")).toContain("not supported");
  });
});
