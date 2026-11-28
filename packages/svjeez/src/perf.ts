import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { costOf } from "./svg/cost";
import { seek } from "./browser-seek";
import { loopLength } from "./page";
import { systemColorScheme } from "./scheme";
import { launch, size } from "./browser";
import type { ColorScheme } from "./frames";

export interface PerfOptions {
  /** How long each window plays, in milliseconds. Default 3000. */
  readonly ms?: number;
  /** How many windows, spread across the scene's duration. Default 4. */
  readonly windows?: number;
  readonly colorScheme?: ColorScheme | "system";
  /** The scene's length in seconds, when the caller knows it. Without it, read from the animations' periods. */
  readonly duration?: number;
  /** Whether the scene repeats. Without it, read from the animations. A scene that plays once keeps every window inside its length. */
  readonly loops?: boolean;
  /** CPU slowdown factor, 4 for a mid-range phone. Default 1. */
  readonly throttle?: number;
  readonly executablePath?: string;
}

export interface PerfWindow {
  /** Scene seconds the window starts and ends at. */
  readonly from: number;
  readonly to: number;
  readonly fps: number;
  /** The 95th-percentile gap between frames, in ms. */
  readonly p95: number;
  /** Share of 60 Hz frame slots missed, in percent. */
  readonly dropped: number;
  /** Main-thread ms per second, in total and split. */
  readonly main: number;
  readonly style: number;
  readonly smil: number;
  readonly paint: number;
  /** The longest main-thread task, in ms. */
  readonly worst: number;
}

export interface PerfReport {
  /** fps, dropped and main-thread time are means over the windows; p95 and worst task are the worst window's. */
  readonly fps: number;
  readonly p95: number;
  readonly dropped: number;
  readonly main: number;
  readonly style: number;
  readonly smil: number;
  readonly paint: number;
  readonly worst: number;
  /** Animations the browser runs per frame, a SMIL window counting for its share of the loop. */
  readonly animations: number;
  readonly duration: number;
  readonly loops: boolean;
  readonly colorScheme: ColorScheme;
  readonly size: { readonly raw: number; readonly gzip: number; readonly brotli: number };
  readonly windows: readonly PerfWindow[];
  /** The window with the lowest fps. */
  readonly slowest: PerfWindow;
  /** Main-thread ms per second by trace event, over all windows. */
  readonly events: Readonly<Record<string, number>>;
}

interface TraceEvent {
  readonly ph?: string;
  readonly name: string;
  readonly pid: number;
  readonly tid: number;
  readonly ts: number;
  readonly dur?: number;
  readonly args?: { readonly name?: string };
}

const CATEGORIES = [
  "devtools.timeline",
  "blink",
  "toplevel",
  "disabled-by-default-devtools.timeline",
];

const TASKS = ["ThreadControllerImpl::RunTask", "RunTask"];

const total = (events: readonly { readonly dur: number }[]): number =>
  events.reduce((sum, event) => sum + event.dur, 0);

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

interface MainThread {
  /** ms per second, by event name. */
  readonly byName: Readonly<Record<string, number>>;
  /** ms per second spent in tasks. */
  readonly main: number;
  /** The longest task, in ms. */
  readonly worst: number;
}

/** Main-thread time per second of trace, in total and by event name. */
export const mainThread = (events: readonly TraceEvent[]): MainThread => {
  const renderers = new Set(
    events.flatMap((e) =>
      e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain"
        ? [`${e.pid}:${e.tid}`]
        : [],
    ),
  );

  const threads = new Map<string, { ts: number; dur: number; name: string }[]>();

  for (const e of events) {
    if (!e.dur) continue;
    const key = `${e.pid}:${e.tid}`;

    if (renderers.has(key))
      threads.set(key, [...(threads.get(key) ?? []), { ts: e.ts, dur: e.dur, name: e.name }]);
  }

  const [main = []] = [...threads.values()].sort((a, b) => total(b) - total(a));

  const seconds =
    (main.reduce((last, e) => Math.max(last, e.ts + e.dur), 0) -
      main.reduce((first, e) => Math.min(first, e.ts), Infinity)) /
    1e6;

  if (!(seconds > 0)) return { byName: {}, main: 0, worst: 0 };

  const out: Record<string, number> = {};
  let worst = 0;
  let running = 0;

  for (const e of main) {
    if (TASKS.includes(e.name)) {
      running += e.dur;
      worst = Math.max(worst, e.dur);
    } else out[e.name] = (out[e.name] ?? 0) + e.dur / 1000 / seconds;
  }

  return { byName: out, main: running / 1000 / seconds, worst: worst / 1000 };
};

