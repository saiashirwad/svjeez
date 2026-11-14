import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, defaultClientConditions, type ViteDevServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: `${import.meta.dirname}/app`,
    configFile: false,
    logLevel: "warn",
    plugins: [svelte()],
    resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
    server: { port: 0, fs: { allow: [`${import.meta.dirname}/../../..`] } },
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
const open = async (scene = "") => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  await page.goto(`${origin}?scene=${scene}`);
  await page.waitForSelector("img.sj-img", { timeout: 30_000 });

  return page;
};

const CX = '.sj-num[aria-label="cx"]';

const source = (page: Page) => page.locator(".sj-source").evaluate((el) => el.textContent ?? "");
const picture = (page: Page) => page.locator("img.sj-img").getAttribute("src");

/** Waits for the picture to be swapped for a newer one, which happens only after a compile and decode. */
const repainted = (page: Page, was: string | null) =>
  page.waitForFunction(
    (url) => document.querySelector("img.sj-img")?.getAttribute("src") !== url,
    was,
    { timeout: 15_000 },
  );

const dragBy = async (page: Page, selector: string, dx: number) => {
  const box = (await page.locator(selector).boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
};

describe("editing a scene with no annotations", () => {
  test("dragging a number rewrites the source and recompiles the picture", async () => {
    const page = await open();
    const before = await picture(page);
    expect(await source(page)).toContain("<circle cx={120}");

    await dragBy(page, CX, 60);
    const text = await source(page);
    expect(text).not.toContain("<circle cx={120}");
    expect(text).toMatch(/<circle cx=\{\d+(\.\d+)?\}/);

    await repainted(page, before);
    expect(await picture(page)).not.toBe(before);
    await page.close();
  });

  test("undo takes a whole drag back in one step", async () => {
    const page = await open();
    const original = await source(page);
    await dragBy(page, CX, 80);
    expect(await source(page)).not.toBe(original);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await source(page)).toBe(original);
    await page.close();
  });

  test("arrow keys step a number, and undo takes back one step at a time", async () => {
    const page = await open();
    await page.locator(CX).focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await source(page)).toContain("<circle cx={122}");

    await page.keyboard.press("Control+z");
    expect(await source(page)).toContain("<circle cx={121}");
    expect(await page.locator(CX).getAttribute("aria-valuenow")).toBe("121");
    await page.close();
  });

  test("picking a color writes the hex", async () => {
    const page = await open();
    const swatch = page.locator(".sj-color .sj-swatch").nth(1);
    await swatch.evaluate((el: HTMLInputElement) => {
      el.value = "#112233";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const text = await source(page);
    expect(text).toContain('<circle cx={120} cy={120} r={30} fill="#112233"');
    expect(text).not.toContain("#FF5D8F");
    await page.close();
  });

  test("bending an ease writes ease.bezier", async () => {
    const page = await open();
    await page.locator(".sj-ease", { hasText: "ease.out" }).locator(".sj-glyph").click();
    const handle = page.locator(".sj-pop .sj-handle").first();
    await handle.waitFor();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y - 30, { steps: 5 });
    await page.mouse.up();

    expect(await page.locator(".sj-pop-text").textContent()).toMatch(/^ease\.bezier\(/);
    expect(await source(page)).toMatch(/to\(\{ rotate: 90 \}, 1\.5, ease\.bezier\(/);

    await page.keyboard.press("Escape");
    await page.locator(".sj-pop").waitFor({ state: "detached" });
    await page.close();
  });

  test("a broken edit shows its error while the last good picture stays", async () => {
    const page = await open();
    const good = await picture(page);
    await page.getByRole("button", { name: "Break" }).click();
    await page.locator(".sj-error:not([hidden])").waitFor();

    expect(await page.locator(".sj-error").textContent()).toBeTruthy();
    expect(await picture(page)).toBe(good);
    await page.close();
  });
});

describe("a bare number", () => {
  test("selecting it puts a measured grip on the picture, and dragging the grip changes the number", async () => {
    const page = await open();
    expect(await page.locator(".sj-grip").count()).toBe(0);

    await page.locator(CX).focus();
    await page.waitForSelector(".sj-grip", { timeout: 15_000 });
    expect(await page.locator(".sj-grip").getAttribute("data-sj-key")).toBe(
      await page.locator(CX).getAttribute("data-sj-key"),
    );
    const before = await picture(page);

    await dragBy(page, ".sj-grip", 40);
    expect(Number(await page.locator(CX).getAttribute("aria-valuenow"))).toBeGreaterThan(120);
    expect(await source(page)).not.toContain("<circle cx={120}");
    await repainted(page, before);
    await page.close();
  });
});

describe("a scene that declares handles", () => {
  test("dragging a grip moves its value, the source and the picture", async () => {
    const page = await open("handles");
    await page.waitForSelector(".sj-grip");
    const before = await picture(page);
    expect(await source(page)).toContain("x: number(100,");

    await dragBy(page, ".sj-grip", 60);
    const grip = page.locator(".sj-grip");
    const now = Number(await grip.getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThan(100);

    await repainted(page, before);
    expect(await source(page)).toContain(`x: number(${now},`);
    await page.close();
  });
});
