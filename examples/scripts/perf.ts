/**
 * Measures what an SVG costs to download and to play, in a real Chrome driven by agent-browser.
 *
 *   bun run perf hype flights            # examples/dist/hype.svg and flights.svg
 *   bun run perf --all                   # every SVG in examples/dist
 *   bun run perf --base ../main/dist hype  # compare against another build of the same files
 *   bun run perf --runs 3 hype            # keep each phase's lowest of three runs, to damp noise
 *
 * Each SVG plays inline for --ms (default 3000) while a DevTools trace records, from each of --windows (default 4)
 * points spread evenly over its loop, so a scene that is busy only late in the loop still counts. The table reports bytes (raw, gzip, brotli) and renderer main-thread time per second of playback, split into
 * style recalc (CSS animations), SMIL and paint. Needs agent-browser on PATH and its Chrome (`agent-browser install`).
 */
import { mkdtempSync, readdirSync, readFileSync, statSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const args = process.argv.slice(2);

const flag = (name: string) => {
  const i = args.indexOf(name);

  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);

  return value;
};

const all = args.includes("--all") && args.splice(args.indexOf("--all"), 1).length > 0;
const ms = Number(flag("--ms") ?? 3000);
const runs = Number(flag("--runs") ?? 1);
const windows = Number(flag("--windows") ?? 4);
const baseDir = flag("--base");
const DIST = resolve(flag("--dist") ?? join(import.meta.dir, "..", "dist"));

const svgs = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);

    return statSync(p).isDirectory() ? svgs(p) : p.endsWith(".svg") ? [p] : [];
  });

const names = all
  ? svgs(DIST).map((p) => relative(DIST, p).replace(/\.svg$/, ""))
  : args.length > 0
    ? args
    : ["hype"];

const work = mkdtempSync(join(tmpdir(), "svjeez-perf-"));
const session = `svjeez-perf-${process.pid}`;

await Bun.write(
  join(work, "bench.html"),
  `<!doctype html><body style="margin:0"><div id="host"></div><script>
window.ready = fetch(new URLSearchParams(location.search).get("svg")).then((r) => r.text()).then((text) => {
  document.getElementById("host").innerHTML = text;
  const svg = document.querySelector("#host svg");
  const smil = [...svg.querySelectorAll("animate, set, animateTransform, animateMotion")].map(
    (a) => parseFloat(a.getAttribute("data-loop") ?? a.getAttribute("dur") ?? "0") * 1000,
  );
  const css = document.getAnimations().map((a) => Number(a.effect.getTiming().duration) || 0);
  window.loop = Math.max(1, ...smil, ...css);
});
/** Seek CSS and SMIL to \`share\` of the loop and play on from there. */
window.from = (share) => {
  const svg = document.querySelector("#host svg");
  const t = share * window.loop;
  svg.pauseAnimations();
  svg.setCurrentTime(t / 1000);
  for (const a of document.getAnimations()) a.currentTime = t;
  svg.unpauseAnimations();
  return t;
};
</script></body>`,
);

const run = (...cmd: string[]) => {
  const r = Bun.spawnSync(["agent-browser", "--session", session, "--allow-file-access", ...cmd]);

  if (r.exitCode !== 0) throw new Error(`agent-browser ${cmd[0]}: ${r.stderr.toString() || r.stdout.toString()}`);

  return r.stdout.toString();
};

const CATEGORIES = "devtools.timeline,blink,toplevel,disabled-by-default-devtools.timeline";

