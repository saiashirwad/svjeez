import { describe, expect, test } from "bun:test";
import { openScene, renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade, same } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("an open scene captures what renderFrames renders, in a secure context, until closed", async () => {
    const scene = await openScene(fade, { scale: 2, colorScheme: "light" });

    try {
      expect(scene.duration).toBe(4);
      expect(
        await scene.evaluate((name) => name in window && isSecureContext, "VideoEncoder"),
      ).toBe(true);
      const { frames } = await renderFrames(fade, { times: [1.5], scale: 2, colorScheme: "light" });
      expect(same(await scene.capture(1.5), frames[0]!.png)).toBe(true);
    } finally {
      await scene.close();
    }
  });
});
