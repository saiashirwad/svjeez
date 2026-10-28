import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { mermaid, MermaidSyntaxError, parse, type FlowchartDoc, type StateDoc } from "../src/index";

const flow = (text: string): FlowchartDoc => {
  const doc = parse(text);

  if (doc.kind !== "flowchart") throw new Error(`expected a flowchart, got ${doc.kind}`);

  return doc;
};

const state = (text: string): StateDoc => {
  const doc = parse(text);

  if (doc.kind !== "state") throw new Error(`expected a state diagram, got ${doc.kind}`);

  return doc;
};

/** The message of the error that `parse` throws for `text`. */
const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof MermaidSyntaxError) return e.message;

    throw e;
  }

  throw new Error("parse() did not throw");
};

const svg = (node: Parameters<typeof render>[1]) =>
  render({ width: 800, height: 600, duration: 12, title: "mermaid" }, node);

describe("parse flowchart", () => {
  test("reads every form, edge style and label form", () => {
    const doc = flow(`flowchart LR
      %% a comment
      A[Rect] --> B(Round)
      B ---> C([Stadium])
      C -.-> D{Decide}
      D ==> E((Circle))
      E --- F[[Sub]]
      F -- text --> G[(Store)]
      G -->|piped| A
      A -. dotted label .-> B
      B == thick label ==> C`);

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

  test("a later definition names a node declared bare, and quoted labels may hold brackets", () => {
    const doc = flow('flowchart TD\nA --> B\nB["list[0]"]\nA{Which?}');

    expect(doc.nodes.map((n) => [n.label, n.form])).toEqual([
      ["Which?", "diamond"],
      ["list[0]", "rect"],
    ]);
  });

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

  test("TD is the default direction", () => {
    expect(flow("flowchart\nA --> B").direction).toBe("TD");
  });
});

describe("parse errors", () => {
  test("name the line number, the line and what is supported", () => {
    const m = message("flowchart TD\nA --> B\n\nclassDef red fill:#f00\n");

    expect(m).toContain("line 4");
    expect(m).toContain("classDef red fill:#f00");
    expect(m).toContain("not supported");
    expect(m).toContain("Supported:");
  });

  test("carry the line on the error", () => {
    expect(() => parse("flowchart TD\n%% x\nA --> \n")).toThrow(MermaidSyntaxError);
    expect(() => parse("flowchart TD\n%% x\nA --> \n")).toThrow(/line 3/);
  });

  test("reject another diagram type", () => {
    expect(message('pie title Pets\n"Dogs": 3')).toContain("Supported diagram types");
    expect(message("erDiagram\nA ||--o{ B : has")).toContain("line 1");
  });

  test("reject empty text, a bad direction and an unclosed subgraph", () => {
    expect(() => parse("  \n%% only a comment")).toThrow(/no Mermaid text/);
    expect(message("flowchart XY\nA --> B")).toContain("TD, TB, BT, LR or RL");
    expect(message("flowchart TD\nsubgraph s\nA --> B")).toContain("never closed");
  });

  test("reject nested subgraphs, empty subgraphs and edges to a subgraph", () => {
    expect(message("flowchart TD\nsubgraph a\nsubgraph b\nX\nend\nend")).toContain("flat");
    expect(message("flowchart TD\nsubgraph a\nend\nB")).toContain("no nodes");
    expect(message("flowchart TD\nsubgraph s\nA\nend\nB --> s")).toContain("subgraph and a node");
  });

  test("reject an unclosed bracket and an edge with no target", () => {
    expect(message("flowchart TD\nA[open --> B")).toContain("never closes");
    expect(message("flowchart TD\nA --> ")).toContain("line 2");
  });

  test("reject junk after a node", () => {
    expect(message("flowchart TD\nA:::red --> B")).toContain("expected an edge");
  });
});

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

  test("rejects activations, blocks and notes svjeez cannot draw", () => {
    expect(message("sequenceDiagram\nA->>+B: hi")).toContain("activation");
    expect(message("sequenceDiagram\nA->>B: hi\nactivate B")).toContain("line 3");
    expect(message("sequenceDiagram\nloop every\nA->>B: x\nend")).toContain("not drawn");
    expect(message("sequenceDiagram\nNote right of A: x")).toContain("Note over A");
    expect(message("sequenceDiagram\nNote over A,B: x")).toContain("single actor");
    expect(message("sequenceDiagram\nA->>B")).toContain("Cannot read this line");
  });
});

