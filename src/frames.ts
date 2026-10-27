import type { Seconds } from "./motion";

/** When to capture: exact playback times, or `count` frames spread evenly over one loop. */
export type FrameTimes = { readonly times: readonly Seconds[]; readonly count?: never } | { readonly count: number; readonly times?: never };

export type FrameOptions = FrameTimes & {
  /** Device pixel ratio. Default 1. */
  readonly scale?: number;
  /** Which side of `prefers-color-scheme` to render. Default "light". */
  readonly colorScheme?: "light" | "dark";
  /** CSS background behind the SVG. Default `Canvas`, the scheme's page color. Pass "transparent" for alpha. */
  readonly background?: string;
  /** Also lay the frames out on one labelled contact sheet. */
  readonly sheet?: boolean | { readonly columns?: number };
  /** A Chromium or Chrome binary to use instead of Playwright's own. */
  readonly executablePath?: string;
};

export interface Frame {
  readonly time: Seconds;
  readonly png: Uint8Array;
}

export interface Frames {
  /** The longest animation in the SVG, in playback seconds: one loop of the scene. */
  readonly duration: Seconds;
  readonly frames: readonly Frame[];
  readonly sheet?: Uint8Array;
}

/** Runs in the page: pause every CSS and SMIL animation at `time` playback seconds. */
export const seek = (time: Seconds): void => {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = time * 1000;
  }
  for (const svg of document.querySelectorAll("svg")) {
    svg.pauseAnimations();
    svg.setCurrentTime(time);
  }
};

/** Runs in the page: the longest CSS or SMIL animation, in seconds. */
export const loopLength = (): Seconds => {
  const css = document.getAnimations().map((animation) => Number(animation.effect?.getTiming().duration) / 1000 || 0);
  const smil = [...document.querySelectorAll("animate, animateTransform, animateMotion, set")].map((element) => parseFloat(element.getAttribute("dur") ?? "") || 0);
  return Math.max(0, ...css, ...smil);
};

const launch = async (executablePath?: string) => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error("renderFrames needs playwright-core. Install it with `npm i -D playwright-core`, then `npx playwright-core install chromium-headless-shell`.");
  });
  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;
    return chromium.launch({ channel: "chrome" }).catch(() => {
      throw new Error(`No Chromium to render with. Run \`npx playwright-core install chromium-headless-shell\`, or pass executablePath.\n${error instanceof Error ? error.message : error}`);
    });
  }
};

const size = (svg: string): { width: number; height: number } => {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = parseFloat(/\swidth="([\d.]+)"/.exec(root)?.[1] ?? "");
  const height = parseFloat(/\sheight="([\d.]+)"/.exec(root)?.[1] ?? "");
  if (!(width > 0 && height > 0)) throw new Error("renderFrames needs an <svg> root with numeric width and height.");
  return { width, height };
};

const label = (time: Seconds): string => `${Number(time.toFixed(3))}s`;

const sheetHtml = (frames: readonly Frame[], width: number, columns: number): string => `<!doctype html>
<style>
  :root { color-scheme: light dark; background: Canvas; font: 12px ui-monospace, Menlo, monospace }
  body { margin: 0; padding: 12px; display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: 12px; width: max-content }
  figure { margin: 0 } img { display: block; width: ${width}px; outline: 1px solid GrayText } figcaption { padding-top: 4px }
</style>
${frames.map((frame) => `<figure><img src="data:image/png;base64,${Buffer.from(frame.png).toString("base64")}"><figcaption>t = ${label(frame.time)}</figcaption></figure>`).join("\n")}`;

/** Rasterize an SVG at chosen playback times in headless Chromium. Needs `playwright-core` and a Chromium build. */
export const renderFrames = async (svg: string, options: FrameOptions): Promise<Frames> => {
  const { width, height } = size(svg);
  const scale = options.scale ?? 1;
  const browser = await launch(options.executablePath);
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: scale, colorScheme: options.colorScheme ?? "light", reducedMotion: "no-preference" });
    await page.setContent(
      `<!doctype html><style>:root{color-scheme:${options.colorScheme ?? "light"}}body{margin:0}#stage{display:inline-block;line-height:0;background:${options.background ?? "Canvas"}}</style><div id="stage">${svg}</div>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const duration = await page.evaluate(loopLength);
    const times = options.times ?? Array.from({ length: options.count }, (_, i) => (i * duration) / options.count);
    const stage = page.locator("#stage");
    const frames: Frame[] = [];
    for (const time of times) {
      if (!(Number.isFinite(time) && time >= 0)) throw new Error(`Frame times must be finite and non-negative, got ${time}.`);
      await page.evaluate(seek, time);
      frames.push({ time, png: new Uint8Array(await stage.screenshot({ animations: "allow", omitBackground: true })) });
    }
    if (!options.sheet) return { duration, frames };
    const columns = (typeof options.sheet === "object" && options.sheet.columns) || Math.min(frames.length, 4);
    await page.setViewportSize({ width: 1, height: 1 });
    await page.setContent(sheetHtml(frames, width, columns));
    const sheet = new Uint8Array(await page.locator("body").screenshot());
    return { duration, frames, sheet };
  } finally {
    await browser.close();
  }
};
