import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { manual, scene, settle } from "../helpers/live-editor";

describe("an editor nothing listens to", () => {
  test("a destroyed editor starts nothing, even when something subscribes", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    editor.destroy();
    editor.subscribe(() => {});
    await settle();

    expect(compiles).toHaveLength(0);
  });
});
