import { describe, expect, test } from "bun:test";
import { SceneError, svg } from "svjeez/tools";
import { font, scene, span } from "svjeez";
import { mermaid, parseMermaid, type FlowchartDoc, type StateDoc } from "../src/index";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const flow = (text: string): FlowchartDoc => {
  const doc = parseMermaid(text);

  if (doc.kind !== "flowchart") throw new Error(`expected a flowchart, got ${doc.kind}`);

  return doc;
};

const state = (text: string): StateDoc => {
  const doc = parseMermaid(text);

  if (doc.kind !== "state") throw new Error(`expected a state diagram, got ${doc.kind}`);

  return doc;
};

const message = (text: string): string => {
  try {
    parseMermaid(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseMermaid() did not throw");
};

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
    expect(doc.edges.map((e) => [e.from, e.to, e.label, e.line, e.head])).toEqual([
      ["A", "B", undefined, "solid", "arrow"],
      ["B", "C", undefined, "solid", "arrow"],
      ["C", "D", undefined, "dotted", "arrow"],
      ["D", "E", undefined, "thick", "arrow"],
      ["E", "F", undefined, "solid", "none"],
      ["F", "G", "text", "solid", "arrow"],
      ["G", "A", "piped", "solid", "arrow"],
      ["A", "B", "dotted label", "dotted", "arrow"],
      ["B", "C", "thick label", "thick", "arrow"],
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

describe("parse flowchart shapes", () => {
  test("reads hexagon, parallelograms, trapezoids, asymmetric and double circle", () => {
    const doc = flow(`flowchart TD
      A{{Hex}} --> B[/Lean right/]
      B --> C[\\Lean left\\]
      C --> D[/Wide base\\]
      D --> E[\\Wide top/]
      E --> F>Flag]
      F --> G(((Done)))`);

    expect(doc.nodes.map((n) => [n.label, n.form])).toEqual([
      ["Hex", "hexagon"],
      ["Lean right", "parallelogram"],
      ["Lean left", "parallelogramBack"],
      ["Wide base", "trapezoid"],
      ["Wide top", "trapezoidBack"],
      ["Flag", "asymmetric"],
      ["Done", "doubleCircle"],
    ]);
  });

  test("a label may hold a slash inside a slanted shape", () => {
    expect(flow("flowchart TD\nA[/read a/b/]").nodes[0]?.label).toBe("read a/b");
  });

  test("A@{ shape, label } names a shape and a label", () => {
    const doc = flow(`flowchart TD
      A@{ shape: hex, label: "Prepare, now" } --> B@{ shape: cyl }
      C@{ shape: lean-l, label: 'x' }`);

    expect(doc.nodes.map((n) => [n.id, n.label, n.form])).toEqual([
      ["A", "Prepare, now", "hexagon"],
      ["B", "B", "cylinder"],
      ["C", "x", "parallelogramBack"],
    ]);
    expect(message("flowchart TD\nA@{ shape: bolt }")).toContain("not supported");
    expect(message("flowchart TD\nA@{ shape: hex")).toContain("never closes");
  });

  test("a markdown string reads as its plain text", () => {
    const doc = flow('flowchart TD\nA["`**bold** and *soft*`"] -->|"`**yes**`"| B');

    expect(doc.nodes[0]?.label).toBe("bold and soft");
    expect(doc.edges[0]?.label).toBe("yes");
  });
});

describe("parse flowchart edges", () => {
  test("reads both ends, circle and cross ends, invisible and longer edges", () => {
    const doc = flow(`flowchart TD
      A <--> B
      B --o C
      C --x D
      D o--o E
      E x--x F
      F ~~~ G
      G ---> H
      H ====> I
      I <-. text .-> J
      J -- label --x K
      K e1@--> L`);

    expect(doc.edges.map((e) => [e.line, e.tail, e.head, e.label])).toEqual([
      ["solid", "arrow", "arrow", undefined],
      ["solid", "none", "circle", undefined],
      ["solid", "none", "cross", undefined],
      ["solid", "circle", "circle", undefined],
      ["solid", "cross", "cross", undefined],
      ["invisible", "none", "none", undefined],
      ["solid", "none", "arrow", undefined],
      ["thick", "none", "arrow", undefined],
      ["dotted", "arrow", "arrow", "text"],
      ["solid", "none", "cross", "label"],
      ["solid", "none", "arrow", undefined],
    ]);
  });

  test("an edge id and its animation line are ignored", () => {
    const doc = flow("flowchart TD\nA e1@--> B\ne1@{ animate: true }");

    expect(doc.nodes.map((n) => n.id)).toEqual(["A", "B"]);
  });

  test("-- with no arrow is not an edge", () => {
    expect(message("flowchart TD\nA -- B")).toContain("expected an edge");
  });
});

describe("parse flowchart styles", () => {
  test("classDef, class, ::: and style color nodes, with style winning", () => {
    const doc = flow(`flowchart TD
      A:::hot --> B
      C
      classDef hot fill:#f96,stroke:#333,stroke-width:4px,color:#fff,stroke-dasharray: 5 5
      classDef cool fill:#00f
      class B,C cool
      style C stroke:red,fill:#abc`);

    const styles = Object.fromEntries(doc.nodes.map((n) => [n.id, n.style]));

    expect(styles.A).toEqual({
      fill: "#f96",
      stroke: "#333",
      width: 4,
      color: "#fff",
      dash: [5, 5],
    });
    expect(styles.B).toEqual({ fill: "#00f" });
    expect(styles.C).toEqual({ fill: "#abc", stroke: "#ff0000" });
  });

  test("classDef default styles every node", () => {
    const doc = flow(
      "flowchart TD\nA --> B\nclassDef default fill:#eee\nclassDef x stroke:#000\nclass B x",
    );

    expect(doc.nodes.map((n) => n.style)).toEqual([
      { fill: "#eee" },
      { fill: "#eee", stroke: "#000" },
    ]);
  });

  test("linkStyle colors edges by index", () => {
    const doc = flow(`flowchart TD
      A --> B --> C
      linkStyle default stroke:#999
      linkStyle 1 stroke:#f00,stroke-width:3px`);

    expect(doc.edges.map((e) => e.style)).toEqual([
      { stroke: "#999" },
      { stroke: "#f00", width: 3 },
    ]);
    expect(message("flowchart TD\nA --> B\nlinkStyle 4 stroke:#f00")).toContain("out of range");
  });

  test("click and a subgraph direction are accepted and ignored", () => {
    const doc = flow(`flowchart TD
      subgraph g
        direction LR
        A --> B
      end
      click A href "https://example.com" _blank`);

    expect(doc.subgraphs).toEqual([{ id: "g", title: "g", nodes: ["A", "B"] }]);
    expect(message("flowchart TD\nsubgraph g\ndirection UP\nA\nend")).toContain("not one of");
  });

  test("an undefined class, an unknown node and a bad color are errors", () => {
    expect(message("flowchart TD\nA:::nope")).toContain("not defined");
    expect(message("flowchart TD\nA\nstyle Z fill:#fff")).toContain("not a node");
    expect(message("flowchart TD\nA\nstyle A fill:#12")).toContain("not a color");
  });
});

describe("directions", () => {
  test("BT and RL draw flowcharts, state, class and ER diagrams", () => {
    for (const text of [
      "flowchart BT\nA --> B",
      "flowchart RL\nA --> B",
      "stateDiagram-v2\ndirection BT\n[*] --> A",
      "classDiagram\ndirection RL\nA <|-- B",
      "erDiagram\ndirection BT\nA ||--o{ B : has",
    ])
      expect(mermaid(text, { font: mono }).size[0]).toBeGreaterThan(0);
  });
});

describe("parse errors", () => {
  test("name the line number, the line and what is supported", () => {
    const m = message("flowchart TD\nA --> B\n\ntitle Hello\n");

    expect(m).toContain("mermaid:4:");
    expect(m).toContain("title Hello");
    expect(m).toContain("not supported");
    expect(m).toContain("Supported:");
  });

  test("carry the line on the error", () => {
    expect(() => parseMermaid("flowchart TD\n%% x\nA --> \n")).toThrow(SceneError);
    expect(() => parseMermaid("flowchart TD\n%% x\nA --> \n")).toThrow(/mermaid:3:/);
  });

  test("reject another diagram type", () => {
    expect(message("sankey-beta\nA,B,10")).toContain("Supported diagram types");
    expect(message("quadrantChart\ntitle Q")).toContain("mermaid:1:");
  });

  test("reject empty text, a bad direction and an unclosed subgraph", () => {
    expect(() => parseMermaid("  \n%% only a comment")).toThrow(/no Mermaid text/);
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
    expect(message("flowchart TD\nA --> ")).toContain("mermaid:2:");
  });

  test("reject junk after a node", () => {
    expect(message("flowchart TD\nA[x] junk")).toContain("expected an edge");
  });
});

describe("parse sequence", () => {
  const doc = parseMermaid(`sequenceDiagram
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

  test("reads arrows into reply and head", () => {
    if (doc.kind !== "sequence") throw new Error("not a sequence");

    expect(
      doc.items.map((i) =>
        i.kind === "note" ? "note" : `${i.reply ? "reply" : "send"}/${i.head}`,
      ),
    ).toEqual(["send/filled", "reply/filled", "send/cross", "send/async", "note", "send/filled"]);
  });

  test("an undeclared participant appears at its first mention", () => {
    const d = parseMermaid("sequenceDiagram\nB->A: hi\nA-->B: yo");

    expect(d.kind === "sequence" && d.participants.map((p) => p.id)).toEqual(["B", "A"]);
  });

  test("rejects activations, blocks and notes svjeez cannot draw", () => {
    expect(message("sequenceDiagram\nA->>+B: hi")).toContain("activation");
    expect(message("sequenceDiagram\nA->>B: hi\nactivate B")).toContain("mermaid:3:");
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

test("file and line place an error in the surrounding source", () => {
  try {
    parseMermaid("flowchart TD\nA --> B\ntitle x", { file: "flow.ts", line: 10 });
  } catch (e) {
    if (!(e instanceof SceneError)) throw e;
    expect(e.message).toStartWith("flow.ts:12:");
    expect(e.source).toEqual({ file: "flow.ts", line: 12 });

    return;
  }

  throw new Error("parseMermaid() did not throw");
});

test("documents know where they start", () => {
  expect(parseMermaid("\n\nflowchart TD\nA", { file: "f.ts", line: 5 }).source).toEqual({
    file: "f.ts",
    line: 7,
  });
});

describe("mermaid", () => {
  test("a flowchart becomes a flowchart with its doc", () => {
    const chart = mermaid(
      "flowchart TD\nA([Start]) --> B{OK?}\nB -.->|no| C[(Cache)]\nsubgraph g [Group]\nB\nend",
      { font: mono },
    );

    if (chart.kind !== "flowchart") throw new Error("not a flowchart");
    expect(chart.doc.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
    expect(chart.part("g")).toBeDefined();
    expect(chart.size[1]).toBeGreaterThan(0);
  });

  test("options.direction overrides the text, and BT and RL are drawn", () => {
    const text = "flowchart RL\nA --> B";

    expect(mermaid(text, { font: mono, direction: "LR" }).kind).toBe("flowchart");

    expect(mermaid(text, { font: mono }).kind).toBe("flowchart");
  });

  test("a sequence diagram and a state diagram", () => {
    const seq = mermaid("sequenceDiagram\nactor U\nU->>API: GET\nAPI--xU: no\nNote over API: hm", {
      font: mono,
    });

    const machine = mermaid(
      "stateDiagram-v2\ndirection LR\n[*] --> Idle\nIdle --> Run : go\nRun --> [*]",
      {
        font: mono,
      },
    );

    expect(seq.kind).toBe("sequence");
    expect(seq.kind === "sequence" && seq.message(0).route).toBeDefined();
    expect(machine.kind).toBe("state");
    expect(machine.size[0]).toBeGreaterThan(machine.size[1]);
  });

  test("a sequence -x arrow draws a cross at its tip", () => {
    const drawn = (arrow: string) => {
      const chart = mermaid(`sequenceDiagram\nA${arrow}B: hi`, { font: mono });

      return svg.emit(scene({ size: [400, 300], duration: 1, title: "t" }, () => chart.node));
    };

    const crosses = (markup: string) =>
      markup.match(/<path d="M[\d. -]+L[\d. -]+M[\d. -]+L[\d. -]+" fill="none"/g) ?? [];

    expect(crosses(drawn("->>"))).toHaveLength(0);
    expect(crosses(drawn("-x"))).toHaveLength(1);
  });

  test("options a kind cannot honor are errors, not ignored", () => {
    const sequence = "sequenceDiagram\nA->>B: hi";
    const machine = "stateDiagram-v2\n[*] --> A";

    expect(() => mermaid(sequence, { font: mono, direction: "LR" })).toThrow(/no direction/);
    expect(() => mermaid(machine, { font: mono, reveal: span(0, 1) })).toThrow(/no reveal/);
  });

  test("a parse error carries file and line", () => {
    expect(() =>
      mermaid("flowchart TD\nA --> B\ntitle x", {
        font: mono,
        file: "flow.ts",
        line: 10,
      }),
    ).toThrow(/^flow\.ts:12:/);
  });
});

describe("every supported diagram type", () => {
  const sources = {
    class: "classDiagram\nAnimal <|-- Duck\nclass Duck {\n  +swim()\n}",
    er: "erDiagram\nCUSTOMER ||--o{ ORDER : places",
    gantt: "gantt\ndateFormat YYYY-MM-DD\nsection A\nPlan :a, 2026-01-01, 3d\nBuild :after a, 2d",
    journey: "journey\ntitle Day\nsection Work\nCode: 5: Me",
    pie: 'pie title Pets\n"Dogs" : 3\n"Cats" : 2',
    mindmap: "mindmap\n  root\n    A\n    B",
    git: "gitGraph\ncommit\nbranch dev\ncommit\ncheckout main\nmerge dev",
  } as const;

  for (const [kind, text] of Object.entries(sources))
    test(kind, () => {
      const d = mermaid(text, { font: mono });
      // SAFETY: the keys of `sources` are the diagram kinds.
      expect(d.kind).toBe(kind as typeof d.kind);
      expect(d.size[0]).toBeGreaterThan(0);
      const out = svg.emit(scene({ size: [800, 600], duration: 1, title: kind }, () => d.node));
      expect(out).toContain("<svg");
    });

  test("a direction on a pie is rejected", () => {
    expect(() => mermaid(sources.pie, { font: mono, direction: "LR" })).toThrow(
      /pie chart has no direction/,
    );
  });
});
