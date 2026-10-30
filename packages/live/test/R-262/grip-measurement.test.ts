import { describe, expect, test } from "bun:test";
import type { Msg } from "../../src/editor";
import { compiled, play, scene } from "../helpers/live-editor";

describe("grips", () => {
  test("selecting a number asks to measure what it moves, with the file nudged a little past it", () => {
    const { state } = compiled(scene);
    const { cmds } = play([{ type: "select", key: "default#0", now: 0 }], state);

    expect(cmds).toEqual([
      expect.objectContaining({ type: "probe", key: "default#0", svg: "<svg id='a'/>", from: 40 }),
    ]);
    const [probe] = cmds;

    if (probe?.type !== "probe") throw new Error("a probe was asked for");
    expect(probe.nudged).toContain(`cx={${40 + probe.by}}`);
  });

  test("a measured grip sits where it was measured and moves with its value", () => {
    const selected = play(
      [{ type: "select", key: "default#0", now: 0 }],
      compiled(scene).state,
    ).state;

    const grip = { at: { x: 40, y: 60 }, way: { x: 1, y: 0 }, from: 40, declared: false };
    const { state } = play([{ type: "probed", key: "default#0", text: scene, grip }], selected);

    expect(state.grips["default#0"]).toEqual(grip);
    expect(play([{ type: "select", key: "default#0", now: 0 }], state).state.grips).toEqual(
      state.grips,
    );
    expect(play([{ type: "select", key: "default#1", now: 0 }], state).state.grips).toEqual({});
  });

  test("a measurement of an older file is kept only when the measured number is all that changed since", () => {
    const selected = play(
      [{ type: "select", key: "default#0", now: 0 }],
      compiled(scene).state,
    ).state;

    const grip = { at: { x: 40, y: 60 }, way: { x: 1, y: 0 }, from: 40, declared: false };
    const probed: Msg = { type: "probed", key: "default#0", text: scene, grip };

    const dragged = play([{ type: "set", key: "default#0", value: 55 }, probed], selected).state;
    expect(dragged.grips["default#0"]).toEqual(grip);

    const elsewhere = play([{ type: "set", key: "default#1", value: 12 }, probed], selected).state;
    expect(elsewhere.grips["default#0"]).toBeUndefined();
  });
});
