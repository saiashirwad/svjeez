import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { manual, ok, scene, settle } from "../helpers/live-editor";

describe("createEditor", () => {
  test("each new picture frees the one before it, and destroy frees the last", async () => {
    const { compiles, released, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    editor.subscribe(() => {});
    compiles[0]!.finish(ok("<svg/>"));
    await settle();
    editor.send({ type: "set", key: "default#0", value: 50 });
    await settle();
    compiles[1]!.finish(ok("<svg id='2'/>"));
    await settle();

    expect(editor.getState().picture?.url).toBe("blob:2");
    expect(released).toEqual(["blob:1"]);
    editor.destroy();
    expect(released).toEqual(["blob:1", "blob:2"]);
  });
});
