import { describe, expect, test } from "bun:test";
import { motion, render } from "svjeez";
import { browser } from "../helpers/frames-browser";

describe.if(browser)("prefix in one page", () => {
  const slide = (prefix?: string) =>
    render(
      { width: 100, height: 40, duration: 2, title: "A", prefix },
      <rect id="a" width={10} height={10} animation={motion({ x: 0 }).at(0).to({ x: 50 }, 2)} />,
    );

  const fade = (prefix?: string) =>
    render(
      { width: 100, height: 40, duration: 2, title: "B", prefix },
      <rect
        id="b"
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(0).to({ opacity: 1 }, 2)}
      />,
    );

  const halfway = async (html: string) => {
    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(html);

      return await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 1000;
        }

        const read = (id: string) => getComputedStyle(document.getElementById(id)!);

        return { translate: read("a").translate, opacity: Number(read("b").opacity) };
      });
    } finally {
      await chrome.close();
    }
  };

  test("prefixed scenes each animate their own motion", async () => {
    const { translate, opacity } = await halfway(
      `<!doctype html><body>${slide("a-")}${fade("b-")}`,
    );

    expect(parseFloat(translate)).toBeGreaterThan(25);
    expect(parseFloat(translate)).toBeLessThan(50);
    expect(opacity).toBeGreaterThan(0.5);
    expect(opacity).toBeLessThan(1);
  });

  test("unprefixed scenes clobber each other's keyframes", async () => {
    const { translate } = await halfway(`<!doctype html><body>${slide()}${fade()}`);
    expect(translate).toBe("none");
  });
});
