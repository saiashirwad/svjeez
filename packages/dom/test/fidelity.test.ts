import { describe, expect, test } from "bun:test";
import { openScene } from "svjeez/frames";
import { svg } from "svjeez/tools";
import { film, openPage } from "../src/index.ts";
import { serve } from "../src/bun.ts";
import index from "./app/index.html";

/** Mean absolute difference over the page's box (the scene may be larger, sized for its biggest state), RGB, 0 to 255, measured in Chromium. */
const difference = async (a: Uint8Array, b: Uint8Array): Promise<number> => {
  const { page, close } = await openPage({ url: "about:blank" });

  try {
    const urls = [a, b].map(
      (png) => `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
    );

    return await page.evaluate(
      async ([first, second]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((done, fail) => {
            const image = new Image();

            image.onload = () => done(image);
            image.onerror = () => fail(new Error("image did not load"));
            image.src = src;
          });

        const [x, y] = await Promise.all([load(first!), load(second!)]);
        const canvas = new OffscreenCanvas(x.width, x.height);
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(x, 0, 0);
        const before = context.getImageData(0, 0, x.width, x.height).data;
        context.clearRect(0, 0, x.width, x.height);
        context.drawImage(y, 0, 0);
        const after = context.getImageData(0, 0, x.width, x.height).data;
        let total = 0;

        for (let i = 0; i < before.length; i += 4)
          total +=
            Math.abs(before[i]! - after[i]!) +
            Math.abs(before[i + 1]! - after[i + 1]!) +
            Math.abs(before[i + 2]! - after[i + 2]!);

        return total / (before.length / 4) / 3;
      },
      // SAFETY: `urls` is mapped from the two-element list above.
      urls as [string, string],
    );
  } finally {
    await close();
  }
};

describe("film", () => {
  test("the SVG opens cleanly and matches the page at the end of each state", async () => {
    const shots: Uint8Array[] = [];
    const timings = [{}, { over: 0.5, hold: 0.6 }, { over: 0.5 }];

    const board = await film(
      serve(index),
      "#app",
      async ({ page, snap }) => {
        const shot = async () => shots.push(await page.locator("#app").screenshot());

        await snap("start", timings[0]);
        await shot();
        await page.click("#add");
        await snap("two", timings[1]);
        await shot();
        await page.click("#add");
        await snap("three", timings[2]);
        await shot();
      },
      { scheme: "both", viewport: { width: 400, height: 400 }, onDiagnostics: () => {} },
    );

    const markup = svg.emit(board);

    const errors: string[] = [];

    const checker = await openPage({
      url: "about:blank",
      onError: (message) => errors.push(message),
    });

    await checker.page.goto(`data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`);
    await checker.close();
    expect(errors).toEqual([]);

    const view = await openScene(markup, { colorScheme: "light" });
    let at = 0;

    try {
      for (const [index, timing] of timings.entries()) {
        at += (index === 0 ? 0 : (timing.over ?? 0.6)) + (timing.hold ?? 0.8);

        const gap = await difference(shots[index]!, await view.capture(at - 0.05));

        expect(gap).toBeLessThan(4);
      }
    } finally {
      await view.close();
    }
  }, 60_000);

  test("fails loudly when the page throws", async () => {
    await expect(
      film(serve(index), "#app", async ({ page }) => {
        await page.evaluate(() =>
          setTimeout(() => {
            throw new Error("boom");
          }),
        );
        await page.waitForTimeout(100);
      }),
    ).rejects.toThrow("boom");
  }, 30_000);
});
