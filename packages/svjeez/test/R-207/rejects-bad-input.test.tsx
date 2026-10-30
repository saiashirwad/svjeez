import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { openScene, renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("a non-positive scale or column count is rejected", async () => {
    expect(renderFrames(fade, { times: [0], scale: 0 })).rejects.toThrow("scale");
    expect(renderFrames(fade, { times: [0], sheet: { columns: 1.5 } })).rejects.toThrow("columns");
  });

  test("openScene() rejects a bad scale under the caller's name, before launching", async () => {
    expect(openScene(fade, { scale: -1 }, "renderVideo()")).rejects.toThrow(
      "renderVideo() needs a positive, finite scale, got -1.",
    );
  });
});

describe("renderFrames input", () => {
  const svg = render(
    { width: 4, height: 4, duration: 1, title: "Probe" },
    <rect width={4} height={4} />,
  );

  test("rejects a bad count or time before launching a browser", async () => {
    await expect(renderFrames(svg, { count: -1 })).rejects.toThrow(
      "renderFrames() needs a positive whole count, got -1.",
    );
    await expect(renderFrames(svg, { count: 1.5 })).rejects.toThrow("got 1.5.");
    await expect(renderFrames(svg, { times: [0, -2] })).rejects.toThrow(
      "renderFrames() needs finite, non-negative times, got -2.",
    );
  });
});
