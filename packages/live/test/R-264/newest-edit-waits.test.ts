import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { manual, ok, scene, settle } from "../helpers/live-editor";

describe("createEditor", () => {
  test("while a compile runs, only the newest edit waits to compile next", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    editor.subscribe(() => {});

    for (const v of [41, 42, 43, 44])
      editor.send({ type: "set", key: "default#0", value: v, continues: true });
    compiles[0]!.finish(ok("<svg/>"));
    await settle();

    expect(compiles.map((c) => /cx=\{(\d+)\}/.exec(c.text)![1])).toEqual(["40", "44"]);
  });
});
