import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { loopLength, seek } from "../src/page";

const ROOT = join(import.meta.dir, "..");
const [file, flag, out] = process.argv.slice(2);
if (!file || (flag !== undefined && flag !== "--out")) {
  console.error("usage: bun run dev <file.tsx> [--out file.svg]");
  process.exit(1);
}
const source = resolve(file);
const target = resolve(out ?? join(ROOT, ".preview", `${basename(source, extname(source))}.svg`));
await mkdir(dirname(target), { recursive: true });

let state: { version: number; error?: string } = { version: 0 };
const clients = new Set<ReadableStreamDefaultController>();

// A fresh process per build, so edits to anything the module imports are picked up.
// One build at a time; a change during a build queues exactly one more.
let building: Promise<void> | undefined;
let again = false;
const build = async (): Promise<void> => {
  if (building) {
    again = true;
    return building;
  }
  building = once();
  await building;
  building = undefined;
  if (again) {
    again = false;
    await build();
  }
};

const once = async (): Promise<void> => {
  const child = Bun.spawn([process.execPath, join(ROOT, "src/cli.ts"), "svg", source, "--out", target], { cwd: ROOT, stderr: "pipe" });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  state = { version: state.version + 1, error: code === 0 ? undefined : stderr.trim() };
  console.log(code === 0 ? `✓ ${target}${stderr ? `\n${stderr.trim()}` : ""}` : `✗ ${stderr.trim()}`);
  for (const client of clients) client.enqueue(`data: ${state.version}\n\n`);
};

let pending: Timer | undefined;
const rebuild = (_event: string, name: string | null): void => {
  if (name && /\.svg$|(^|\/)\./.test(name)) return;
  clearTimeout(pending);
  pending = setTimeout(build, 60);
};
for (const dir of new Set([dirname(source), join(ROOT, "src")])) watch(dir, { recursive: true }, rebuild);
await build();

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>${basename(source)}</title>
<style>
  :root { color-scheme: light dark; font: 13px ui-monospace, Menlo, monospace }
  body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 16px; background: Canvas }
  #controls { display: flex; gap: 12px; align-items: center }
  #scrub { flex: 1 }
  #error { white-space: pre-wrap; color: #e5484d; max-width: 80ch }
</style>
<div id="stage"></div>
<div id="controls"><button id="toggle">pause</button><input id="scrub" type="range" min="0" step="0.01" value="0"><span id="clock"></span></div>
<pre id="error"></pre>
<script>
  const seek = ${seek.toString()};
  const loopLength = ${loopLength.toString()};
  const [stage, toggle, scrub, clock, error] = ["stage", "toggle", "scrub", "clock", "error"].map((id) => document.getElementById(id));
  let duration = 1, time = 0, playing = true, last = performance.now();
  const show = () => { scrub.value = time; clock.textContent = time.toFixed(2) + "s / " + duration.toFixed(2) + "s"; };
  const frame = (now) => {
    if (playing) { time = (time + (now - last) / 1000) % duration; show(); }
    last = now;
    requestAnimationFrame(frame);
  };
  const play = () => {
    playing = true; toggle.textContent = "pause";
    seek(time);
    for (const animation of document.getAnimations()) animation.play();
    for (const svg of document.querySelectorAll("svg")) svg.unpauseAnimations();
  };
  const pause = () => { playing = false; toggle.textContent = "play"; seek(time); };
  toggle.onclick = () => (playing ? pause() : play());
  scrub.oninput = () => { time = Number(scrub.value); pause(); show(); };
  const load = async () => {
    const response = await fetch("/state");
    const { error: message } = await response.json();
    error.textContent = message ?? "";
    if (message) return;
    stage.innerHTML = await (await fetch("/svg")).text();
    duration = loopLength() || 1;
    scrub.max = duration;
    time %= duration;
    playing ? play() : pause();
    show();
  };
  new EventSource("/events").onmessage = load;
  load();
  requestAnimationFrame(frame);
</script>`;

const server = Bun.serve({
  port: Number(process.env.PORT ?? 5173),
  idleTimeout: 0,
  routes: {
    "/": new Response(PAGE, { headers: { "content-type": "text/html" } }),
    "/state": () => Response.json(state),
    "/svg": () => new Response(Bun.file(target), { headers: { "content-type": "image/svg+xml", "cache-control": "no-store" } }),
    "/events": (request) =>
      new Response(
        new ReadableStream({
          start(controller) {
            clients.add(controller);
            request.signal.addEventListener("abort", () => clients.delete(controller));
          },
        }),
        { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } },
      ),
  },
});
console.log(`previewing ${source} at ${server.url}`);
