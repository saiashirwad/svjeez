import { execFileSync } from "node:child_process";
import type { Seconds } from "./motion";

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

/** Runs in the page: one loop of the scene, the least common multiple of every CSS and SMIL period, in seconds. */
export const loopLength = (): Seconds => {
  const css = document.getAnimations().map((animation) => Number(animation.effect?.getTiming().duration) || 0);
  const smil = [...document.querySelectorAll("animate, animateTransform, animateMotion, set")].map((element) => parseFloat(element.getAttribute("dur") ?? "") * 1000 || 0);
  const periods = [...css, ...smil].filter((ms) => ms > 0);
  const longest = Math.max(0, ...periods);
  for (let k = 1; k <= 1000; k++) {
    const loop = longest * k;
    if (periods.every((ms) => Math.abs(loop / ms - Math.round(loop / ms)) * ms < 1)) return loop / 1000;
  }
  return longest / 1000;
};

const read = (command: string, args: readonly string[]): string => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });

/** This machine's light or dark appearance: macOS, Windows, or GNOME. Light when there is none to read, as in CI. */
export const systemColorScheme = (): ColorScheme => {
  try {
    switch (process.platform) {
      case "darwin":
        return read("defaults", ["read", "-g", "AppleInterfaceStyle"]).trim() === "Dark" ? "dark" : "light";
      case "win32":
        return /AppsUseLightTheme\s+REG_DWORD\s+0x0\b/.test(read("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", "/v", "AppsUseLightTheme"])) ? "dark" : "light";
      default:
        return read("gsettings", ["get", "org.gnome.desktop.interface", "color-scheme"]).includes("dark") ? "dark" : "light";
    }
  } catch {
    return "light";
  }
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
      if (!(Number.isFinite(time) && time >= 0)) throw new Error(`Frame times must be finite and non-negative, got ${time}.`);
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
