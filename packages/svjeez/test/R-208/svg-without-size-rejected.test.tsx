import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";

describe.if(browser)("renderFrames", () => {
  test("an SVG without a numeric size is rejected", async () => {
    expect(
      renderFrames('<svg xmlns="http://www.w3.org/2000/svg"/>', { times: [0] }),
    ).rejects.toThrow("numeric width and height");
  });
});
