import { describe, expect, test } from "bun:test";
import { def, render, restyle } from "svjeez";
import { browser } from "../helpers/frames-browser";
import { asImage, paintAt, restyleScene } from "../helpers/frames-restyle";
import { same } from "../helpers/frames";

describe("restyle", () => {
  describe.if(browser)("in the browser", () => {
    test("a copy started at 1.5 s begins where the original is at 1.5 s, CSS and SMIL motions alike", async () => {
      const svg = restyleScene();
      expect(svg).toContain("<animate");
      expect(same(await paintAt(restyle(svg, { at: 1.5 }), 0), await paintAt(svg, 1.5))).toBe(true);
      expect(same(await paintAt(restyle(svg, { at: 1.5 }), 0), await paintAt(svg, 0))).toBe(false);
    });

    test("paused shows an <img> at the moment asked for, CSS and SMIL motions alike", async () => {
      const svg = restyleScene();
      const [first] = await asImage(restyle(svg, { at: 1.5, paused: true }), [50]);
      const [start] = await asImage(restyle(svg, { paused: true }), [50]);

      const drawn = render(
        { width: 40, height: 20, duration: 4, title: "1.5 s in" },
        <>
          <rect width={40} height={20} fill="#3EE6D6" opacity={0.375} />
          <rect
            x={10}
            width={10}
            height={10}
            fill="#E64"
            filter={def.filter({}, <feGaussianBlur stdDeviation={3} />)}
          />
        </>,
      );

      const [frame] = await asImage(drawn, [50]);

      expect(same(first!, frame!)).toBe(true);
      expect(same(first!, start!)).toBe(false);
    });
  });
});
