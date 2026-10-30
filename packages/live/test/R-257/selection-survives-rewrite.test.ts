import { describe, expect, test } from "bun:test";
import { play, scene } from "../helpers/live-editor";

describe("update", () => {
  test("a rewrite keeps the selected value when its key survives, and drops it when it does not", () => {
    const selected = play([{ type: "select", key: "default#1", now: 0 }]).state;
    const kept = play([{ type: "replace", text: `const pad = 2;\n${scene}` }], selected).state;
    const gone = play([{ type: "replace", text: "export default () => <g />;" }], selected).state;

    expect(kept.selected).toBe("default#1");
    expect(gone.selected).toBeNull();
  });
});
