import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";

describe.if(browser)("renderFrames", () => {
  test("a scene made only of loops lasts as long as their common period", async () => {
    const svg = render(
      { width: 20, height: 20, duration: 6, title: "Loops" },
      <>
        <rect
          width={10}
          height={10}
          animation={motion({ x: 0 }).to({ x: 10 }, 2, ease.linear).loop(2)}
        />
        <circle r={4} animation={motion({ y: 0 }).to({ y: 10 }, 3, ease.linear).loop(3)} />
      </>,
    );

    expect((await renderFrames(svg, { times: [0] })).duration).toBe(6);
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

    const { duration } = await renderFrames(svg, { count: 4 });
    expect(duration).toBe(12);
  });
});
