/**
 * Measures what an SVG costs to download and to play, in Chrome driven by agent-browser (`agent-browser install`).
 *
 *   bun run perf hype flights               # examples/dist/hype.svg and flights.svg
 *   bun run perf --all                      # every SVG in dist
 *   bun run perf --base ../main/dist hype   # compare with the same files from another build
 *   bun run perf --throttle 4 --runs 3 hype # main thread 4x slower, median of three runs
 *   bun run perf --events hype              # also the ten costliest trace events
 *
 * Each SVG plays inline for --ms (default 3000) from each of --windows (default 4) points of its loop while DevTools
 * traces it. The table gives bytes (raw, gzip, brotli), the animations running per frame counted from the file
 * (cost.ts), and renderer main-thread ms per second of playback: style recalc (CSS animations), SMIL and paint.
 */
import { mkdtempSync, readdirSync, readFileSync, statSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import { costOf } from "./cost";

const { values: flags, positionals: names } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: "boolean" },
    events: { type: "boolean" },
    ms: { type: "string", default: "3000" },
    runs: { type: "string", default: "1" },
    windows: { type: "string", default: "4" },
    throttle: { type: "string", default: "1" },
    base: { type: "string" },
    dist: { type: "string" },
  },
});

const ms = Number(flags.ms);
const runs = Number(flags.runs);
const windows = Number(flags.windows);
const throttle = Number(flags.throttle);

const DIST = resolve(flags.dist ?? join(import.meta.dir, "..", "dist"));

const svgs = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const path = join(dir, f);

    return statSync(path).isDirectory() ? svgs(path) : path.endsWith(".svg") ? [path] : [];
  });

if (flags.all) names.push(...svgs(DIST).map((path) => relative(DIST, path).replace(/\.svg$/, "")));
else if (names.length === 0) names.push("hype");

const work = mkdtempSync(join(tmpdir(), "svjeez-perf-"));
const session = `svjeez-perf-${process.pid}`;

cpSync(join(import.meta.dir, "perf-page.html"), join(work, "bench.html"));

const run = (...cmd: string[]) => {
  const r = Bun.spawnSync(["agent-browser", "--session", session, "--allow-file-access", ...cmd]);

  if (r.exitCode !== 0)
    throw new Error(`agent-browser ${cmd[0]}: ${r.stderr.toString() || r.stdout.toString()}`);

  return r.stdout.toString();
};

interface TraceEvent {
  readonly ph?: string;
  readonly name: string;
  readonly pid: number;
  readonly tid: number;
  readonly ts: number;
  readonly dur?: number;
  readonly args: { readonly name?: string };
}

const CATEGORIES = "devtools.timeline,blink,toplevel,disabled-by-default-devtools.timeline";
const TASKS = new Set(["ThreadControllerImpl::RunTask", "RunTask"]);

const PHASES = new Map<string, "style" | "smil" | "paint">([
  ["UpdateLayoutTree", "style"],
  ["PageAnimator::serviceScriptedAnimations", "smil"],
  ["Paint", "paint"],
]);

/** Main-thread milliseconds per second of the renderer that drew the page: all of it, by phase, and the longest task. */
const summarize = (path: string) => {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const events: TraceEvent[] = parsed.traceEvents ?? parsed;
  const threads = new Map<string, string>();
  const busy = new Map<string, number>();

  for (const e of events)
    if (e.ph === "M" && e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, e.args.name!);

  for (const e of events) {
    const thread = `${e.pid}:${e.tid}`;

    if (e.dur && threads.get(thread) === "CrRendererMain")
      busy.set(thread, (busy.get(thread) ?? 0) + e.dur);
  }

  const main = [...busy].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sum = { main: 0, style: 0, smil: 0, paint: 0, worst: 0 };
  const byName: Record<string, number> = {};
  let first = Infinity;
  let last = 0;

  for (const e of events) {
    if (!e.dur || `${e.pid}:${e.tid}` !== main) continue;
    first = Math.min(first, e.ts);
    last = Math.max(last, e.ts + e.dur);

    if (TASKS.has(e.name)) {
      sum.main += e.dur;
      sum.worst = Math.max(sum.worst, e.dur);
    } else {
      byName[e.name] = (byName[e.name] ?? 0) + e.dur;

      const phase = PHASES.get(e.name);

      if (phase) sum[phase] += e.dur;
    }
  }

  const perSecond = (us: number) => us / 1000 / ((last - first) / 1e6);

  return {
    main: Math.round(perSecond(sum.main)),
    style: Math.round(perSecond(sum.style)),
    smil: Math.round(perSecond(sum.smil)),
    paint: Math.round(perSecond(sum.paint)),
    worst: Math.round(sum.worst / 100) / 10,
    byName: Object.fromEntries(Object.entries(byName).map(([k, v]) => [k, perSecond(v)])),
  };
};

