import type { Seconds } from "./motion";
import { loopLength, seek } from "./page";
import { systemColorScheme } from "./scheme";

export type ColorScheme = "light" | "dark";

/** When to capture: exact playback times, or `count` frames spread evenly over one loop. */
export type FrameTimes =
  | { readonly times: readonly Seconds[]; readonly count?: never }
  | { readonly count: number; readonly times?: never };

export interface SceneOptions {
  /** Device pixel ratio. Default 1. */
  readonly scale?: number;
  /** Which side of `prefers-color-scheme` to render. Default "system", this machine's appearance setting. */
  readonly colorScheme?: ColorScheme | "system";
  /** CSS background behind the SVG. Default `Canvas`, the scheme's page color. Pass "transparent" for alpha. */
  readonly background?: string;
  /** A Chromium or Chrome binary to use instead of Playwright's own. */
  readonly executablePath?: string;
}

export type FrameOptions = FrameTimes &
  SceneOptions & {
    /** Also lay the frames out on one labelled contact sheet. */
    readonly sheet?: boolean | { readonly columns?: number };
  };

/** An SVG open in headless Chromium, paused, ready to capture at any playback time. Close it when done. */
export interface Scene {
  /** The SVG's size in CSS pixels. Captures are `scale` times larger. */
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  /** The longest animation in the SVG, in playback seconds: one loop of the scene. */
  readonly duration: Seconds;
  /** The scheme the scene renders in, after resolving "system". */
  readonly colorScheme: ColorScheme;
  /** Seek every animation to `time` and return a PNG of the SVG. */
  capture(time: Seconds): Promise<Uint8Array>;
  /** Run `fn` in the page. It is serialized, so it can use only `arg` and the page's globals. */
  evaluate<A, R>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  /** Load a classic script file into the page. */
  addScript(path: string): Promise<void>;
  close(): Promise<void>;
}

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

const launch = async (caller: string, executablePath?: string) => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error(
      `${caller} needs playwright-core. Install it with \`npm i -D playwright-core\`, then \`npx playwright-core install chromium-headless-shell\`.`,
    );
  });

  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;

    return chromium.launch({ channel: "chrome" }).catch(() => {
      throw new Error(
        `No Chromium to render with. Run \`npx playwright-core install chromium-headless-shell\`, or pass executablePath.\n${error instanceof Error ? error.message : error}`,
      );
    });
  }
};

const size = (caller: string, svg: string) => {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = parseFloat(/\swidth="([\d.]+)"/.exec(root)?.[1] ?? "");
  const height = parseFloat(/\sheight="([\d.]+)"/.exec(root)?.[1] ?? "");

  if (!(width > 0 && height > 0))
    throw new Error(
      `${caller} needs an <svg> root with numeric width and height, got ${width} by ${height}.`,
    );

  return { width, height };
};

// Chromium cannot capture past 16384 device pixels on a side, so a big sheet renders at a lower scale.
const MAX_CAPTURE = 16000;
const GAP = 12;
const CAPTION = 20;

const label = (time: Seconds): string => `${Number(time.toFixed(3))}s`;

const sheetHtml = (
  frames: readonly Frame[],
  width: number,
  columns: number,
): string => `<!doctype html>
<style>
  :root { color-scheme: light dark; background: Canvas; font: 12px ui-monospace, Menlo, monospace }
  body { margin: 0; padding: ${GAP}px; display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: ${GAP}px; width: max-content }
  figure { margin: 0 } img { display: block; width: ${width}px; outline: 1px solid GrayText } figcaption { height: ${CAPTION - 4}px; padding-top: 4px }
</style>
${frames.map((frame) => `<figure><img src="data:image/png;base64,${Buffer.from(frame.png).toString("base64")}"><figcaption>t = ${label(frame.time)}</figcaption></figure>`).join("\n")}`;

const isSheetOptions = (sheet: FrameOptions["sheet"]): sheet is { readonly columns?: number } =>
  typeof sheet === "object";

type Browser = Awaited<ReturnType<typeof launch>>;

type Stage = Pick<Scene, "width" | "height" | "scale" | "colorScheme"> & {
  readonly background: string;
};

