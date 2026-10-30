import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";
import { loopLength, seek } from "svjeez/page";
import { browser } from "../helpers/frames-browser";

declare global {
  interface Window {
    seek?: typeof seek;
    loopLength?: typeof loopLength;
  }
}

describe.if(browser)("seek and loopLength on an inline <svg>", () => {
  const scene = (prefix: string, duration: number) =>
    render(
      { width: 20, height: 20, duration, title: prefix, prefix },
      <rect
        width={20}
        height={20}
        animation={motion({ opacity: 0 }).to({ opacity: 1 }, duration, ease.linear)}
      />,
    );

  test("scrub one picture and leave the rest of the page playing", async () => {
    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(`<!doctype html><body>${scene("one", 4)}${scene("two", 3)}`);
      await page.addScriptTag({
        content: `window.seek = ${seek};window.loopLength = ${loopLength};`,
      });

      const state = await page.evaluate(() => {
        const [one, two] = document.querySelectorAll("svg");

        window.seek!(1, one!);

        const opacity = (svg: Element) =>
          Number(getComputedStyle(svg.querySelector("rect")!).opacity);

        return {
          one: opacity(one!),
          two: two!.getAnimations({ subtree: true }).map((animation) => animation.playState),
          lengths: [window.loopLength!(one!), window.loopLength!(two!), window.loopLength!()],
        };
      });

      expect(state.one).toBeCloseTo(0.25, 2);
      expect(state.two).toEqual(["running"]);
      expect(state.lengths).toEqual([4, 3, 12]);
    } finally {
      await chrome.close();
    }
  });
});
