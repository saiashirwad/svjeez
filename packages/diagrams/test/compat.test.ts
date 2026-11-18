import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { font } from "svjeez";
import { flowchart, stateMachine } from "../src/index.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

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
      { font: mono },
    );

    expect(chart.size[1]).toBeGreaterThan(0);
  });

  test("a state machine lays out", () => {
    const machine = stateMachine(
      {
        states: { idle: "Idle", busy: "Busy" },
        initial: "idle",
        transitions: [
          ["idle", "busy"],
          ["busy", "idle"],
        ],
      },
      { font: mono },
    );

    expect(machine.size[0]).toBeGreaterThan(0);
  });
});
