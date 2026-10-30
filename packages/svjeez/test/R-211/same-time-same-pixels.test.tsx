import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade, same } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("the same time renders the same pixels every run", async () => {
    const [first, second] = await Promise.all([
      renderFrames(fade, { times: [1.5] }),
      renderFrames(fade, { times: [1.5] }),
    ]);

    expect(same(first.frames[0]!.png, second.frames[0]!.png)).toBe(true);
  });
});