const page = (svg: string, colorScheme: ColorScheme): string =>
  `<!doctype html><style>:root{color-scheme:${colorScheme}}body{margin:0}</style><div id="host">${svg}</div>`;

/** Runs in the page: frame gaps from requestAnimationFrame, read and cleared per window. */
const install = (): void => {
  const stamps: number[] = [];

  const tick = (now: number): void => {
    stamps.push(now);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  Object.assign(window, {
    frames: () => {
      const gaps = stamps
        .slice(1)
        .map((t, i) => t - stamps[i]!)
        .sort((a, b) => a - b);

      stamps.length = 0;
      const sum = gaps.reduce((a, g) => a + g, 0);
      const slots = gaps.reduce((a, g) => a + Math.max(1, Math.round(g / (1000 / 60))), 0);

      return {
        fps: sum > 0 ? gaps.length / (sum / 1000) : 0,
        p95: gaps[Math.floor(gaps.length * 0.95)] ?? 0,
        dropped: slots > 0 ? 1 - gaps.length / slots : 100,
      };
    },
    spin: () => {
      const t = performance.now();
      let n = 0;

      while (performance.now() - t < 100) n++;

      return n;
    },
  });
};

const play = (): void => {
  for (const animation of document.getAnimations()) animation.play();
  document.querySelector("svg")?.unpauseAnimations();
};

const looping = (): boolean =>
  document.getAnimations().some((each) => each.effect?.getTiming().iterations === Infinity) ||
  [...document.querySelectorAll("animate, animateTransform, animateMotion, set")].some(
    (each) =>
      each.getAttribute("repeatCount") === "indefinite" ||
      (each.getAttribute("begin") ?? "").includes(".begin+"),
  );

/** Plays the scene in headless Chromium from several points across its duration and reports how smoothly it ran. */
export const measurePerf = async (svg: string, options: PerfOptions = {}): Promise<PerfReport> => {
  const ms = options.ms ?? 3000;
  const count = options.windows ?? 4;
  const throttle = options.throttle ?? 1;

  if (!(Number.isFinite(ms) && ms > 0))
    throw new Error(`measurePerf() needs a positive ms, got ${ms}.`);

  if (!(Number.isInteger(count) && count > 0))
    throw new Error(`measurePerf() needs a positive whole number of windows, got ${count}.`);

  if (!(Number.isFinite(throttle) && throttle >= 1))
    throw new Error(`measurePerf() needs a throttle of 1 or more, got ${throttle}.`);

  const { width, height } = size("measurePerf()", svg);

  const colorScheme =
    !options.colorScheme || options.colorScheme === "system"
      ? systemColorScheme()
      : options.colorScheme;

  const browser = await launch("measurePerf()", options.executablePath, true);

  try {
    const tab = await browser.newPage({
      // A viewport much smaller than this stops Chromium producing frames, which would read as a dead scene.
      viewport: {
        width: Math.max(400, Math.ceil(width)),
        height: Math.max(400, Math.ceil(height)),
      },
      colorScheme,
      reducedMotion: "no-preference",
    });

    await tab.route("https://svjeez.local/", (route) =>
      route.fulfill({ contentType: "text/html; charset=utf-8", body: page(svg, colorScheme) }),
    );

    await tab.goto("https://svjeez.local/");
    await tab.evaluate(() => document.fonts.ready);
    await tab.evaluate(install);

    const duration = options.duration ?? (await tab.evaluate(loopLength, undefined));
    const loops = options.loops ?? (await tab.evaluate(looping));

    if (throttle > 1) {
      const session = await tab.context().newCDPSession(tab);
      const before = await tab.evaluate("spin()").then(Number);

      await session.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      const slowed = before / Number(await tab.evaluate("spin()"));

      if (slowed < throttle * 0.5)
        throw new Error(`CPU throttling ${throttle}x did not take effect (${slowed.toFixed(1)}x).`);
    }

    const length = ms / 1000;
    // A scene that plays once holds its last frame; a window past the end would measure nothing.
    const room = loops ? duration : Math.max(0, duration - length);
    const windows: PerfWindow[] = [];
    const events: Record<string, number>[] = [];

    for (let k = 0; k < count; k++) {
      const from = (k / count) * room;

      await tab.evaluate(seek, from);
      await tab.evaluate(play);
      await tab.evaluate("frames()");
      await browser.startTracing(tab, { categories: CATEGORIES });
      await tab.waitForTimeout(ms);
      const trace = JSON.parse((await browser.stopTracing()).toString());
      const frames = await tab.evaluate<{ fps: number; p95: number; dropped: number }>("frames()");

      const { byName, main, worst } = mainThread(Array.isArray(trace) ? trace : trace.traceEvents);

      events.push(byName);

      windows.push({
        from,
        to: from + length,
        fps: frames.fps,
        p95: frames.p95,
        dropped: frames.dropped * 100,
        main,
        style: byName["UpdateLayoutTree"] ?? 0,
        smil: byName["PageAnimator::serviceScriptedAnimations"] ?? 0,
        paint: byName["Paint"] ?? 0,
        worst,
      });
    }

    const average = (pick: (w: PerfWindow) => number) => mean(windows.map(pick));
    const [slowest] = [...windows].sort((a, b) => a.fps - b.fps);
    const names = new Set(events.flatMap((byName) => Object.keys(byName)));

    const bytes = Buffer.from(svg);

    return {
      fps: average((w) => w.fps),
      p95: Math.max(...windows.map((w) => w.p95)),
      dropped: average((w) => w.dropped),
      main: average((w) => w.main),
      style: average((w) => w.style),
      smil: average((w) => w.smil),
      paint: average((w) => w.paint),
      worst: Math.max(...windows.map((w) => w.worst)),
      animations: costOf(svg).animations,
      duration,
      loops,
      colorScheme,
      size: {
        raw: bytes.length,
        gzip: gzipSync(bytes).length,
        brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
          .length,
      },
      windows,
      slowest: slowest!,
      events: Object.fromEntries(
        [...names].map((name) => [name, mean(events.map((byName) => byName[name] ?? 0))]),
      ),
    };
  } finally {
    await browser.close();
  }
};

const rounded = (value: number, digits = 0): string => value.toFixed(digits);

const range = (window: PerfWindow): string =>
  `${Number(window.from.toFixed(2))}s to ${Number(window.to.toFixed(2))}s`;

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)}K`;

/** The summary `svjeez perf` prints. */
export const formatPerf = (report: PerfReport): string =>
  [
    `${rounded(report.fps)} fps, p95 frame ${rounded(report.p95, 1)} ms, ${rounded(report.dropped)}% dropped`,
    `${rounded(report.animations, 1)} animations per frame`,
    `main thread ${rounded(report.main)} ms/s (style ${rounded(report.style)}, smil ${rounded(report.smil)}, paint ${rounded(report.paint)}), worst task ${rounded(report.worst, 1)} ms`,
    `size ${kb(report.size.raw)} raw, ${kb(report.size.gzip)} gzip, ${kb(report.size.brotli)} brotli`,
    `slowest window ${range(report.slowest)}: ${rounded(report.slowest.fps)} fps, p95 ${rounded(report.slowest.p95, 1)} ms, ${rounded(report.slowest.dropped)}% dropped`,
    `${report.windows.length} windows over ${Number(report.duration.toFixed(2))}s, ${report.loops ? "looping" : "plays once"}, ${report.colorScheme}`,
  ].join("\n");
