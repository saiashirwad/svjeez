import { describe, expect, test } from "bun:test";
import { cx, play } from "../helpers/live-editor";

describe("update", () => {
  test("a drag is one undo step, and redo puts it back", () => {
    const drag = play([
      { type: "set", key: "default#0", value: 41 },
      { type: "set", key: "default#0", value: 42, continues: true },
      { type: "set", key: "default#0", value: 43, continues: true },
    ]).state;

    const undone = play([{ type: "undo" }], drag).state;
    expect(cx(undone)).toBe(40);
    expect(cx(play([{ type: "redo" }], undone).state)).toBe(43);
  });
});
