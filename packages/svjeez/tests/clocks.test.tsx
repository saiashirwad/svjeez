import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { Sequence, Shape, clock, enter, linear, rect, scene, span, track } from "svjeez";
import { svg } from "svjeez/tools";

const open = clock("open", span(1, 0.4));
const grow = clock("grow", span(2, 1));

const gradient = (color: "#ff0000" | "#0000ff") =>
  linear({ from: [0, 0], to: [40, 0], stops: [color, "#000000"] });

const build = (playbackRate = 1) =>
  svg.emit(
    scene({ size: [40, 40], duration: 4, title: "Clocks" }, () => (
      <>
        <Sequence clock={open}>
          <Shape
            key="card"
            geometry={rect(20, 20)}
            fill={track(gradient("#ff0000")).to(gradient("#0000ff"), span(0, 0.4))}
            motion={enter(span(0, 0.4))}
            rotate={track(0).to(90, span(0, 0.4))}
          />
        </Sequence>
        <Sequence clock={grow}>
          <Shape key="bar" geometry={rect(20, 20)} fill="#00aa00" motion={enter(span(0, 1))} />
        </Sequence>
        <Shape
          key="free"
          geometry={rect(5, 5)}
          fill="#000000"
          opacity={track(0).to(1, span(0, 4))}
        />
      </>
    )),
    { playbackRate },
  );

let browser: Browser;
let library = "";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-clocks-"));
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

const page_ = async (
  markup: string,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
): Promise<Page> => {
  const page = await browser.newPage({ reducedMotion, viewport: { width: 400, height: 300 } });
  await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
  await page.addScriptTag({ content: library });

  return page;
};

// The page's own code runs as text: the library is the global `lib` there, and `scene` what mount() returned.
const run = <T,>(page: Page, code: string) => page.evaluate<T>(`(async () => { ${code} })()`);

const MOUNT = "globalThis.scene = lib.mount(document.querySelector('svg'));";

// What the clock "open" shows: its elements' computed style, and the colors of its gradient.
const LOOK = `
  const numbers = (text) => text.replace(/-?\\d*\\.?\\d+(e-?\\d+)?/g, (n) => (+n).toFixed(3));
  return [...document.querySelectorAll('[data-clock="open"], [data-clock="open"] > stop')].map((one) => {
    const style = getComputedStyle(one);
    return numbers(one.localName === "stop" ? style.stopColor : style.opacity + " " + style.transform);
  });`;

const looks = (page: Page) => run<string[]>(page, LOOK);

/** What the page's own seek() shows at `time`, with no clocks mounted. */
const seeking = async (markup: string, time: number) => {
  const page = await page_(markup);
  await run(page, `lib.seek(${time});`);
  const out = await looks(page);
  await page.close();

  return out;
};

test("seek shows the picture of scene time at + t, and progress is a share of the clock", async () => {
  const markup = build();
  const expected = await seeking(markup, 1.2);
  const page = await page_(markup);

  await run(page, MOUNT);

  expect(await run(page, "return [scene.clock('open').over, scene.clock('open').time];")).toEqual([
    0.4, 0,
  ]);
  expect(await looks(page)).toEqual(await seeking(markup, 1));

  await run(page, "scene.clock('open').seek(0.2);");

  expect(await looks(page)).toEqual(expected);
  expect(expected.join()).not.toBe((await seeking(markup, 1)).join());

  await run(page, "scene.clock('open').seek(0);");
  await run(page, "scene.clock('open').progress(0.5);");

  expect(await run(page, "return scene.clock('open').time;")).toBeCloseTo(0.2, 9);
  expect(await looks(page)).toEqual(expected);

  await run(page, "scene.clock('open').seek(9);");

  expect(await run(page, "return scene.clock('open').time;")).toBe(0.4);
  expect(await looks(page)).toEqual(await seeking(markup, 1.4));

  await run(page, "scene.clock('open').progress(-3);");

  expect(await run(page, "return scene.clock('open').time;")).toBe(0);
  await page.close();
});

test("clocks are independent of each other", async () => {
  const page = await page_(build());

  await run(page, MOUNT);
  await run(page, "scene.clock('open').seek(0.4);");

  expect(await run(page, "return [...scene.clocks.keys()];")).toEqual(["open", "grow"]);
  expect(await run(page, "return scene.clock('grow').time;")).toBe(0);
  expect(
    await run(
      page,
      "return getComputedStyle(document.querySelector('[data-clock=grow]')).opacity;",
    ),
  ).toBe("0");
  await page.close();
});

test("play runs to the end of the clock and resolves true, and reverse runs back", async () => {
  const page = await page_(build());

  await run(page, MOUNT);

  const forward = await run<[boolean, number, number]>(
    page,
    "const t = performance.now(); const ok = await scene.clock('open').play(); return [ok, scene.clock('open').time, performance.now() - t];",
  );

  expect(forward[0]).toBe(true);
  expect(forward[1]).toBe(0.4);
  expect(forward[2]).toBeGreaterThan(350);
  expect(forward[2]).toBeLessThan(900);

  const back = await run<[boolean, number]>(
    page,
    "const ok = await scene.clock('open').reverse(); return [ok, scene.clock('open').time];",
  );

  expect(back).toEqual([true, 0]);
  await page.close();
});

