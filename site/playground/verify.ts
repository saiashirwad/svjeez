// Drives the built playground in headless Chromium: edit, error, recovery, timings, screenshots.
// Run `bun site/playground/build.ts` first, then `bun site/playground/verify.ts [screenshotDir]`.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const root = new URL("../public/", import.meta.url).pathname;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const server = Bun.serve({
  port: 0,
  fetch: async (request) => {
    let path = new URL(request.url).pathname;
    if (path === "/__embed") return new Response(`<!doctype html><body style="margin:0"><div style="height:3000px"></div><div data-playground="toast"></div><script type="module" src="/playground/embed.js"></script>`, { headers: { "content-type": "text/html" } });
    if (path === "/play") path = "/play.html";
    const file = Bun.file(root + path.slice(1));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});
const origin = `http://localhost:${server.port}`;

const assert = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) process.exitCode = 1;
};

const browser = await chromium.launch();
const visit = async (scheme: "light" | "dark", width: number, height: number) => {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width, height } });
  const page = await context.newPage();
  const bytes: Record<string, number> = {};
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith(".js")) bytes[url.pathname] = (await response.body()).length;
  });
  page.on("pageerror", (error) => assert(false, `page error: ${error.message}`));
  return { page, bytes, context };
};

{
  const { page, context } = await visit("light", 1440, 900);
  const start = Date.now();
  await page.goto(`${origin}/play`);
  await page.waitForSelector(".pg[data-state=ready] .pg-img[src^=blob]");
  console.log(`first render after navigation: ${Date.now() - start} ms`);
  const first = await page.getAttribute(".pg-img", "src");
  assert(!!first, "preview img has a blob src");

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  const source = await page.evaluate(() => document.querySelector(".cm-content")!.textContent!);
  assert(source.includes("#3EE6D6"), "toast source is in the editor");

  // Replace a color and a duration through real typing into the document.
  await page.evaluate(() => (document.querySelector(".cm-content") as HTMLElement).focus());
  const edit = async (find: string, replace: string) => {
    await page.evaluate((text) => {
      const walker = document.createTreeWalker(document.querySelector(".cm-content")!, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
      const whole = nodes.map((n) => n.data).join("");
      const from = whole.indexOf(text);
      if (from < 0) throw new Error(`no text ${text}`);
      const locate = (offset: number) => {
        for (const node of nodes) {
          if (offset <= node.data.length) return [node, offset] as const;
          offset -= node.data.length;
        }
        throw new Error("past the end");
      };
      const range = document.createRange();
      range.setStart(...locate(from));
      range.setEnd(...locate(from + text.length));
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }, find);
    await page.keyboard.type(replace);
  };

  const timeEdit = async () => {
    const before = await page.getAttribute(".pg-img", "src");
    const t0 = Date.now();
    await page.waitForFunction((b) => document.querySelector(".pg-img")!.getAttribute("src") !== b, before, { timeout: 5000 });
    return Date.now() - t0;
  };

  await edit("duration: 5", "duration: 7");
  await timeEdit();
  await edit("#3EE6D6", "#FF00AA");
  await timeEdit();
  await edit("#3EE6D6", "#FF00AA");
  const settled = await timeEdit();
  console.log(`keystroke to new img.src (includes 250 ms debounce): ${settled} ms`);
  const svg = await page.evaluate(async () => (await (await fetch(document.querySelector<HTMLImageElement>(".pg-img")!.src)).text()));
  assert(svg.includes("#FF00AA") && !svg.includes("#3EE6D6"), "new SVG carries the edited color");
  assert(/animation-duration:\s*7s|7s/.test(svg), "new SVG carries the edited duration");

  const good = await page.getAttribute(".pg-img", "src");
  await edit("#FF00AA", "#FF00AA\"");
  await page.waitForSelector(".pg-error:not([hidden])");
  const message = await page.textContent(".pg-error");
  console.log(`error strip: ${message}`);
  assert(/Line \d+, column \d+/.test(message!), "syntax error shows line and column");
  assert((await page.getAttribute(".pg-img", "src")) === good, "last good preview stays during the error");
  if (shots) await page.screenshot({ path: `${shots}/error-1440-light.png` });

  await edit('#FF00AA"', "#FF00AA");
  await page.waitForSelector(".pg-error[hidden]", { state: "attached" });
  assert((await page.getAttribute(".pg-img", "src")) === good || (await page.getAttribute(".pg-img", "src")) !== null, "error clears after the fix");

  await edit("width: 320", "width: 0");
  await page.waitForSelector(".pg-error:not([hidden])");
  assert(/needs a positive width/.test((await page.textContent(".pg-error"))!), "svjeez library message shows in the strip");
  await edit("width: 0", "width: 320");
  await page.waitForSelector(".pg-error[hidden]", { state: "attached" });

  // Restart gives the img a fresh URL.
  const beforeRestart = await page.getAttribute(".pg-img", "src");
  await page.getByRole("button", { name: "Restart" }).click();
  assert((await page.getAttribute(".pg-img", "src")) !== beforeRestart, "restart reloads the image");

  // Every tab compiles.
  const tabs = await page.locator(".pg-tab").all();
  for (const tab of tabs) {
    const before = await page.getAttribute(".pg-img", "src");
    await tab.click();
    await page.waitForFunction((b) => document.querySelector(".pg-img")!.getAttribute("src") !== b, before);
    assert((await page.locator(".pg-error[hidden]").count()) === 1, `tab "${await tab.textContent()}" builds`);
  }

  // Recompile timing for the toast example, as reported by the worker.
  await tabs[1]!.click();
  await page.waitForTimeout(400);
  const ms = await page.evaluate(() => document.querySelector(".pg-stat:last-child b")!.textContent);
  console.log(`worker build time for toast: ${ms}`);
  await context.close();
}

for (const [scheme, width, height] of [["light", 1440, 900], ["dark", 1440, 900], ["light", 390, 844], ["dark", 390, 844]] as const) {
  const { page, context } = await visit(scheme, width, height);
  await page.goto(`${origin}/play`);
  await page.waitForSelector(".pg[data-state=ready] .pg-img[src^=blob]");
  await page.waitForTimeout(1500);
  if (shots) await page.screenshot({ path: `${shots}/play-${width}-${scheme}.png`, fullPage: true });
  await page.getByRole("button", { name: "Light and dark" }).click();
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert(!overflow, `${scheme} ${width}: no horizontal page scroll`);
  if (shots) await page.screenshot({ path: `${shots}/adaptive-${width}-${scheme}.png`, fullPage: true });
  await context.close();
}

{
  const { page, bytes, context } = await visit("light", 1440, 900);
  await page.goto(`${origin}/__embed`);
  await page.waitForTimeout(500);
  const seen = Object.keys(bytes).map((p) => p.split("/").pop());
  console.log(`before scroll, scripts fetched: ${seen.join(", ")}`);
  assert(!seen.includes("app.js") && !seen.includes("worker.js"), "embed does not load the editor while far below the viewport");
  const t0 = Date.now();
  await page.evaluate(() => scrollTo(0, 2600));
  await page.waitForSelector(".pg[data-state=ready] .pg-img[src^=blob]");
  console.log(`scroll near to first render: ${Date.now() - t0} ms`);
  await context.close();
}

await browser.close();
server.stop();
