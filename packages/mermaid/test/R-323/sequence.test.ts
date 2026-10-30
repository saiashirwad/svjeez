import { describe, expect, test } from "bun:test";
import { parse } from "../../src/index";
import { message } from "../helpers/mermaid";

describe("parse sequence", () => {
  const doc = parse(`sequenceDiagram
    actor U as User
    participant A as "The API"
    U->>A: GET /
    A-->>U: 200
    A-xU: boom
    A-)U: async
    Note over A: thinking
    A->>A: self`);

  test("collects participants in order with aliases and roles", () => {
    if (doc.kind !== "sequence") throw new Error("not a sequence");

    expect(doc.participants).toEqual([
      { id: "U", label: "User", role: "actor" },
      { id: "A", label: "The API", role: "participant" },
    ]);
  });

  test("reads arrows into line and head", () => {
    if (doc.kind !== "sequence") throw new Error("not a sequence");

    expect(doc.items.map((i) => (i.kind === "note" ? "note" : `${i.line}/${i.head}`))).toEqual([
      "solid/filled",
      "dashed/filled",
      "solid/cross",
      "solid/async",
      "note",
      "solid/filled",
    ]);
  });

  test("an undeclared participant appears at its first mention", () => {
    const d = parse("sequenceDiagram\nB->A: hi\nA-->B: yo");

    expect(d.kind === "sequence" && d.participants.map((p) => p.id)).toEqual(["B", "A"]);
  });

  test("rejects activations and notes svjeez cannot draw", () => {
    expect(message("sequenceDiagram\nA->>+B: hi")).toContain("activation");
    expect(message("sequenceDiagram\nA->>B: hi\nactivate B")).toContain("line 3");
    expect(message("sequenceDiagram\nNote right of A: x")).toContain("Note over A");
    expect(message("sequenceDiagram\nNote over A,B: x")).toContain("single actor");
    expect(message("sequenceDiagram\nA->>B")).toContain("Cannot read this line");
  });
});
