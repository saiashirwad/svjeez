import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { scene } from "svjeez";
import { placements } from "svjeez/tools";
import { captureScript, compile, record, type Snapshot } from "../src/index.ts";
import { backgroundAt } from "./fixtures.ts";

const HTML = `<!doctype html>
<style>
  html, body { margin: 0 }
  @keyframes pulse {
    from { transform: rotate(0deg); opacity: 1 }
    to { transform: rotate(360deg); opacity: 0.2 }
  }
  #spin { position: absolute; left: 100px; top: 50px; width: 40px; height: 40px; background: #c33;
    animation: pulse 2s linear infinite }
  #move { position: absolute; left: 10px; top: 150px; width: 40px; height: 40px; background: rgb(255, 0, 0);
    transition: transform 2s linear, background-color 2s linear }
  #move.go { transform: translateX(120px); background-color: rgb(0, 0, 255) }
</style>
<div id="app" style="position:relative;width:300px;height:250px"><div id="spin"></div><div id="move"></div></div>`;

/** Puts every animation at `ms` and lets it run on, so the capture is mid-flight at a known moment. */
const rewind = (page: Page, ms: number) =>
  page.evaluate(async (at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
      animation.play();
    }
  }, ms);

describe("animations on a real page", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  test("a CSS keyframe spin and fade, and a transition mid-flight, play on from the capture", async () => {
    const page = await browser.newPage({ viewport: { width: 300, height: 250 } });

    await page.setContent(HTML);
    await page.evaluate(() => document.getElementById("move")!.classList.add("go"));
    await rewind(page, 500);

    const captured = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("app"))`,
    );

    await page.close();

    const compiled = compile(captured);
    const root = captured.root.children.flatMap((node) => (node.type === "element" ? [node] : []));
    const [spin, move] = root.map((node) => node.animations!);

    const spun = spin![0]!.currentTime;
    const moved = move![0]!.currentTime;

    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.duration).toBeGreaterThanOrEqual(2);

    const model = scene(
      { size: compiled.size, duration: compiled.duration, title: "page" },
      () => compiled.element,
    );

    const at = (t: number, key: string) =>
      placements(model, t).find((placed) => placed.key === key)!;

    const [spinKey, moveKey] = ["app/@track/spin/@track", "app/@track/move/@track"];

    for (const t of [0, 0.4, 1.1, 1.9, 2.6, 4.2]) {
      const phase = ((((spun + t * 1000) / 2000) % 1) + 1) % 1;
      const placed = at(t, spinKey);
      const turned = ((Math.atan2(placed.matrix[1], placed.matrix[0]) * 180) / Math.PI + 360) % 360;

      expect(Math.abs(turned - phase * 360) % 360).toBeLessThan(0.5);
      expect(placed.opacity).toBeCloseTo(1 - 0.8 * phase, 1);
    }

    for (const t of [0, 0.5, 1, 1.5, 3]) {
      const progress = Math.min(1, (moved + t * 1000) / 2000);

      expect(at(t, moveKey).box.x).toBeCloseTo(10 + 120 * progress, 0);
    }
  }, 60_000);
  test("a color animated mid-flight returns to its base once the animation ends, and a transition ends on its target", async () => {
    const page = await browser.newPage({ viewport: { width: 300, height: 120 } });

    await page.setContent(`<!doctype html>
<style>
  html, body { margin: 0 }
  @keyframes tint { from { background-color: rgb(255, 0, 0) } to { background-color: rgb(0, 0, 255) } }
  .box { position: absolute; top: 10px; width: 40px; height: 40px; background: rgb(0, 128, 0) }
  #tint { left: 10px; animation: tint 2s linear }
  #fade { left: 100px; transition: background-color 2s linear }
  #fade.go { background-color: rgb(200, 100, 50) }
</style>
<div id="app" style="position:relative;width:300px;height:120px">
  <div id="tint" class="box" data-key="tint"></div><div id="fade" class="box" data-key="fade"></div></div>`);
    await page.evaluate(() => document.getElementById("fade")!.classList.add("go"));
    await rewind(page, 500);

    const captured = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("app"))`,
    );

    const running = await page.evaluate(() =>
      document.getAnimations().map((animation) => animation.playState),
    );

    await page.close();

    expect(running).toEqual(["running", "running"]);

    const compiled = compile(captured);

    expect(compiled.diagnostics).toEqual([]);

    const model = scene(
      { size: compiled.size, duration: compiled.duration, title: "page" },
      () => compiled.element,
    );

    const red = Number.parseInt(backgroundAt(model, "app/tint", 0).slice(1, 3), 16);

    expect(red).toBeGreaterThan(150);
    expect(red).toBeLessThan(200);
    expect(backgroundAt(model, "app/tint", 4)).toBe("#008000");

    expect(backgroundAt(model, "app/fade", 4)).toBe("#c86432");
  }, 60_000);

  test("a pulsing dot keeps pulsing through a film of several states", async () => {
    const page = await browser.newPage({ viewport: { width: 300, height: 120 } });

    await page.setContent(`<!doctype html>
<style>
  html, body { margin: 0 }
  @keyframes beat { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.6) } }
  #dot { position: absolute; left: 10px; top: 10px; width: 12px; height: 12px; border-radius: 6px; background: #7dffc4;
    animation: beat 1.6s ease-in-out infinite }
  #card { position: absolute; left: 10px; top: 60px; width: 60px; height: 30px; background: #fc8 }
  #card.right { left: 200px }
</style>
<div id="app" style="position:relative;width:300px;height:120px"><div id="dot" data-key="dot"></div><div id="card" data-key="card"></div></div>`);

    const states = await record(page, "#app", async (snap) => {
      await snap("start");
      await page.evaluate(() => document.getElementById("card")!.classList.add("right"));
      await snap("moved", { over: 0.7 });
      await page.evaluate(() => document.getElementById("card")!.classList.remove("right"));
      await snap("back", { over: 0.7 });
    });

    await page.close();

    const compiled = compile(states);

    expect(compiled.diagnostics).toEqual([]);

    const model = scene(
      { size: compiled.size, duration: compiled.duration, title: "page" },
      () => compiled.element,
    );

    const scales = Array.from({ length: 40 }, (_, i) => {
      const [a, b] = placements(model, (i / 40) * compiled.duration).find(
        (placed) => placed.key === "app/@track/dot/@track",
      )!.matrix;

      return Math.hypot(a, b);
    });

    expect(Math.min(...scales)).toBeCloseTo(1, 2);
    expect(Math.max(...scales)).toBeGreaterThan(1.5);

    const turns = scales.filter(
      (value, i) => i > 0 && i < 39 && value > scales[i - 1]! && value > scales[i + 1]!,
    );

    expect(turns.length).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
