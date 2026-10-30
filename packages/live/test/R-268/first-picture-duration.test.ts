import { describe, expect, test } from "bun:test";
import { createEditor } from "../../src/editor";
import { scene } from "../helpers/live-editor";

describe("an editor nothing listens to", () => {
  test("a build-time picture with a duration gives the transport its length before any compile", () => {
    const editor = createEditor({
      text: scene,
      first: { src: "/a.svg", width: 200, height: 120, title: "t", duration: 4 },
    });

    expect(editor.getState().picture).toEqual({
      url: "/a.svg",
      scene: { width: 200, height: 120, title: "t", duration: 4 },
    });
  });
});
