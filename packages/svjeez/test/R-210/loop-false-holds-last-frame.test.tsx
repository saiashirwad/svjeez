import { describe, expect, test } from "bun:test";
import { def, ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { same } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("loop: false holds the last frame after the scene ends, inner loops and SMIL included", async () => {
    const flood = def.filter(
      {},
      <feFlood
        floodColor="#ff0000"
        animation={motion({ floodColor: "#ff0000" }).at(1).set({ floodColor: "#0000ff" })}
      />,
    );

    const scene = (loop: boolean) =>
      render(
        { width: 40, height: 20, duration: 2, title: "Once", loop },
        <>
          <rect width={20} height={20} filter={flood} />
          <rect
            y={5}
            width={10}
            height={10}
            fill="#3EE6D6"
            animation={motion({ x: 20 }).to({ x: 30 }, 0.5, ease.linear).loop(0.5)}
          />
        </>,
      );

    const once = (await renderFrames(scene(false), { times: [0.3, 2, 3.5, 5.1] })).frames.map(
      (frame) => frame.png,
    );

    expect(same(once[0]!, once[2]!)).toBe(false);
    expect(same(once[1]!, once[2]!)).toBe(true);
    expect(same(once[2]!, once[3]!)).toBe(true);

    const looping = (await renderFrames(scene(true), { times: [0.3, 2.3] })).frames.map(
      (frame) => frame.png,
    );

    expect(same(looping[0]!, looping[1]!)).toBe(true);
  });
});
