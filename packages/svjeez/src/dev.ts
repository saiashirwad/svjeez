import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { loopLength, seek } from "./page";

export interface DevOptions {
  readonly file: string;
  readonly cli: string;
  readonly args?: readonly string[];
  readonly files?: readonly string[];
  readonly dirs?: readonly string[];
  readonly port?: number;
  readonly out?: string;
}

interface Build {
  readonly version: number;
  readonly error?: string;
}

const page = (title: string) => `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
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

const buildOnce = (cli: string, file: string, args: readonly string[]) =>
  new Promise<{ svg?: string; log: string }>((done) => {
    const child = spawn(process.execPath, [...process.execArgv, cli, "svg", file, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => done({ log: error.message }));
    child.on("close", (code) => {
      const log = Buffer.concat(err).toString("utf8").trim();

      done(
        code === 0
          ? { svg: Buffer.concat(out).toString("utf8"), log }
          : { log: log || `exited with ${code}` },
      );
    });
  });

const IGNORED = /(^|[\\/])(node_modules|\.[^\\/]*)([\\/]|$)|\.svg$/;

export const dev = async (options: DevOptions): Promise<string> => {
  const source = resolve(options.file);
  const out = options.out === undefined ? undefined : resolve(options.out);
  const args = options.args ?? [];
  const clients = new Set<ServerResponse>();
  let state: Build = { version: 0 };
  let svg = "";

  const once = async () => {
    const built = await buildOnce(options.cli, source, args);

    if (built.svg !== undefined) {
      svg = built.svg;

      if (out) await writeFile(out, svg);
    }

    state = { version: state.version + 1, ...(built.svg === undefined && { error: built.log }) };
    console.log(
      built.svg === undefined
        ? `✗ ${built.log}`
        : `✓ ${basename(source)} (${(svg.length / 1024).toFixed(1)} KB)${built.log ? `\n${built.log}` : ""}`,
    );

    for (const client of clients) client.write(`data: ${state.version}\n\n`);
  };

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

  let pending: ReturnType<typeof setTimeout> | undefined;

  const rebuild = (name: string | Buffer | null) => {
    if (name && IGNORED.test(String(name))) return;
    clearTimeout(pending);
    pending = setTimeout(() => void build(), 60);
  };

  for (const dir of new Set([dirname(source), ...(options.dirs ?? [])].map((d) => resolve(d))))
    watch(dir, { recursive: true }, (_event, name) => rebuild(name));

  for (const extra of options.files ?? []) {
    const path = resolve(extra);
    watch(dirname(path), (_event, name) => name === basename(path) && rebuild(null));
  }

  await build();

  const html = page(basename(source));

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const headers = { "cache-control": "no-store" };

    switch (path) {
      case "/":
        response
          .writeHead(200, { ...headers, "content-type": "text/html; charset=utf-8" })
          .end(html);

        return;
      case "/state":
        response
          .writeHead(200, { ...headers, "content-type": "application/json" })
          .end(JSON.stringify(state));

        return;
      case "/svg":
        response.writeHead(200, { ...headers, "content-type": "image/svg+xml" }).end(svg);

        return;
      case "/events":
        response.writeHead(200, {
          ...headers,
          "content-type": "text/event-stream",
          connection: "keep-alive",
        });
        response.write(": connected\n\n");
        clients.add(response);
        request.on("close", () => clients.delete(response));

        return;
      default:
        response.writeHead(404).end();
    }
  });

  const first = options.port ?? 5173;

  const listen = (port: number): Promise<number> =>
    new Promise((done, reject) => {
      const busy = (error: Error & { code?: string }) => {
        if (error.code === "EADDRINUSE" && port !== 0 && port < first + 20) done(listen(port + 1));
        else reject(error);
      };

      server.once("error", busy);
      server.listen(port, () => {
        server.off("error", busy);
        const address = server.address();
        done(address instanceof Object ? address.port : port);
      });
    });

  const url = `http://localhost:${await listen(first)}`;
  console.log(`previewing ${source} at ${url}`);

  return url;
};