/** Validates what every caller shares, before any browser starts, so a bad option fails fast. */
const resolve = (caller: string, svg: string, options: SceneOptions): Stage => {
  const { width, height } = size(caller, svg);
  const scale = options.scale ?? 1;

  if (!(scale > 0 && Number.isFinite(scale)))
    throw new Error(`${caller} needs a positive, finite scale, got ${scale}.`);

  const colorScheme =
    !options.colorScheme || options.colorScheme === "system"
      ? systemColorScheme()
      : options.colorScheme;

  if (colorScheme !== "light" && colorScheme !== "dark")
    throw new Error(`${caller} needs a colorScheme of system, light or dark, got ${colorScheme}.`);

  return {
    width,
    height,
    scale,
    colorScheme,
    background: options.background ?? "Canvas",
  };
};

// WebCodecs, which @svjeez/video encodes with, exists only in a secure context, and about:blank is not one.
const ORIGIN = "https://svjeez.local/";

const stage = async (
  browser: Browser,
  svg: string,
  { width, height, scale, colorScheme, background }: Stage,
): Promise<Omit<Scene, "close">> => {
  const page = await browser.newPage({
    viewport: { width: Math.ceil(width), height: Math.ceil(height) },
    deviceScaleFactor: scale,
    colorScheme,
    reducedMotion: "no-preference",
  });

  const html = `<!doctype html><style>:root{color-scheme:${colorScheme}}body{margin:0}#stage{display:inline-block;line-height:0;background:${background}}</style><div id="stage">${svg}</div>`;

  await page.route(ORIGIN, (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: html }),
  );
  await page.goto(ORIGIN);
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(loopLength, undefined);
  const locator = page.locator("#stage");

  return {
    width,
    height,
    scale,
    colorScheme,
    duration,
    capture: async (time) => {
      await page.evaluate(seek, time);

      return new Uint8Array(
        await locator.screenshot({ animations: "allow", omitBackground: true }),
      );
    },
    // SAFETY: Playwright types the argument as Unboxed<A>, which is A itself for the plain data a Scene passes.
    evaluate: <A, R>(fn: (arg: A) => R | Promise<R>, arg: A) =>
      page.evaluate<R, A>(fn as Parameters<typeof page.evaluate<R, A>>[0], arg),
    addScript: async (path) => {
      await page.addScriptTag({ path });
    },
  };
};

/**
 * Open an SVG in headless Chromium, paused at its start, for capturing frames one at a time.
 * Needs `playwright-core` and a Chromium build. `caller` names the function errors report.
 */
export const openScene = async (
  svg: string,
  options: SceneOptions = {},
  caller = "openScene()",
): Promise<Scene> => {
  const settings = resolve(caller, svg, options);
  const browser = await launch(caller, options.executablePath);

  try {
    return { ...(await stage(browser, svg, settings)), close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
};

/** Rasterize an SVG at chosen playback times in headless Chromium. Needs `playwright-core` and a Chromium build. */
export const renderFrames = async (svg: string, options: FrameOptions): Promise<Frames> => {
  const settings = resolve("renderFrames()", svg, options);

  if (options.times !== undefined) {
    for (const time of options.times)
      if (!(Number.isFinite(time) && time >= 0))
        throw new Error(`renderFrames() needs finite, non-negative times, got ${time}.`);
  } else if (!(Number.isInteger(options.count) && options.count > 0)) {
    throw new Error(`renderFrames() needs a positive whole count, got ${options.count}.`);
  }

  const columns = isSheetOptions(options.sheet) ? options.sheet.columns : undefined;

  if (columns !== undefined && !(Number.isInteger(columns) && columns > 0))
    throw new Error(
      `renderFrames() needs a positive whole number of sheet columns, got ${columns}.`,
    );
  const browser = await launch("renderFrames()", options.executablePath);

  try {
    const { duration, colorScheme, capture } = await stage(browser, svg, settings);

    const times =
      options.times ??
      Array.from({ length: options.count }, (_, i) => (i * duration) / options.count);

    const frames: Frame[] = [];

    for (const time of times) frames.push({ time, png: await capture(time) });

    if (!options.sheet) return { duration, colorScheme, frames };
    const across = Math.min(columns ?? 4, frames.length);
    const { width, height, scale } = settings;

    const sheetSize = Math.max(
      across * (width + GAP) + GAP,
      Math.ceil(frames.length / across) * (height + GAP + CAPTION) + GAP,
    );

    const sheetPage = await browser.newPage({
      viewport: { width: 1, height: 1 },
      deviceScaleFactor: Math.min(scale, MAX_CAPTURE / sheetSize),
      colorScheme,
    });

    await sheetPage.setContent(sheetHtml(frames, width, across));
    const sheet = new Uint8Array(await sheetPage.locator("body").screenshot());

    return { duration, colorScheme, frames, sheet };
  } finally {
    await browser.close();
  }
};
