import { describe, expect, test } from "bun:test";
import { def, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { same } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("SMIL animations on filter primitives are seeked too", async () => {
    const flood = def.filter(
      {},
      <feFlood
        floodColor="#ff0000"
        animation={motion({ floodColor: "#ff0000" }).at(1).set({ floodColor: "#0000ff" })}
      />,
    );

    const svg = render(
      { width: 20, height: 20, duration: 2, title: "Flood" },
      <rect width={20} height={20} filter={flood} />,
    );

    expect(svg).toContain("<animate");
    const { frames } = await renderFrames(svg, { times: [0.5, 1.5, 1.8] });
    expect(same(frames[0]!.png, frames[1]!.png)).toBe(false);
    expect(same(frames[1]!.png, frames[2]!.png)).toBe(true);
  });
});
