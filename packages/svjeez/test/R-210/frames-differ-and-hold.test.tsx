import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade, same } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("frames at different times differ, and holds between transitions render the same", async () => {
    const { frames } = await renderFrames(fade, { times: [0, 1.5, 2.5, 3.5] });

    // SAFETY: renderFrames returns one frame for each of the four times passed above.
    const [before, middle, after, later] = frames.map((frame) => frame.png) as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint8Array,
    ];

    expect(same(before, middle)).toBe(false);
    expect(same(middle, after)).toBe(false);
    expect(same(after, later)).toBe(true);
  });
});
