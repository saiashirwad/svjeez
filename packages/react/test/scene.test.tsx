/** @jsxImportSource svjeez */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { Sequence, Shape, clock, ease, rect, scene, span, track, type Paint } from "svjeez";
import { svg } from "svjeez/tools";

const open = clock("open", span(0, 0.4));

const art = (extra = {}) => ({
  svg: svg.emit(
    scene(
      {
        size: [60, 40],
        duration: 1,
        title: "Switch",
        desc: "A square that turns blue.",
        states: { off: { open: 0 }, on: { open: 1 } },
        ...extra,
      },
      () => (
        <Sequence clock={open}>
          <Shape
            key="knob"
            geometry={rect(20, 20)}
            fill={track<Paint>("#ff0000").to("#0000ff", span(0, 0.4), ease.inOut)}
          />
        </Sequence>
      ),
    ),
  ),
  width: 60,
  height: 40,
  title: "Switch",
  desc: "A square that turns blue.",
});

let browser: Browser;
let library = "";

beforeAll(async () => {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "client.ts")],
    target: "browser",
    format: "iife",
    conditions: ["@svjeez/source"],
    define: { "process.env.NODE_ENV": '"development"' },
  });

  library = await built.outputs[0]!.text();
  browser = await chromium.launch();
});

afterAll(() => browser.close());

const open_ = async (markup = ""): Promise<Page> => {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });

  await page.setContent(
    `<!doctype html><body style="margin:0"><div id="root">${markup}</div></body>`,
  );
  await page.addScriptTag({ content: library });
  await page.evaluate(`globalThis.art = ${JSON.stringify(art())}; globalThis.log = [];`);

  return page;
};

const run = <T,>(page: Page, code: string) => page.evaluate<T>(`(async () => { ${code} })()`);

// Render `<Scene scene={art} {...props} />`, strict or not, and keep the root and the mounted scene for the test.
const RENDER = (props: string, strict = false) => `
  const { Scene, StrictMode, createElement: h, createRoot, flushSync } = lib;
  globalThis.show = (props) => {
    const element = h(Scene, { scene: art, onMount: (scene) => { globalThis.mounted = scene; log.push('mount'); return () => log.push('cleanup'); }, ...props });
    flushSync(() => root.render(${strict} ? h(StrictMode, null, element) : element));
  };
  globalThis.root = createRoot(document.getElementById('root'));
  show(${props});`;

const time = (page: Page) => run<number>(page, "return mounted.clock('open').time;");

test("a scene is hidden from assistive technology unless it is labelled", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'off' }"));

  const wrapper = page.locator("#root > span");
  expect(await wrapper.getAttribute("aria-hidden")).toBe("true");
  expect(await wrapper.getAttribute("role")).toBeNull();
  expect(await page.getByRole("img").count()).toBe(0);
  await page.close();
});

test("label shows the scene as one image named by its title and description, a string names it instead", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'off', label: true }"));

  const wrapper = page.locator("#root > span");
  expect(await wrapper.getAttribute("aria-hidden")).toBeNull();
  expect(await page.getByRole("img").count()).toBe(1);
  expect(await page.getByRole("img", { name: "Switch A square that turns blue." }).count()).toBe(1);

  await run(page, "show({ state: 'off', label: 'Power' });");
  expect(await wrapper.getAttribute("role")).toBe("img");
  expect(await wrapper.getAttribute("aria-label")).toBe("Power");
  expect(await page.getByRole("img", { name: "Power" }).count()).toBe(1);
  await page.close();
});

test("the first state shows at once and a later one animates to its resting place", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'on' }"));
  expect(await time(page)).toBe(0.4);

  await run(page, "show({ state: 'off' });");
  await page.waitForFunction("mounted.clock('open').time < 0.4");
  await page.waitForFunction("mounted.clock('open').time === 0");

  await run(page, "show({ state: 'on' });");
  await page.waitForFunction("mounted.clock('open').time === 0.4");
  expect(await run(page, "return log;")).toEqual(["mount"]);
  await page.close();
});

