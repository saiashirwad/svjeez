import { describe, expect, test } from "bun:test";
import { render, restyle } from "svjeez";
import { adaptive, systemDark, systemLight } from "svjeez/extras";
import { browser } from "../helpers/frames-browser";
import {
  asImage,
  paintAt,
  playsOnce,
  playsOnceEnded,
  restyleScene,
} from "../helpers/frames-restyle";
import { same } from "../helpers/frames";

describe("restyle", () => {
  describe.if(browser)("in the browser", () => {
    test("css after the scene's own recolors a scene painted with theme variables", async () => {
      const { theme, css } = adaptive({ dark: systemDark, light: systemLight });

      const svg = render(
        { width: 20, height: 20, duration: 1, title: "Themed", css },
        <rect width={20} height={20} fill={theme.base0D} />,
      );

      const red = await paintAt(
        render(
          { width: 20, height: 20, duration: 1, title: "Red" },
          <rect width={20} height={20} fill="#ff0000" />,
        ),
        0,
      );

      expect(same(await paintAt(restyle(svg, { css: "svg{--base0D:#ff0000}" }), 0), red)).toBe(
        true,
      );
      expect(same(await paintAt(svg, 0), red)).toBe(false);
    });

    test("still holds the reduced-motion frame, SMIL included", async () => {
      const svg = restyleScene({ at: 2.5 });
      expect(same(await paintAt(restyle(svg, { still: true }), 0), await paintAt(svg, 2.5))).toBe(
        true,
      );
    });

    test("still stops every animation, a scene's own CSS among them", async () => {
      const own = render(
        {
          width: 20,
          height: 20,
          duration: 1,
          title: "Own",
          css: "@keyframes spin{from{opacity:0}to{opacity:1}}rect{animation:spin 100s linear infinite}",
        },
        <rect width={20} height={20} />,
      );

      const opacityAfter = async (svg: string) => {
        const { chromium } = await import("playwright-core");
        const chrome = await chromium.launch();

        try {
          const page = await chrome.newPage();
          await page.setContent(`<!doctype html><body>${svg}`);
          await page.waitForTimeout(500);

          return await page.evaluate(() =>
            Number(getComputedStyle(document.querySelector("rect")!).opacity),
          );
        } finally {
          await chrome.close();
        }
      };

      expect(await opacityAfter(own)).toBeGreaterThan(0);
      expect(await opacityAfter(restyle(own, { still: true }))).toBe(0);
    });

    test("paused holds an <img> still while time passes, CSS and SMIL motions alike", async () => {
      const svg = restyleScene();
      const [first, later] = await asImage(restyle(svg, { at: 1.5, paused: true }), [50, 700]);

      expect(same(first!, later!)).toBe(true);
    });

    test("paused shows its moment to a viewer who prefers reduced motion, not the still frame", async () => {
      const paused = restyle(restyleScene({ at: 3.5 }), { at: 1.5, paused: true });
      const [reduced] = await asImage(paused, [50], "reduce");
      const [moving] = await asImage(paused, [50]);

      expect(same(reduced!, moving!)).toBe(true);
    });

    test("a scene that plays once stays held when paused, and on its last frame past its end", async () => {
      const once = playsOnce();
      const [first, later] = await asImage(restyle(once, { at: 1, paused: true }), [50, 500]);
      expect(same(first!, later!)).toBe(true);

      const [last] = await asImage(playsOnceEnded(), [50]);
      const [heldPast] = await asImage(restyle(once, { at: 6, paused: true }), [50]);
      expect(same(heldPast!, last!)).toBe(true);
    });
  });
});
