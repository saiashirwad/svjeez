import type { Seconds } from "./motion";
import { loopLength, seek } from "./page";
import { systemColorScheme } from "./scheme";

export type ColorScheme = "light" | "dark";

/** When to capture: exact playback times, or `count` frames spread evenly over one loop. */
export type FrameTimes = { readonly times: readonly Seconds[]; readonly count?: never } | { readonly count: number; readonly times?: never };

export type FrameOptions = FrameTimes & {
  /** Device pixel ratio. Default 1. */
  readonly scale?: number;
  /** Which side of `prefers-color-scheme` to render. Default "system", this machine's appearance setting. */
  readonly colorScheme?: ColorScheme | "system";
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
  /** The scheme the frames were rendered in, after resolving "system". */
  readonly colorScheme: ColorScheme;
  /** The longest animation in the SVG, in playback seconds: one loop of the scene. */
  readonly duration: Seconds;
  readonly frames: readonly Frame[];
  readonly sheet?: Uint8Array;
}

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

// Chromium cannot capture past 16384 device pixels on a side, so a big sheet renders at a lower scale.
const MAX_CAPTURE = 16000;
const GAP = 12;
const CAPTION = 20;

const label = (time: Seconds): string => `${Number(time.toFixed(3))}s`;

const sheetHtml = (frames: readonly Frame[], width: number, columns: number): string => `<!doctype html>
<style>
  :root { color-scheme: light dark; background: Canvas; font: 12px ui-monospace, Menlo, monospace }
  body { margin: 0; padding: ${GAP}px; display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: ${GAP}px; width: max-content }
  figure { margin: 0 } img { display: block; width: ${width}px; outline: 1px solid GrayText } figcaption { height: ${CAPTION - 4}px; padding-top: 4px }
</style>
${frames.map((frame) => `<figure><img src="data:image/png;base64,${Buffer.from(frame.png).toString("base64")}"><figcaption>t = ${label(frame.time)}</figcaption></figure>`).join("\n")}`;

/** Rasterize an SVG at chosen playback times in headless Chromium. Needs `playwright-core` and a Chromium build. */
export const renderFrames = async (svg: string, options: FrameOptions): Promise<Frames> => {
  const { width, height } = size(svg);
  const scale = options.scale ?? 1;
  const colorScheme = !options.colorScheme || options.colorScheme === "system" ? systemColorScheme() : options.colorScheme;
  if (!(scale > 0 && Number.isFinite(scale))) throw new Error(`scale must be a positive number, got ${scale}.`);
  if (options.times !== undefined) {
    for (const time of options.times) if (!(Number.isFinite(time) && time >= 0)) throw new Error(`renderFrames() needs finite, non-negative times, got ${time}.`);
  } else if (!(Number.isInteger(options.count) && options.count > 0)) {
    throw new Error(`renderFrames() needs a positive whole count, got ${options.count}.`);
  }
  const columns = typeof options.sheet === "object" ? options.sheet.columns : undefined;
  if (columns !== undefined && !(Number.isInteger(columns) && columns > 0)) throw new Error(`sheet columns must be a positive whole number, got ${columns}.`);
  const browser = await launch(options.executablePath);
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: scale, colorScheme, reducedMotion: "no-preference" });
    await page.setContent(
      `<!doctype html><style>:root{color-scheme:${colorScheme}}body{margin:0}#stage{display:inline-block;line-height:0;background:${options.background ?? "Canvas"}}</style><div id="stage">${svg}</div>`,
    );
    await page.evaluate(() => document.fonts.ready);
    const duration = await page.evaluate(loopLength);
    const times = options.times ?? Array.from({ length: options.count }, (_, i) => (i * duration) / options.count);
    const stage = page.locator("#stage");
    const frames: Frame[] = [];
    for (const time of times) {
      await page.evaluate(seek, time);
      frames.push({ time, png: new Uint8Array(await stage.screenshot({ animations: "allow", omitBackground: true })) });
    }
    if (!options.sheet) return { duration, colorScheme, frames };
    const across = Math.min(columns ?? 4, frames.length);
    const sheetSize = Math.max(across * (width + GAP) + GAP, Math.ceil(frames.length / across) * (height + GAP + CAPTION) + GAP);
    const sheetPage = await browser.newPage({ viewport: { width: 1, height: 1 }, deviceScaleFactor: Math.min(scale, MAX_CAPTURE / sheetSize), colorScheme });
    await sheetPage.setContent(sheetHtml(frames, width, across));
    const sheet = new Uint8Array(await sheetPage.locator("body").screenshot());
    return { duration, colorScheme, frames, sheet };
  } finally {
    await browser.close();
  }
};