test("a state that holds the same values, or places written out again, change nothing", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: { menu: 'open' }, places: { 'menu.open': { open: 1 } } }"));
  await run(page, "show({ state: { menu: 'open' }, places: { 'menu.open': { open: 1 } } });");
  expect(await time(page)).toBe(0.4);
  expect(await run(page, "return log;")).toEqual(["mount"]);

  await run(
    page,
    "mounted.clock('open').seek(0.1); show({ state: { menu: 'open' }, places: { 'menu.open': { open: 1 } } });",
  );
  expect(await time(page)).toBe(0.1);
  await page.close();
});

test("new places attach the scene again", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'half', places: { half: { open: 0.5 } } }"));
  expect(await time(page)).toBe(0.2);

  await run(page, "show({ state: 'half', places: { half: { open: 1 } } });");
  expect(await time(page)).toBe(0.4);
  expect(await run(page, "return log;")).toEqual(["mount", "cleanup", "mount"]);
  await page.close();
});

test("under StrictMode the effects run twice and a state change still animates", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'off' }", true));
  expect(await run(page, "return log;")).toEqual(["mount", "cleanup", "mount"]);
  expect(await time(page)).toBe(0);

  await run(page, "show({ state: 'on' });");
  expect(await time(page)).toBeLessThan(0.4);
  await page.waitForFunction("mounted.clock('open').time === 0.4");
  await page.close();
});

test("unmounting runs the onMount cleanup and stops the move", async () => {
  const page = await open_();

  await run(page, RENDER("{ state: 'off' }"));
  await run(page, "show({ state: 'on' }); lib.flushSync(() => root.unmount());");
  expect(await run(page, "return log;")).toEqual(["mount", "cleanup"]);
  expect(await page.locator("#root > span").count()).toBe(0);

  const stopped = await time(page);
  await page.waitForTimeout(150);
  expect(await time(page)).toBe(stopped);
  await page.close();
});

test("the wrapper takes its size from the scene, scales with its width and forwards ref, className and style", async () => {
  const page = await open_();

  await run(
    page,
    RENDER(
      "{ state: 'off', className: 'art', style: { color: 'red' }, id: 'switch', ref: (element) => (globalThis.wrapper = element) }",
    ),
  );

  const box = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();

      return [width, height];
    });

  expect(await box("#switch")).toEqual([60, 40]);
  expect(await box("#switch > svg")).toEqual([60, 40]);
  expect(await run(page, "return wrapper === document.getElementById('switch');")).toBe(true);
  expect(await page.locator("#switch").getAttribute("class")).toBe("art");

  await run(page, "show({ id: 'switch', style: { width: 120 } });");
  expect(await box("#switch")).toEqual([120, 80]);
  expect(await box("#switch > svg")).toEqual([120, 80]);
  await page.close();
});

test("renders on the server, hydrates without a warning, then a state change animates", async () => {
  const page = await open_();

  const html = await run<string>(
    page,
    `const { Scene, createElement: h, renderToString } = lib;
     return renderToString(h(Scene, { scene: art, state: 'off' }));`,
  );

  expect(html).toContain('<span aria-hidden="true"');
  expect(html).toContain("<svg");

  await run(
    page,
    `document.getElementById('root').innerHTML = ${JSON.stringify(html)};
    globalThis.problems = [];
    const { error } = console;
    console.error = (...args) => problems.push(args.join(' '));
    const { Scene, createElement: h, hydrateRoot, flushSync } = lib;
    const onRecoverableError = (error) => problems.push(String(error));
    globalThis.show = (state) => flushSync(() => root.render(h(Scene, { scene: art, state, onMount: (scene) => { globalThis.mounted = scene; } })));
    globalThis.root = hydrateRoot(document.getElementById('root'), h(Scene, { scene: art, state: 'off', onMount: (scene) => { globalThis.mounted = scene; } }), { onRecoverableError });`,
  );
  await page.waitForFunction("globalThis.mounted");

  expect(await run(page, "return problems;")).toEqual([]);
  expect(await time(page)).toBe(0);

  await run(page, "show('on');");
  expect(await time(page)).toBeLessThan(0.4);
  await page.waitForFunction("mounted.clock('open').time === 0.4");
  await page.close();
});
