import { describe, expect, test } from "bun:test";
import { restyle } from "svjeez";
import { browser } from "../helpers/frames-browser";
import {
  asImage,
  onceDrawn,
  onceScene,
  playsOnce,
  playsOnceEnded,
} from "../helpers/frames-restyle";
import { same } from "../helpers/frames";

describe("restyle", () => {
  describe.if(browser)("in the browser", () => {
    test("onceAt gives <Once> parts a clock of their own", async () => {
      const svg = onceScene();

      const [own, reference] = await Promise.all([
        asImage(restyle(svg, { at: 2.5, onceAt: 0.5, paused: true }), [50]),
        asImage(onceDrawn(0.25, 0.5, 1), [50]),
      ]);

      expect(same(own[0]!, reference[0]!)).toBe(true);
    });

    test("a scene that plays once stays valid, and on its last frame when started past its end", async () => {
      const once = playsOnce();
      const paused = restyle(once, { at: 1, paused: true });
      expect(paused.match(/fill="freeze"/g)).toHaveLength(1);

      const [last] = await asImage(playsOnceEnded(), [50]);
      const [past] = await asImage(restyle(once, { at: 6 }), [50]);
      expect(same(past!, last!)).toBe(true);
    });
  });
});
