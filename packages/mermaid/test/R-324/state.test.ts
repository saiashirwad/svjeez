import { describe, expect, test } from "bun:test";
import { message, state } from "../helpers/mermaid";

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

  test("rejects a missing start, a labelled start and an unclosed composite", () => {
    expect(message("stateDiagram-v2\nA --> B")).toContain("no start");
    expect(message("stateDiagram-v2\n[*] --> A : go")).toContain("cannot carry a label");
    expect(message("stateDiagram-v2\n[*] --> A\nstate B {\nB1 --> B2\n}")).toContain("no start");
    expect(message("stateDiagram-v2\n[*] --> A\nstate B {\n[*] --> B1")).toContain("never closed");
  });
});
