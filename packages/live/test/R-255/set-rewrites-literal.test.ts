import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { nudge } from "../../src/controls";
import { init, update, valueOf } from "../../src/editor";
import { play, scene } from "../helpers/live-editor";

describe("update", () => {
  test("setting a value rewrites only its literal and asks for a compile of the new file", () => {
    const { state, cmds } = play([{ type: "set", key: "default#0", value: 64.5 }]);

    expect(state.text).toBe(scene.replace("cx={40}", "cx={64.5}"));
    expect(cmds).toEqual([{ type: "compile", text: state.text }]);
  });

  test("a color, an ease and a number each go back as code", () => {
    const { state } = play([
      { type: "set", key: "default#2", value: "#FF0000" },
      { type: "set", key: "default#5", value: ease.bezier(0.1, 0.2, 0.3, 1.4) },
    ]);

    expect(state.text).toContain('fill="#FF0000"');
    expect(state.text).toContain("ease.bezier(0.1, 0.2, 0.3, 1.4)");
  });

  test("arrow keys keep a number's decimals, through a whole number and back", () => {
    let [state] = init({ text: `const k = 0.5;\nexport default () => k;\n`, now: 0 });

    const step = (by: 1 | -1) => {
      const v = valueOf(state, "k");

      if (v?.kind !== "number") throw new Error("k is a number");
      [state] = update(state, {
        type: "set",
        key: "k",
        value: nudge(v.param, v.literal.value, by),
      });
    };

    for (let i = 0; i < 5; i++) step(1);
    expect(state.text).toContain("const k = 1.0;");

    for (let i = 0; i < 2; i++) step(1);

    for (let i = 0; i < 3; i++) step(-1);
    expect(state.text).toContain("const k = 0.9;");
  });

  test("a number written with an exponent is set without decimals it never had", () => {
    const [state] = init({ text: `const a = 1.5e3;\nexport default () => a;\n`, now: 0 });
    const [next] = update(state, { type: "set", key: "a", value: 1600 });

    expect(next.text).toContain("const a = 1600;");
  });
});
