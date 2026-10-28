import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { render, sampled } from "svjeez";
import { voxel } from "svjeez/voxel";
import { flowchart, stateMachine } from "svjeez/extras";

// Node 20 has no Map.groupBy; remove it so these run as they would there.
const native = Map.groupBy;

describe("without Map.groupBy, as on Node 20", () => {
  beforeAll(() => {
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

  test("sampled groups channels by lane", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "t" },
      <circle
        r={2}
        animation={sampled((t) => ({ x: t, y: t }), { duration: 1, tolerance: { translate: 0.1 } })}
      />,
    );

    expect(svg).toContain("@keyframes");
  });

  test("voxel scenes group blocks by cell", () => {
    const view = voxel.camera({ yaw: 45, pitch: 30, unit: 8 });
    const skin = voxel.texture({ g: "#5DA03A" }, "g");
    expect(
      voxel.scene({
        camera: view,
        blocks: [
          { at: [0, 0, 0], skin },
          { at: [0, 0, 0], skin },
        ],
      }),
    ).toBeDefined();
  });
});
