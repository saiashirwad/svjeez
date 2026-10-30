import { describe, expect, test } from "bun:test";
import { compiled, play } from "../helpers/live-editor";

describe("grips", () => {
  test("a scene's declared handles are grips, keyed by their params, and are never probed", () => {
    const pendulum = `export const params = { swing: number(30, { min: 10, max: 50 }) };\nexport default () => null;\n`;

    const { state } = compiled(pendulum, {
      handles: { swing: { at: { x: 1, y: 2 }, way: { x: 3, y: 4 } } },
    });

    expect(state.grips).toEqual({
      "params.swing": { at: { x: 1, y: 2 }, way: { x: 3, y: 4 }, from: 30, declared: true },
    });
    expect(play([{ type: "select", key: "params.swing", now: 0 }], state).cmds).toEqual([]);
  });
});
