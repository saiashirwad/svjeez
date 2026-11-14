import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { flowchart, stateMachine } from "../src/index.ts";

// Node 20 has no Map.groupBy; remove it so these run as they would there.
const native = Map.groupBy;

describe("without Map.groupBy, as on Node 20", () => {
  beforeAll(() => {
    // SAFETY: TypeScript types Map.groupBy as required, but this test deletes it, so the cast lets delete compile.
    delete (Map as { groupBy?: unknown }).groupBy;
  });
  afterAll(() => {
    Map.groupBy = native;
  });

  test("flowchart lays out a graph with a back edge", () => {
    const chart = flowchart(
      {
        nodes: { a: "A", b: "B", c: "C" },
        edges: [
          ["a", "b"],
          ["b", "c"],
          ["c", "a"],
        ],
      },
      {},
    );

    expect(chart.bounds.h).toBeGreaterThan(0);
  });

  test("state lays out a machine", () => {
    const machine = stateMachine(
      {
        states: { idle: "Idle", busy: "Busy" },
        initial: "idle",
        transitions: [
          ["idle", "busy"],
          ["busy", "idle"],
        ],
      },
      {},
    );

    expect(machine.bounds.w).toBeGreaterThan(0);
  });
});
