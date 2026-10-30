import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade, pngSize } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("count spreads frames over one loop, at the requested scale", async () => {
    const { duration, frames } = await renderFrames(fade, { count: 4, scale: 2 });
    expect(duration).toBe(4);
    expect(frames.map((frame) => frame.time)).toEqual([0, 1, 2, 3]);
    expect(pngSize(frames[0]!.png)).toEqual({ width: 80, height: 40 });
  });

  test("periods that are rounded fractions of the scene duration still loop in the scene duration", async () => {
    const ring = (laps: number) => (
      <circle
        r={4}
        animation={motion({ rotate: 0 })
          .to({ rotate: 360 }, 12 / laps, ease.linear)
          .loop(12 / laps)}
      />
    );

    const svg = render(
      { width: 20, height: 20, duration: 12, title: "Rings" },
      <>
        <rect width={10} height={10} animation={motion({ x: 0 }).to({ x: 10 }, 12, ease.linear)} />
        {[2, 3, 5, 7, 8].map(ring)}
      </>,
    );

    const { frames } = await renderFrames(svg, { count: 4 });
    expect(frames.map((frame) => frame.time)).toEqual([0, 3, 6, 9]);
  });
});
