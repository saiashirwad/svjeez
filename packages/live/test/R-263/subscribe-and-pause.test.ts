import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { manual, ok, scene, settle } from "../helpers/live-editor";

describe("createEditor", () => {
  test("nothing compiles until something subscribes", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    await settle();
    expect(compiles).toHaveLength(0);

    editor.subscribe(() => {});
    await settle();
    expect(compiles.map((c) => c.text)).toEqual([scene]);
  });
});

describe("an editor nothing listens to", () => {
  test("pauses when its last listener leaves, and the next subscribe compiles what changed meanwhile", async () => {
    const { compiles, effects } = manual();
    let stops = 0;
    const compile = Object.assign(effects.compile, { stop: () => void stops++ });
    const editor = createEditor({ text: scene }, { ...effects, compile });

    const leave = editor.subscribe(() => {});
    compiles[0]!.finish(ok("<svg/>"));
    await settle();
    leave();
    expect(stops).toBe(1);

    editor.send({ type: "set", key: "default#0", value: 50 });
    await settle();
    expect(compiles).toHaveLength(1);

    editor.subscribe(() => {});
    await settle();
    expect(compiles.map((c) => c.text)).toEqual([scene, editor.getState().text]);
    compiles[1]!.finish(ok("<svg id='2'/>"));
    await settle();
    expect(editor.getState().picture?.svg).toBe("<svg id='2'/>");
  });
});

describe("createEditor when things go wrong", () => {
  test("pausing while a new picture is still being drawn keeps the new picture", async () => {
    let n = 0;
    let draw: (() => void) | undefined;

    const editor = createEditor(
      { text: "export default () => 1;" },
      {
        compile: async (text) => ok(`<svg>${text}</svg>`),
        show: (svg) =>
          new Promise((resolve) => {
            const url = `blob:${++n}:${svg}`;

            if (n === 2) draw = () => resolve(url);
            else resolve(url);
          }),
        release: () => {},
        now: () => 0,
      },
    );

    editor.subscribe(() => {});
    await settle();
    editor.send({ type: "replace", text: "export default () => 2;" });
    await settle();
    editor.send({ type: "pause" });
    await settle();
    draw?.();
    await settle();
    await settle();

    expect(editor.getState().picture?.text).toBe("export default () => 2;");
    expect(editor.getState().picture?.svg).toContain("() => 2");
    editor.destroy();
  });
});
