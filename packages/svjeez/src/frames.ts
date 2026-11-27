import type { Seconds } from "./model/time";
import { loopLength, seek } from "./page";
import { rateOf } from "./svg/rate";
import { systemColorScheme } from "./scheme";
import { hostOf } from "./host";

export { costOf, type Cost } from "./svg/cost";

export { validateSvg, type ValidationResult } from "./svg/validate";

export {
  measurePerf,
  formatPerf,
  type PerfOptions,
  type PerfReport,
  type PerfWindow,
} from "./perf";

export { checkPixels, type CheckOptions, type PixelReport } from "./check/check";

export type ColorScheme = "light" | "dark";

export type FrameTimes =
  | { readonly times: readonly Seconds[]; readonly count?: never }
  | { readonly count: number; readonly times?: never };

export interface SceneOptions {
  readonly scale?: number;
  readonly colorScheme?: ColorScheme | "system";
  readonly background?: string;
  readonly executablePath?: string;
  /** The scene's length in seconds, when the caller knows it. Without it the length is read from the animations' periods, which can be shorter than the scene (a `duration: 8` scene whose tracks all `.loop(4)` measures 4s). */
  readonly duration?: Seconds;
  /** How many tabs capture in parallel, each holding its own copy of the scene. Default 1. */
  readonly pages?: number;
}

/** How `Scene.capture` encodes: full-compression PNG, a quicker PNG, or JPEG (no alpha). */
export type CaptureEncoding = "png" | "fast-png" | "jpeg";

export type FrameOptions = FrameTimes &
  SceneOptions & {
    readonly sheet?: boolean | { readonly columns?: number };
  };

export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly duration: Seconds;
  /** Whether the scene repeats. When it plays once, `duration` is its length and the last frame is held. */
  readonly loops: boolean;
  readonly playbackRate: number;
  readonly colorScheme: ColorScheme;
  /** Captures the scene at `time`. With `pages` above 1, calls run in parallel, one per idle tab. */
  capture(time: Seconds, encoding?: CaptureEncoding): Promise<Uint8Array>;
  /** Runs in the first tab only. */
  evaluate<A, R>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  /** Loads the script in the first tab only. */
  addScript(path: string): Promise<void>;
  close(): Promise<void>;
}

export interface Frame {
  readonly time: Seconds;
  readonly png: Uint8Array;
}

export interface Frames {
  readonly colorScheme: ColorScheme;
  readonly duration: Seconds;
  readonly loops: boolean;
  readonly frames: readonly Frame[];
  readonly sheet?: Uint8Array;
}

/** `full` prefers a full Chrome or Chromium over the headless shell, which composites in software and so misjudges playback. */
export const launch = async (caller: string, executablePath?: string, full = false) => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error(
      `${caller} needs playwright-core. Install it with \`npm i -D playwright-core\`, then \`npx playwright-core install chromium-headless-shell\`.`,
    );
  });

  if (full && !executablePath)
    for (const channel of ["chrome", "chromium"])
      try {
        return await chromium.launch({ channel });
      } catch {
        // Not installed: try the next one.
      }

  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;

    return chromium.launch({ channel: "chrome" }).catch(() => {
      throw new Error(
        `No Chromium to render with. Run \`${hostOf().installBrowser ?? "npx playwright-core install chromium-headless-shell"}\`, or pass executablePath.\n${error instanceof Error ? error.message : error}`,
      );
    });
  }
};

export const size = (caller: string, svg: string) => {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = parseFloat(/\swidth="([\d.]+)"/.exec(root)?.[1] ?? "");
  const height = parseFloat(/\sheight="([\d.]+)"/.exec(root)?.[1] ?? "");

  if (!(width > 0 && height > 0))
    throw new Error(
      `${caller} needs an <svg> root with numeric width and height, got ${width} by ${height}.`,
    );

  return { width, height };
};

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

type Stage = Pick<Scene, "width" | "height" | "scale" | "colorScheme" | "playbackRate"> & {
  readonly background: string;
  readonly duration: Seconds | undefined;
};

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
    playbackRate: rateOf(svg),
    background: options.background ?? "Canvas",
    duration: options.duration,
  };
};

const ORIGIN = "https://svjeez.local/";