const slowDown = async (rate: number) => {
  const browser = await chromium.connectOverCDP(run("get", "cdp-url").trim());

  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().includes("bench.html"));

  if (!page) throw new Error("perf: the bench page is not open");
  const cdp = await page.context().newCDPSession(page);
  const spins = async () => Number(await page.evaluate("spin()"));
  const before = await spins();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const slowed = before / (await spins());

  if (slowed < rate * 0.5)
    throw new Error(`perf: CPU throttling ${rate}x did not take effect (${slowed.toFixed(1)}x)`);

  return () => browser.close();
};

const KEYS = ["main", "style", "smil", "paint", "worst", "fps", "p95", "dropped"] as const;

type Metrics = Record<(typeof KEYS)[number], number>;

const combine = (rows: readonly Metrics[], how: (values: number[]) => number): Metrics =>
  // SAFETY: the entries are every key of Metrics, each with a number.
  Object.fromEntries(KEYS.map((key) => [key, how(rows.map((row) => row[key]))])) as Metrics;

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const worst = (values: number[]) => Math.max(...values);

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

const playOnce = async (file: string, tag: string) => {
  const copy = join(work, `${tag}-${basename(file)}`);
  cpSync(file, copy);
  run("open", `file://${join(work, "bench.html")}?svg=${basename(copy)}`);
  run("eval", "ready");
  const release = throttle > 1 ? await slowDown(throttle) : undefined;

  const parts = Array.from({ length: windows }, (_, k) => {
    run("eval", `from(${k / windows})`);
    run("eval", "frames()");
    const trace = join(work, `${tag}-${k}-${basename(file)}.json`);
    run("profiler", "start", "--categories", CATEGORIES);
    run("wait", String(ms));
    run("profiler", "stop", trace);

    // SAFETY: the page's frames() answers with a JSON string of these three numbers, wrapped once more by the CLI.
    const frames = JSON.parse(JSON.parse(run("eval", "frames()"))) as Record<
      "fps" | "p95" | "dropped",
      number
    >;

    return { ...summarize(trace), ...frames, dropped: frames.dropped * 100 };
  });

  await release?.();

  const peak = combine(parts, worst);

  return {
    ...combine(parts, mean),
    worst: peak.worst,
    p95: peak.p95,
    byName: Object.fromEntries(
      [...new Set(parts.flatMap((p) => Object.keys(p.byName)))].map((name) => [
        name,
        mean(parts.map((p) => p.byName[name] ?? 0)),
      ]),
    ),
  };
};

const measure = async (file: string, tag: string) => {
  const all: Awaited<ReturnType<typeof playOnce>>[] = [];

  for (let i = 0; i < runs; i++) all.push(await playOnce(file, tag));

  const text = readFileSync(file);
  const brotli = brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });

  return {
    ...combine(all, median),
    byName: all[Math.floor(runs / 2)]!.byName,
    running: costOf(text.toString()),
    raw: text.length / 1024,
    gzip: gzipSync(text).length / 1024,
    brotli: brotli.length / 1024,
  };
};

type Row = Awaited<ReturnType<typeof measure>>;

const delta = (now: number, was: number | undefined, unit = "") =>
  was === undefined || Math.abs(now - was) < 0.05 * Math.max(1, was)
    ? `${Math.round(now)}${unit}`
    : `${Math.round(now)}${unit} (${now < was ? "" : "+"}${Math.round(((now - was) / Math.max(was, 1e-9)) * 100)}%)`;

const change = (now: number, was: number | undefined, digits = 0) =>
  was === undefined ? now.toFixed(digits) : `${was.toFixed(digits)} → ${now.toFixed(digits)}`;

const rows = [
  [
    "svg",
    "anims/frame",
    "raw",
    "gzip",
    "brotli",
    "main ms/s",
    "style",
    "smil",
    "paint",
    "worst task ms",
    "fps",
    "p95 ms",
    "dropped %",
  ],
];

try {
  for (const name of names) {
    const file = join(DIST, `${name}.svg`);
    const against = flags.base ? join(resolve(flags.base), `${name}.svg`) : "";
    const now = await measure(file, "now");
    const was: Row | undefined = existsSync(against) ? await measure(against, "base") : undefined;

    rows.push([
      name,
      change(now.running, was?.running, 1).replace(/\.0\b/g, ""),
      ...(["raw", "gzip", "brotli"] as const).map((key) => delta(now[key], was?.[key], "K")),
      ...(["main", "style", "smil", "paint"] as const).map((key) => delta(now[key], was?.[key])),
      change(now.worst, was?.worst, 1),
      change(now.fps, was?.fps),
      change(now.p95, was?.p95),
      change(now.dropped, was?.dropped),
    ]);
    console.error(`measured ${name}`);

    if (flags.events)
      console.error(
        Object.entries(now.byName)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([event, perSecond]) => `  ${event.padEnd(40)} ${perSecond.toFixed(1)} ms/s`)
          .join("\n"),
      );
  }
} finally {
  Bun.spawnSync(["agent-browser", "--session", session, "close"]);
}

const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));

for (const row of rows)
  console.log(
    row.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join("  "),
  );
