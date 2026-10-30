import { describe, expect, test } from "bun:test";
import { restyle } from "svjeez";
import { browser } from "../helpers/frames-browser";
import { asImage, onceDrawn, onceScene } from "../helpers/frames-restyle";
import { same } from "../helpers/frames";

describe("restyle", () => {
  describe.if(browser)("in the browser", () => {
    test("<Once> parts hold their end on the loop clock", async () => {
      const svg = onceScene();

      const [late, reference] = await Promise.all([
        asImage(restyle(svg, { at: 2.5, paused: true }), [50]),
        asImage(onceDrawn(0.25, 1, 4), [50]),
      ]);

      expect(same(late[0]!, reference[0]!)).toBe(true);
    });
  });
});
