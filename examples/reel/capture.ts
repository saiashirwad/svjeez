// Captures a page the way a reviewer would see it: a still with motion turned off, or a film of a scroll recorded
// through Chromium's screencast, which sends a frame whenever the page repaints.
import { chromium, type Browser, type Page } from "playwright-core";

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Frame {
  /** Seconds since the film started. */
  readonly t: number;
  readonly jpeg: Uint8Array;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

let browser: Browser | undefined;
const launch = async () => (browser ??= await chromium.launch());
export const close = () => browser?.close();

const open = async (url: string, viewport: Viewport, motion: "reduce" | "no-preference") => {
  const page = await (
    await launch()
  ).newPage({ viewport, colorScheme: "light", reducedMotion: motion });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  return page;
};

const top = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector(s)!.getBoundingClientRect().top + scrollY, selector);

/** A screenshot with reduced motion on, so scenes hold their stills and the only differences are the change. */
export const still = async (
  url: string,
  viewport: Viewport,
  selector?: string,
): Promise<Uint8Array> => {
  const page = await open(url, viewport, "reduce");

  if (selector) await page.evaluate((y) => scrollTo(0, y), (await top(page, selector)) - 24);
  // Scenes that play once and hold, such as the hero's note, need time to land.
  await page.waitForTimeout(3000);
  const shot = await page.screenshot({ type: "jpeg", quality: 72 });
  await page.close();

  return shot;
};

export interface FilmOptions {
  readonly viewport: Viewport;
  /** Scroll so this element's top goes from the bottom of the screen to the top. */
  readonly selector: string;
  /** Length of the scroll in seconds. */
  readonly scroll: number;
  /** Seconds to keep filming after the scroll lands. */
  readonly hold: number;
  /** Width the screencast scales frames down to. */
  readonly width: number;
  readonly quality?: number;
}

/** A scroll filmed as a reader would see it, one JPEG per repaint, with its time. */
export const film = async (url: string, options: FilmOptions): Promise<Frame[]> => {
  const { viewport, selector, scroll, hold, width, quality = 55 } = options;
  const page = await open(url, viewport, "no-preference");
  const y = await top(page, selector);
  await page.evaluate((to) => scrollTo(0, to), y - viewport.height);
  await page.waitForTimeout(900);

  const cdp = await page.context().newCDPSession(page);
  const frames: { at: number; data: string }[] = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ at: metadata.timestamp ?? Date.now() / 1000, data });
    void cdp.send("Page.screencastFrameAck", { sessionId });
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality,
    maxWidth: width,
    maxHeight: 4000,
  });
  await page.waitForTimeout(150);
  const start = Date.now() / 1000;

  // Ease the scroll in and out, at 60 steps a second, so it reads as a hand on a trackpad.
  const steps = Math.round(scroll * 60);
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    await page.evaluate((to) => scrollTo(0, to), y - viewport.height + viewport.height * eased);
    await page.waitForTimeout(1000 / 60);
  }
  await page.waitForTimeout(hold * 1000);
  await cdp.send("Page.stopScreencast");
  await page.close();

  return frames
    .map(({ at, data }) => ({
      t: Math.max(0, at - start),
      jpeg: Uint8Array.from(Buffer.from(data, "base64")),
    }))
    .sort((a, b) => a.t - b.t);
};

/** Keep one frame per `1 / fps` seconds: the last repaint at or before each tick. */
export const resample = (frames: readonly Frame[], fps: number, length: number): Frame[] => {
  const out: Frame[] = [];

  for (let t = 0; t <= length + 1e-9; t += 1 / fps) {
    const at = frames.findLast((f) => f.t <= t) ?? frames[0];
    if (at && out.at(-1)?.jpeg !== at.jpeg) out.push({ t, jpeg: at.jpeg });
  }

  return out;
};

/** Cut every frame down to `box` (in the frames' pixels) and scale it to `width`, re-encoded in Chromium. */
export const crop = async (
  frames: readonly Frame[],
  box: Box,
  width: number,
  quality = 0.62,
): Promise<Frame[]> => {
  const page = await (await launch()).newPage();
  const cut = await page.evaluate(
    async ({ sources, box, width, quality }) => {
      const height = Math.round((box.height * width) / box.width);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      const out: string[] = [];
      for (const src of sources) {
        const img = new Image();
        img.src = src;
        await img.decode();
        ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, width, height);
        const bytes = new Uint8Array(
          await (await canvas.convertToBlob({ type: "image/jpeg", quality })).arrayBuffer(),
        );
        let text = "";
        for (const b of bytes) text += String.fromCharCode(b);
        out.push(btoa(text));
      }
      return out;
    },
    {
      sources: frames.map(
        (f) => `data:image/jpeg;base64,${Buffer.from(f.jpeg).toString("base64")}`,
      ),
      box,
      width,
      quality,
    },
  );
  await page.close();

  return frames.map((f, i) => ({ t: f.t, jpeg: Uint8Array.from(Buffer.from(cut[i]!, "base64")) }));
};

/**
 * Boxes around what changed between two images of the same size. Pixels are compared in Chromium on a grid of
 * `cell`-pixel squares, and touching changed squares merge into one box.
 */
export const changes = async (before: Uint8Array, after: Uint8Array, cell = 12): Promise<Box[]> => {
  const page = await (await launch()).newPage();
  const url = (b: Uint8Array) => `data:image/jpeg;base64,${Buffer.from(b).toString("base64")}`;
  const boxes = await page.evaluate(
    async ({ a, b, cell }) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      };
      const [x, y] = [await load(a), await load(b)];
      const cols = Math.ceil(x.width / cell);
      const rows = Math.ceil(x.height / cell);
      const hot = new Uint8Array(cols * rows);

      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          let changed = 0;
          for (let py = r * cell; py < Math.min((r + 1) * cell, x.height); py++)
            for (let px = c * cell; px < Math.min((c + 1) * cell, x.width); px++) {
              const i = (py * x.width + px) * 4;
              const d =
                Math.abs(x.data[i]! - y.data[i]!) +
                Math.abs(x.data[i + 1]! - y.data[i + 1]!) +
                Math.abs(x.data[i + 2]! - y.data[i + 2]!);
              // JPEG noise stays under this; a real edit does not.
              if (d > 60) changed++;
            }
          if (changed > 4) hot[r * cols + c] = 1;
        }

      const seen = new Uint8Array(cols * rows);
      const found: { x: number; y: number; width: number; height: number }[] = [];
      for (let start = 0; start < hot.length; start++) {
        if (!hot[start] || seen[start]) continue;
        let [c0, r0, c1, r1] = [cols, rows, 0, 0];
        const stack = [start];
        seen[start] = 1;
        while (stack.length) {
          const at = stack.pop()!;
          const c = at % cols;
          const r = (at - c) / cols;
          [c0, r0, c1, r1] = [Math.min(c0, c), Math.min(r0, r), Math.max(c1, c), Math.max(r1, r)];
          // Two cells of slack, so a word and its neighbour join one box.
          for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++) {
              const nc = c + dc;
              const nr = r + dr;
              const n = nr * cols + nc;
              if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && hot[n] && !seen[n]) {
                seen[n] = 1;
                stack.push(n);
              }
            }
        }
        found.push({
          x: c0 * cell,
          y: r0 * cell,
          width: (c1 - c0 + 1) * cell,
          height: (r1 - r0 + 1) * cell,
        });
      }

      return found;
    },
    { a: url(before), b: url(after), cell },
  );

  await page.close();

  return boxes;
};
