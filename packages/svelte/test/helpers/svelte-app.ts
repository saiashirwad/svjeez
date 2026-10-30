import { afterAll, beforeAll } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, defaultClientConditions, type ViteDevServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export const CX = '.sj-num[aria-label="cx"]';

/** Serves test/app and launches Chromium for the calling test file, and returns the opener for its pages. */
export const useApp = () => {
  let server: ViteDevServer;
  let browser: Browser;
  let origin: string;

  beforeAll(async () => {
    server = await createServer({
      root: `${import.meta.dirname}/../app`,
      configFile: false,
      logLevel: "warn",
      plugins: [svelte()],
      resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
      server: { port: 0, fs: { allow: [`${import.meta.dirname}/../../../..`] } },
    });

    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
    browser = await chromium.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  /** The app on a scene, once its first compile has put a picture on screen. */
  return async (scene = "") => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
    await page.goto(`${origin}?scene=${scene}`);
    await page.waitForSelector("img.sj-img", { timeout: 30_000 });

    return page;
  };
};

export const source = (page: Page) =>
  page.locator(".sj-source").evaluate((el) => el.textContent ?? "");

export const picture = (page: Page) => page.locator("img.sj-img").getAttribute("src");

/** Waits for the picture to be swapped for a newer one, which happens only after a compile and decode. */
export const repainted = (page: Page, was: string | null) =>
  page.waitForFunction(
    (url) => document.querySelector("img.sj-img")?.getAttribute("src") !== url,
    was,
    { timeout: 15_000 },
  );

export const dragBy = async (page: Page, selector: string, dx: number) => {
  const box = (await page.locator(selector).boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
};
