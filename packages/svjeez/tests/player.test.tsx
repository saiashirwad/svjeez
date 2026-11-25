import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { Shape, rect, scene, tokens } from "svjeez";
import { svg } from "svjeez/tools";

const page_ = tokens({
  light: { ink: "#111111" },
  dark: { ink: "#eeeeee" },
});

const SCENE = svg.emit(
  scene({ size: [40, 40], duration: 2, title: "Card", theme: page_ }, () => (
    <Shape geometry={rect(40, 40)} fill={page_.ink} />
  )),
);

const POSTER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#336699"/></svg>')}`;

let browser: Browser;
let library = "";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-player-"));
  const entry = join(dir, "entry.ts");
  writeFileSync(
    entry,
    `import * as lib from ${JSON.stringify(join(import.meta.dir, "../src/page.ts"))};\n(globalThis as any).lib = lib;\n`,
  );
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife" });
  library = await built.outputs[0]!.text();
  browser = await chromium.launch();
});

afterAll(() => browser.close());

const open = async (
  html: string,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
): Promise<Page> => {
  const page = await browser.newPage({ colorScheme: "light", reducedMotion });
  await page.route("http://player.test/scene.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: SCENE }),
  );
  await page.route("http://player.test/", (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><body>${html}</body>` }),
  );
  await page.goto("http://player.test/");
  await page.addScriptTag({ content: library });

  return page;
};

const IMG = '<img id="a" data-live="/scene.svg" width="40" height="40" style="display:block">';

const run = (page: Page, code: string) =>
  page.evaluate<string | undefined>(`(async () => { ${code} })()`);

const IMAGE = 'document.getElementById("a")';

const text = (page: Page, src: string) =>
  page.evaluate((url) => fetch(url).then((response) => response.text()), src);

test("a player shows its poster when it comes near, plays the plain file, and goes back to the poster", async () => {
  const page = await open(IMG);

  await run(
    page,
    `globalThis.scene = lib.player(${IMAGE}, { poster: () => ${JSON.stringify(POSTER)}, near: 0 });`,
  );
  await page.waitForFunction(`${IMAGE}.dataset.state === "still"`);

  expect(await run(page, `return ${IMAGE}.src;`)).toBe(POSTER);

  await run(page, "await scene.play();");

  expect(await run(page, `return ${IMAGE}.src;`)).toBe("http://player.test/scene.svg");
  expect(await run(page, `return ${IMAGE}.dataset.state;`)).toBe("live");

  await run(page, "await scene.stop({ fade: false });");

  expect(await run(page, `return ${IMAGE}.src;`)).toBe(POSTER);
  await page.close();
});

test("a look in another scheme than the OS's pins the scene to it", async () => {
  const page = await open(IMG);

  await run(
    page,
    `globalThis.scene = lib.player(${IMAGE}, { look: () => ({ scheme: "dark" }) }); await scene.play();`,
  );
  const src = String(await run(page, `return ${IMAGE}.src;`));

  expect(src.startsWith("blob:")).toBe(true);
  expect(await text(page, src)).toContain("(max-width: -1px)");
  await page.close();
});

test("a look with a theme repaints the scene, and refresh follows a change of look", async () => {
  const page = await open(IMG);

  await run(
    page,
    `globalThis.recolor = false;
     const mine = (markup) => markup.includes("--ink") ? { ink: { kind: "token", name: "ink", light: "#123456", dark: "#123456" } } : undefined;
     globalThis.scene = lib.player(${IMAGE}, { look: () => ({ scheme: "light", theme: globalThis.recolor ? mine : undefined }) });
     await scene.play();`,
  );

  expect(await run(page, `return ${IMAGE}.src;`)).toBe("http://player.test/scene.svg");

  await run(page, "globalThis.recolor = true; await scene.refresh();");
  const src = String(await run(page, `return ${IMAGE}.src;`));

  expect(src.startsWith("blob:")).toBe(true);
  expect(await text(page, src)).toContain("#123456");
  await page.close();
});

test("an adopted img keeps playing its own file", async () => {
  const page = await open('<img id="a" src="/scene.svg" width="40" height="40">');

  expect(
    await run(
      page,
      `await lib.player(${IMAGE}, { adopt: true }).ready; return ${IMAGE}.getAttribute("src");`,
    ),
  ).toBe("/scene.svg");
  await page.close();
});

test("under reduced motion, playing shows the still", async () => {
  const page = await open(IMG, "reduce");

  await run(
    page,
    `globalThis.scene = lib.player(${IMAGE}, { poster: () => undefined }); await scene.play();`,
  );

  expect(await run(page, `return ${IMAGE}.dataset.state;`)).toBe("still");
  await page.close();
});