describe("parse state", () => {
  test("reads start, end, labels and long names", () => {
    const doc = state(`stateDiagram-v2
      [*] --> Idle
      state "Waiting for input" as Wait
      Idle --> Wait : ask
      Wait --> Done
      Done --> [*]`);

    expect(doc.initial).toBe("Idle");
    expect(doc.states.map((s) => [s.id, s.label, s.final])).toEqual([
      ["Idle", "Idle", false],
      ["Wait", "Waiting for input", false],
      ["Done", "Done", true],
    ]);
    expect(doc.transitions).toEqual([
      { from: "Idle", to: "Wait", label: "ask" },
      { from: "Wait", to: "Done" },
    ]);
  });

  test("composite states carry their own start", () => {
    const doc = state(`stateDiagram
      [*] --> Off
      Off --> On
      state On {
        [*] --> Warm
        Warm --> Hot
      }
      On --> Off : cool`);

    const on = doc.states.find((s) => s.id === "On")!;

    expect(on.inner?.initial).toBe("Warm");
    expect(on.inner?.states.map((s) => s.id)).toEqual(["Warm", "Hot"]);
  });

  test("rejects a missing start, a labelled start, descriptions and choices", () => {
    expect(message("stateDiagram-v2\nA --> B")).toContain("no start");
    expect(message("stateDiagram-v2\n[*] --> A : go")).toContain("cannot carry a label");
    expect(message("stateDiagram-v2\n[*] --> A\nA : some text")).toContain("not supported");
    expect(message("stateDiagram-v2\nstate c <<choice>>")).toContain("not supported");
    expect(message("stateDiagram-v2\n[*] --> A\nstate B {\nB1 --> B2\n}")).toContain("no start");
    expect(message("stateDiagram-v2\n[*] --> A\nstate B {\n[*] --> B1")).toContain("never closed");
  });
});

describe("mermaid", () => {
  test("draws a flowchart: labels, groups and a path through the edges", () => {
    const d = mermaid(`flowchart TD
      A([Start]) --> B{OK?}
      B -->|yes| C[Ship]
      B -->|no| D[(Cache)]
      subgraph g [Release]
        C
      end`);

    if (d.kind !== "flowchart") throw new Error("not a flowchart");
    const out = svg(d.node);

    for (const text of ["Start", "OK?", "yes", "no", "Ship", "Cache", "Release"])
      expect(out).toContain(`>${text}<`);
    expect(d.route("A", "C").length).toBeGreaterThan(2);
    expect(d.get("C").y).toBeGreaterThan(d.get("A").y);
    expect(d.doc.nodes).toHaveLength(4);
  });

  test("LR lays out left to right, and options.direction overrides the text", () => {
    const text = "flowchart TD\nA --> B";
    const down = mermaid(text);
    const across = mermaid(text, { direction: "LR" });

    expect(down.get("B").y).toBeGreaterThan(down.get("A").y);
    expect(across.get("B").x).toBeGreaterThan(across.get("A").x);
    expect(mermaid("graph LR\nA --> B").get("B").x).toBeGreaterThan(0);
  });

  test("BT and RL throw with the fix, unless a direction overrides them", () => {
    expect(() => mermaid("flowchart BT\nA --> B")).toThrow(/cannot draw direction BT.*TD or LR/);
    expect(() => mermaid("flowchart RL\nA --> B", { direction: "LR" })).not.toThrow();
  });

  test("play staggers the nodes in", () => {
    const d = mermaid("flowchart TD\nA --> B --> C", { play: { at: 1, step: 0.5 } });

    expect(svg(d.node)).toContain("@keyframes");
    expect(svg(mermaid("flowchart TD\nA --> B --> C").node)).not.toContain("@keyframes");
  });

  test("draws a sequence diagram with replies and notes", () => {
    const d = mermaid(
      `sequenceDiagram
        participant B as Browser
        B->>API: GET /
        API-->>B: 200
        Note over API: cached`,
      { play: { at: 0, step: 1 } },
    );

    if (d.kind !== "sequence") throw new Error("not a sequence");
    const out = svg(d.node);

    for (const text of ["Browser", "API", "GET /", "200", "cached"])
      expect(out).toContain(`>${text}<`);
    expect(d.message(1).span.at).toBe(1);
    expect(d.get("B").x).toBeLessThan(d.get("API").x);
  });

  test("draws a state diagram that can walk", () => {
    const d = mermaid(`stateDiagram-v2
      [*] --> Idle
      Idle --> Run : go
      state Run {
        [*] --> Step
        Step --> Step2
      }
      Run --> Done : ok
      Done --> [*]`);

    if (d.kind !== "state") throw new Error("not a state diagram");
    const walk = d.walk(["Idle", "Run", "Step", "Step2", "Done"], { at: 0.5 });

    expect(walk.end).toBeGreaterThan(0.5);
    expect(svg([d.node, walk.node])).toContain(">go<");
    expect(d.get("Step").y).toBeGreaterThan(d.get("Run").y);
  });

  test("narrows on kind", () => {
    const d = mermaid("sequenceDiagram\nA->>B: hi");

    expect(d.kind).toBe("sequence");
    expect(d.doc.kind).toBe("sequence");
  });
});
