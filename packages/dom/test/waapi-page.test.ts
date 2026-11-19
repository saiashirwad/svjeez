import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { scene } from "svjeez";
import { placements } from "svjeez/tools";
import { captureScript, compile, type Snapshot } from "../src/index.ts";

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

    // The phase each animation had when it was captured, a few milliseconds past 500.
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
});
