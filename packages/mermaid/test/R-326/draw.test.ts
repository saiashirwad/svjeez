import { describe, expect, test } from "bun:test";
import { mermaid } from "../../src/index";
import { svg } from "../helpers/mermaid";

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
