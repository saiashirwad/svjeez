import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { manual, ok, scene, settle } from "../helpers/live-editor";

describe("an editor nothing listens to", () => {
  test("a compile cut short by a pause runs again on the next subscribe, and never shows as an error", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);

    const leave = editor.subscribe(() => {});
    leave();
    compiles[0]!.finish({ ok: false, error: { kind: "runtime", message: "stopped" }, ms: 0 });
    await settle();

    editor.subscribe(() => {});
    await settle();
    expect(editor.getState().error).toBeNull();
    expect(compiles.map((c) => c.text)).toEqual([scene, scene]);
  });
});

describe("createEditor when things go wrong", () => {
  test("a compile that throws shows as the file's error, and the next edit still compiles", async () => {
    const texts: string[] = [];

    const editor = createEditor(
      { text: scene },
      {
        compile: async (text) => {
          texts.push(text);

          if (texts.length === 1) throw new Error("network down");

          return ok("<svg/>");
        },
        show: async () => "blob:1",
        release: () => {},
        now: () => 0,
      },
    );

    editor.subscribe(() => {});
    await settle();
    expect(editor.getState().error?.message).toContain("network down");

    editor.send({ type: "set", key: "default#0", value: 50 });
    await settle();
    expect(texts).toHaveLength(2);
    expect(editor.getState().error).toBeNull();
    editor.destroy();
  });
});