const stage = async (
  browser: Browser,
  svg: string,
  { width, height, scale, colorScheme, playbackRate, background, duration: given }: Stage,
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
  const duration = given ?? (await page.evaluate(loopLength, undefined));

  const loops = await page.evaluate(
    () =>
      document.getAnimations().some((each) => each.effect?.getTiming().iterations === Infinity) ||
      [...document.querySelectorAll("animate, animateTransform, animateMotion, set")].some(
        (each) =>
          each.getAttribute("repeatCount") === "indefinite" ||
          (each.getAttribute("begin") ?? "").includes(".begin+"),
      ),
  );

  const session = await page.context().newCDPSession(page);

  await session.send("Emulation.setDefaultBackgroundColorOverride", {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });

  const box = await page.evaluate(() => {
    const { x, y, width, height } = document.getElementById("stage")!.getBoundingClientRect();

    return { x, y, width, height };
  });

  // The clip's scale is the device pixel ratio: CDP captures in CSS pixels otherwise.
  const clip = { ...box, scale };

  return {
    width,
    height,
    scale,
    colorScheme,
    duration,
    loops,
    playbackRate,
    capture: async (time, encoding = "png") => {
      await page.evaluate(seek, time);

      const { data } = await session.send("Page.captureScreenshot", {
        format: encoding === "jpeg" ? "jpeg" : "png",
        ...(encoding === "jpeg" && { quality: 92 }),
        ...(encoding !== "png" && { optimizeForSpeed: true }),
        clip,
        captureBeyondViewport: false,
        fromSurface: true,
      });

      return new Uint8Array(Buffer.from(data, "base64"));
    },
    // SAFETY: Playwright types the argument as Unboxed<A>, which is A itself for the plain data a Scene passes.
    evaluate: <A, R>(fn: (arg: A) => R | Promise<R>, arg: A) =>
      page.evaluate<R, A>(fn as Parameters<typeof page.evaluate<R, A>>[0], arg),
    addScript: async (path) => {
      await page.addScriptTag({ path });
    },
  };
};

const pooled = (
  first: Omit<Scene, "close">,
  ...rest: Omit<Scene, "close">[]
): Omit<Scene, "close"> => {
  const idle = [first, ...rest];
  const waiting: ((page: Omit<Scene, "close">) => void)[] = [];

  const take = () =>
    idle.pop() ?? new Promise<Omit<Scene, "close">>((resolve) => waiting.push(resolve));

  const give = (page: Omit<Scene, "close">) => {
    const next = waiting.shift();

    if (next) next(page);
    else idle.push(page);
  };

  return {
    ...first,
    capture: async (time, encoding) => {
      const page = await take();

      try {
        return await page.capture(time, encoding);
      } finally {
        give(page);
      }
    },
  };
};

export const openScene = async (
  svg: string,
  options: SceneOptions = {},
  caller = "openScene()",
): Promise<Scene> => {
  const settings = resolve(caller, svg, options);
  const pages = options.pages ?? 1;

  if (!(Number.isInteger(pages) && pages > 0))
    throw new Error(`${caller} needs a positive whole number of pages, got ${pages}.`);
  const browser = await launch(caller, options.executablePath);

  try {
    const [first, ...rest] = await Promise.all(
      Array.from({ length: pages }, () => stage(browser, svg, settings)),
    );

    return { ...pooled(first!, ...rest), close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
};

export const renderFrames = async (svg: string, options: FrameOptions): Promise<Frames> => {
  const settings = resolve("renderFrames()", svg, options);

  if (options.times !== undefined) {
    if (options.times.length === 0)
      throw new Error("renderFrames() needs at least one time, got an empty list.");

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
    const { duration, loops, colorScheme, capture } = await stage(browser, svg, settings);

    const spread =
      loops || options.times !== undefined ? undefined : Math.max(1, options.count - 1);

    const times =
      options.times ??
      Array.from({ length: options.count }, (_, i) =>
        spread === undefined ? (i * duration) / options.count : (i * duration) / spread,
      );

    const frames: Frame[] = [];

    for (const time of times) frames.push({ time, png: await capture(time) });

    if (!options.sheet) return { duration, loops, colorScheme, frames };
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

    return { duration, loops, colorScheme, frames, sheet };
  } finally {
    await browser.close();
  }
};
