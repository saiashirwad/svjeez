import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright-core";
import { scene } from "svjeez";
import { placements } from "svjeez/tools";
import {
  captureScript,
  compile,
  mergeSchemes,
  type Animation,
  type Snapshot,
} from "../src/index.ts";
import { box, snapshot } from "./fixtures.ts";

const anim = (props: Partial<Animation>): Animation => ({
  kind: "animation",
  name: "a",
  keyframes: [],
  duration: 1000,
  delay: 0,
  endDelay: 0,
  iterations: 1,
  direction: "normal",
  easing: "linear",
  fill: "none",
  currentTime: 0,
  playbackRate: 1,
  playState: "running",
  ...props,
});

const sceneOf = (compiled: ReturnType<typeof compile>) =>
  scene({ size: compiled.size, duration: compiled.duration, title: "t" }, () => compiled.element);

describe("endless animation that starts in a later state", () => {
  test("steps() and zero-length cuts do not overshoot the scene", () => {
    const spin = anim({
      name: "spin",
      easing: "steps(8)",
      currentTime: 130,
      iterations: "infinite",
      keyframes: [
        { offset: 0, easing: "linear", props: { transform: "rotate(0deg)" } },
        { offset: 1, easing: "linear", props: { transform: "rotate(360deg)" } },
      ],
    });

    const states = [[spin], [], [spin]].map((animations, i) => ({
      name: `s${i}`,
      snapshot: snapshot(
        box({
          id: "app",
          rect: { x: 0, y: 0, width: 400, height: 100 },
          children: [
            box({ key: "b", rect: { x: i * 100, y: 0, width: 20, height: 20 }, animations }),
          ],
        }),
      ),
    }));

    expect(() => compile(states, { over: 0.3, hold: 0.7 })).not.toThrow();
  });
});

describe("mergeSchemes with a style in one scheme only", () => {
  const white = "rgb(255, 255, 255)";
  const black = "rgb(0, 0, 0)";
  const shadow = { x: 0, y: 1, blur: 2, spread: 0, color: black, inset: false };
  const side = { width: 1, style: "solid", color: black } as const;

  test("keeps light's value, and drops what only dark has", () => {
    const merged = mergeSchemes(
      snapshot(box({ background: white, opacity: 0.5, shadows: [shadow] })),
      snapshot(box({ background: black, border: [side, side, side, side] })),
    ).root;

    expect(merged.background).toEqual({ light: white, dark: black });
    expect(merged.opacity).toBe(0.5);
    expect(merged.shadows).toEqual([shadow]);
    expect(merged.border).toBeUndefined();
  });

  test("lists of different lengths keep light's", () => {
    const merged = mergeSchemes(
      snapshot(box({ shadows: [shadow, shadow] })),
      snapshot(box({ shadows: [shadow] })),
    ).root;

    expect(merged.shadows).toEqual([shadow, shadow]);
  });

  test("a different tree still throws", () => {
    expect(() => mergeSchemes(snapshot(box({ children: [box()] })), snapshot(box()))).toThrow(
      /children/,
    );
  });
});

describe("on a real page", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  test("a centered spinner (translate) spins in place", async () => {
    const page = await browser.newPage({ viewport: { width: 200, height: 200 } });

    await page.setContent(`<!doctype html><style>
      html, body { margin: 0 }
      @keyframes spin { to { transform: rotate(360deg) } }
      #s { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; background: #c33;
        translate: -50% -50%; animation: spin 1s linear infinite }
    </style><div id="app" style="position:relative;width:200px;height:200px"><div id="s"></div></div>`);

    const captured = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("app"))`,
    );

    await page.close();

    const compiled = compile(captured);
    const model = sceneOf(compiled);
    const key = (t: number) => placements(model, t).find((p) => p.key.endsWith("/s/@track"))!;

    const center = (t: number) => {
      const { box } = key(t);

      return [box.x + box.width / 2, box.y + box.height / 2];
    };

    const [x0, y0] = center(0);

    for (const t of [0.2, 0.45, 0.8]) {
      const [x, y] = center(t);

      expect(x).toBeCloseTo(x0!, 0);
      expect(y).toBeCloseTo(y0!, 0);
    }
  });

  test("a background-color animation survives both schemes", async () => {
    const shoot = async (scheme: "light" | "dark", at: number) => {
      const page = await browser.newPage({
        viewport: { width: 100, height: 100 },
        colorScheme: scheme,
      });

      await page.setContent(`<!doctype html><style>
        html, body { margin: 0 }
        @keyframes pulse { from { background-color: rgb(255, 0, 0) } to { background-color: rgb(0, 0, 255) } }
        #b { width: 40px; height: 40px; animation: pulse 2s linear infinite }
      </style><div id="app"><div id="b"></div></div>`);

      await page.evaluate(async (ms) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = ms;
          a.play();
        }
      }, at);

      const snap = await page.evaluate<Snapshot>(
        `(${captureScript})(document.getElementById("app"))`,
      );

      await page.close();

      return snap;
    };

    const merged = mergeSchemes(await shoot("light", 500), await shoot("dark", 900));
    const compiled = compile(merged);

    expect(compiled.diagnostics).toEqual([]);

    const model = sceneOf(compiled);
    const fills = JSON.stringify(model.root);

    expect(fills).toContain('"fill":{"kind":"lane"');
    expect(compiled.duration).toBeGreaterThan(0);
  });
});