test("a play that something else interrupts resolves false", async () => {
  const page = await page_(build());

  await run(page, MOUNT);

  expect(
    await run(
      page,
      "const c = scene.clock('open'); const p = c.play(); await new Promise((r) => setTimeout(r, 100)); c.seek(0.05); return [await p, c.time];",
    ),
  ).toEqual([false, 0.05]);

  expect(
    await run(
      page,
      "const c = scene.clock('open'); const p = c.play(); await new Promise((r) => setTimeout(r, 100)); const q = c.reverse(); c.pause(); return [await p, await q];",
    ),
  ).toEqual([false, false]);

  const stopped = await run<[boolean, number, number]>(
    page,
    "const c = scene.clock('open'); c.seek(0); const p = c.play(); await new Promise((r) => setTimeout(r, 100)); scene.unmount(); const at = c.time; await new Promise((r) => setTimeout(r, 100)); return [await p, at, c.time];",
  );

  expect(stopped[0]).toBe(false);
  expect(stopped[1]).toBeGreaterThan(0);
  expect(stopped[2]).toBe(stopped[1]);
  await page.close();
});

test("follow hands the clock to a driver until it is stopped", async () => {
  const page = await page_(build());

  await run(page, MOUNT);

  expect(
    await run(
      page,
      `const c = scene.clock('open');
       let move; let stopped = 0;
       const stop = c.follow((progress) => { move = progress; return () => stopped++; });
       move(0.25); const first = c.time;
       move(2); const second = c.time;
       stop(); stop();
       return [first, second, stopped];`,
    ),
  ).toEqual([0.1, 0.4, 1]);

  expect(
    await run(
      page,
      `const c = scene.clock('open'); let stopped = 0;
       c.follow(() => () => stopped++);
       scene.unmount();
       return stopped;`,
    ),
  ).toBe(1);
  await page.close();
});

const TALL = (markup: string) =>
  `<div style="height:1000px"></div><div id="card" style="width:200px;height:200px">${markup}</div><div style="height:1000px"></div>`;

test("scrolled runs the clock from the card entering the viewport to leaving it", async () => {
  const page = await page_(TALL(build()));

  await run(page, MOUNT);
  await run(page, "scene.clock('open').follow(lib.scrolled(document.getElementById('card')));");

  expect(await run(page, "return scene.clock('open').time;")).toBe(0);

  // The card is 200 tall in a 300 tall viewport: halfway is when its top is 50 from the top.
  await run(page, "scrollTo(0, 1000 - 50);");
  await page.waitForFunction("scene.clock('open').time > 0");

  expect(await run<number>(page, "return scene.clock('open').time;")).toBeCloseTo(0.2, 3);

  await run(page, "scrollTo(0, 5000);");
  await page.waitForFunction("scene.clock('open').time === 0.4");

  await run(page, "scrollTo(0, 0);");
  await page.waitForFunction("scene.clock('open').time === 0");
  await page.close();
});

test("pointer runs the clock with the pointer across the box, along either axis", async () => {
  const page = await page_(
    `<div id="box" style="width:200px;height:100px;margin:20px">${build()}</div>`,
  );

  await run(page, MOUNT);
  await run(page, "scene.clock('open').follow(lib.pointer(document.getElementById('box')));");
  await run(
    page,
    "scene.clock('grow').follow(lib.pointer(document.getElementById('box'), { axis: 'y' }));",
  );

  await page.mouse.move(120, 40);
  await page.waitForFunction("scene.clock('open').time > 0");

  expect(await run<number>(page, "return scene.clock('open').time;")).toBeCloseTo(0.2, 3);
  expect(await run<number>(page, "return scene.clock('grow').time;")).toBeCloseTo(0.2, 3);

  await page.mouse.move(380, 280);
  await page.waitForFunction("scene.clock('open').time === 0.4");
  await page.close();
});

test("animations that are on no clock go on playing", async () => {
  const page = await page_(build());

  await run(page, MOUNT);
  const free = "document.querySelector('rect:not([data-clock])').getAnimations()[0]";
  const first = await run<number>(page, `return ${free}.currentTime;`);
  await page.waitForTimeout(150);

  expect(await run<number>(page, `return ${free}.currentTime;`)).toBeGreaterThan(first + 100);
  expect(await run(page, `return ${free}.playState;`)).toBe("running");
  expect(
    await run(
      page,
      "return document.querySelector('rect[data-clock=open]').getAnimations()[0].playState;",
    ),
  ).toBe("paused");
  await page.close();
});

test("under reduced motion the clock still shows the same picture, and play jumps to the end", async () => {
  const markup = build();
  const expected = await seeking(markup, 1.2);
  const page = await page_(markup, "reduce");

  await run(page, MOUNT);
  await run(page, "scene.clock('open').seek(0.2);");

  expect(await looks(page)).toEqual(expected);

  const jumped = await run<[boolean, number]>(
    page,
    "const c = scene.clock('open'); c.seek(0); const ok = await c.play(); return [ok, c.time];",
  );

  expect(jumped).toEqual([true, 0.4]);
  expect(await looks(page)).toEqual(await seeking(markup, 1.4));
  expect(await run(page, "return await scene.clock('open').reverse();")).toBe(true);
  expect(await run(page, "return scene.clock('open').time;")).toBe(0);
  await page.close();
});

test("a clock that is not in the SVG throws, naming the ones that are", async () => {
  const page = await page_(build());

  await run(page, MOUNT);

  const message = await run<string>(
    page,
    "try { scene.clock('shut'); return ''; } catch (error) { return error.message; }",
  );

  expect(message).toContain('"shut"');
  expect(message).toContain('"open", "grow"');
  await page.close();
});

test("a playback rate divides scene seconds into playback seconds, for seek and for play", async () => {
  const markup = build(2);
  const page = await page_(markup);

  await run(page, MOUNT);
  await run(page, "scene.clock('open').seek(0.2);");

  expect(await looks(page)).toEqual(await seeking(markup, 1.2));

  const took = await run<number>(
    page,
    "const c = scene.clock('open'); c.seek(0); const t = performance.now(); await c.play(); return performance.now() - t;",
  );

  expect(took).toBeGreaterThan(180);
  expect(took).toBeLessThan(350);
  await page.close();
});
