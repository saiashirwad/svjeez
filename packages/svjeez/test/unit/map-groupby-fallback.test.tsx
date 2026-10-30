import { describe, expect, test } from "bun:test";
import { flowchart, stateMachine } from "svjeez/extras";
import { voxel } from "svjeez/voxel";
import { withoutMapGroupBy } from "../helpers/no-map-groupby";

describe("without Map.groupBy, as on Node 20", () => {
  withoutMapGroupBy();

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
