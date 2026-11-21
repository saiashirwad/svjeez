import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { Sequence, Shape, clock, enter, rect, scene, span } from "svjeez";
import { svg } from "svjeez/tools";

const open = clock("open", span(0, 0.4));
const grow = clock("grow", span(1, 0.4));

const build = (states?: Record<string, Record<string, number>>) =>
  svg.emit(
    scene({ size: [60, 40], duration: 4, title: "Attach", states }, () => (
      <>
        <Sequence clock={open}>
          <Shape key="card" geometry={rect(20, 20)} fill="#ff0000" motion={enter(span(0, 0.4))} />
        </Sequence>
        <Sequence clock={grow}>
          <Shape key="bar" geometry={rect(20, 20)} fill="#00aa00" motion={enter(span(0, 0.4))} />
        </Sequence>
      </>
    )),
  );

const DECLARED = {
  off: { open: 0 },
  on: { open: 1 },
  "menu.open": { open: 1, grow: 0 },
  "menu.open.wide": { grow: 1 },
};

let browser: Browser;
let library = "";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-attach-"));
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

const page_ = async (markup: string): Promise<Page> => {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.setContent(
    `<!doctype html><body style="margin:0"><div id="host">${markup}</div></body>`,
  );
  await page.addScriptTag({ content: library });

  return page;
};

// The page's own code runs as text: the library is the global `lib` there.
const run = <T,>(page: Page, code: string) => page.evaluate<T>(`(async () => { ${code} })()`);

const ATTACH = (options: string) =>
  `globalThis.attached = lib.attach(document.getElementById('host'), ${options});`;

const times = (page: Page) =>
  run<number[]>(
    page,
    "const s = attached.scene; return [s.clock('open').time, s.clock('grow').time];",
  );

test("the first state shows with no animation", async () => {
  const page = await page_(build(DECLARED));

  await run(page, ATTACH("{ state: 'on' }"));

  expect(await times(page)).toEqual([0.4, 0]);
  await page.close();
});

test("a later state animates from where the clock is", async () => {
  const page = await page_(build(DECLARED));

  await run(page, ATTACH("{ state: 'off' }"));
  await run(page, "attached.update({ state: 'on' });");

  const [midway] = await times(page);
  expect(midway).toBeLessThan(0.4);

  await page.waitForFunction("attached.scene.clock('open').time === 0.4");
  await page.close();
});

test("the same value does not restart the move, an object value is compared by what it holds", async () => {
  const page = await page_(build(DECLARED));

  await run(page, ATTACH("{ state: { menu: 'open' } }"));
  expect(await times(page)).toEqual([0.4, 0]);

  await run(
    page,
    "attached.update({ state: { menu: 'open' } }); attached.update({ state: { menu: 'open' } });",
  );
  expect(await times(page)).toEqual([0.4, 0]);

  await run(page, "attached.update({ state: { menu: { open: 'wide' } } });");
  await page.waitForFunction("attached.scene.clock('grow').time === 0.4");

  await run(page, "attached.update({ state: 'off' }); attached.scene.clock('open').seek(0.3);");
  await run(page, "attached.update({ state: 'off' });");
  expect(await run(page, "return attached.scene.clock('open').time;")).toBe(0.3);
  await page.close();
});

test("places given to attach() stand in for the scene's states", async () => {
  const page = await page_(build());

  await run(page, ATTACH("{ state: 'half', places: { half: { open: 0.5 } } }"));

  expect(await times(page)).toEqual([0.2, 0]);
  await page.close();
});

test("a state with no places anywhere is refused, and so is a state the scene did not declare, with no state it just mounts", async () => {
  const page = await page_(build());

  expect(
    await run<string>(
      page,
      "try { lib.attach(document.getElementById('host'), { state: 'on' }); return ''; } catch (error) { return error.message; }",
    ),
  ).toContain("This SVG declares no states");

  await run(page, ATTACH("{}"));
  expect(await run(page, "return [...attached.scene.clocks.keys()];")).toEqual(["open", "grow"]);
  await page.close();
});

test("onMount runs once with the scene, and its cleanup runs on destroy", async () => {
  const page = await page_(build(DECLARED));

  await run(
    page,
    `globalThis.log = [];
     ${ATTACH("{ state: 'off', onMount: (scene) => { log.push('mount ' + scene.clocks.size); return () => log.push('cleanup'); } }")}
     attached.update({ state: 'on' });`,
  );
  expect(await run(page, "return log;")).toEqual(["mount 2"]);

  await run(page, "attached.destroy();");
  expect(await run(page, "return log;")).toEqual(["mount 2", "cleanup"]);
  await page.close();
});

test("destroy stops the move, and the element can be attached again", async () => {
  const page = await page_(build(DECLARED));

  await run(page, ATTACH("{ state: 'off' }"));
  await run(page, "attached.update({ state: 'on' }); attached.destroy();");

  const stopped = await run<number>(page, "return attached.scene.clock('open').time;");
  await page.waitForTimeout(150);
  expect(await run(page, "return attached.scene.clock('open').time;")).toBe(stopped);

  await run(page, ATTACH("{ state: 'on' }"));
  expect(await times(page)).toEqual([0.4, 0]);

  await run(page, "attached.update({ state: 'off' });");
  await page.waitForFunction("attached.scene.clock('open').time === 0");
  await page.close();
});

test("mounted scenes list the states the scene declared", async () => {
  const page = await page_(build(DECLARED));

  await run(page, ATTACH("{}"));
  expect(await run(page, "return attached.scene.states;")).toEqual(DECLARED);
  await page.close();
});