/** Main-thread milliseconds per second of the renderer that drew the page, split by phase. */
const summarize = (path: string) => {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const events: any[] = raw.traceEvents ?? raw;
  const names = new Map<string, string>();

  for (const e of events) if (e.ph === "M" && e.name === "thread_name") names.set(`${e.pid}:${e.tid}`, e.args.name);
  const busy = new Map<string, number>();

  for (const e of events)
    if (e.dur && names.get(`${e.pid}:${e.tid}`) === "CrRendererMain")
      busy.set(`${e.pid}:${e.tid}`, (busy.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur);
  const main = [...busy].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sum = { task: 0, style: 0, smil: 0, paint: 0, worst: 0 };
  let first = Infinity;
  let last = 0;

  for (const e of events) {
    if (!e.dur || `${e.pid}:${e.tid}` !== main) continue;
    first = Math.min(first, e.ts);
    last = Math.max(last, e.ts + e.dur);

    if (e.name === "ThreadControllerImpl::RunTask" || e.name === "RunTask") {
      sum.task += e.dur;
      sum.worst = Math.max(sum.worst, e.dur);
    }
    else if (e.name === "UpdateLayoutTree") sum.style += e.dur;
    else if (e.name === "PageAnimator::serviceScriptedAnimations") sum.smil += e.dur;
    else if (e.name === "Paint") sum.paint += e.dur;
  }

  const seconds = (last - first) / 1e6;
  const per = (us: number) => Math.round(us / 1000 / seconds);

  return {
    main: per(sum.task),
    style: per(sum.style),
    smil: per(sum.smil),
    paint: per(sum.paint),
    worst: Math.round(sum.worst / 100) / 10,
  };
};

const measureOnce = (file: string, tag: string) => {
  const copy = join(work, `${tag}-${basename(file)}`);
  cpSync(file, copy);
  const text = readFileSync(file);
  run("open", `file://${join(work, "bench.html")}?svg=${basename(copy)}`);
  run("eval", "ready");

  const parts = Array.from({ length: windows }, (_, k) => {
    run("eval", `from(${k / windows})`);
    const trace = join(work, `${tag}-${k}-${basename(file)}.json`);
    run("profiler", "start", "--categories", CATEGORIES);
    run("wait", String(ms));
    run("profiler", "stop", trace);

    return summarize(trace);
  });

  const mean = (key: keyof (typeof parts)[number]) => parts.reduce((a, p) => a + p[key], 0) / parts.length;

  return {
    kb: text.length / 1024,
    gz: gzipSync(text).length / 1024,
    br: brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length / 1024,
    main: mean("main"),
    style: mean("style"),
    smil: mean("smil"),
    paint: mean("paint"),
    worst: Math.max(...parts.map((p) => p.worst)),
  };
};

/** Each number's lowest over `runs` runs: background work only ever adds time. */
const measure = (file: string, tag: string) => {
  const all = Array.from({ length: runs }, () => measureOnce(file, tag));

  // SAFETY: every row has the same numeric keys, so each key indexes a number and the entries rebuild a row.
  return Object.fromEntries(
    Object.keys(all[0]!).map((key) => [key, Math.min(...all.map((row) => row[key as keyof typeof row]))]),
  ) as ReturnType<typeof measureOnce>;
};

type Row = ReturnType<typeof measure>;

const cell = (now: number, was: number | undefined, unit = "") =>
  was === undefined || Math.abs(now - was) < 0.05 * Math.max(1, was)
    ? `${Math.round(now)}${unit}`
    : `${Math.round(now)}${unit} (${now < was ? "" : "+"}${Math.round(((now - was) / Math.max(was, 1e-9)) * 100)}%)`;

const rows: string[][] = [["svg", "raw", "gzip", "brotli", "main ms/s", "style", "smil", "paint", "worst task ms"]];

try {
  for (const name of names) {
    const file = join(DIST, `${name}.svg`);
    const now = measure(file, "now");
    const baseFile = baseDir ? join(resolve(baseDir), `${name}.svg`) : undefined;
    const was: Partial<Row> = baseFile && existsSync(baseFile) ? measure(baseFile, "base") : {};
    rows.push([
      name,
      cell(now.kb, was.kb, "K"),
      cell(now.gz, was.gz, "K"),
      cell(now.br, was.br, "K"),
      cell(now.main, was.main),
      cell(now.style, was.style),
      cell(now.smil, was.smil),
      cell(now.paint, was.paint),
      was.worst === undefined ? String(now.worst) : `${was.worst} → ${now.worst}`,
    ]);
    console.error(`measured ${name}`);
  }
} finally {
  Bun.spawnSync(["agent-browser", "--session", session, "close"]);
}

const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));

for (const r of rows) console.log(r.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join("  "));
