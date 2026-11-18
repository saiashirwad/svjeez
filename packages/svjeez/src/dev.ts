import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { loopLength, seek } from "./page";
import { escapeText } from "./format";
import type { BuildReport } from "./traced";

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

type Preview = BuildReport & { readonly svg: string };

const page = (title: string) => `<!doctype html>
<meta charset="utf-8">
<title>${escapeText(title)}</title>
<style>
  :root { color-scheme: light dark; font: 13px ui-monospace, Menlo, monospace }
  body { margin: 24px auto; width: min(96%, 76rem); display: grid; gap: 16px; background: Canvas; color: CanvasText }
  #stage { display: grid; justify-items: center }
  #stage > svg { max-width: 100%; height: auto }
  #controls { display: flex; gap: 12px; align-items: center }
  #scrub { flex: 1; min-width: 0 }
  #error, #findings { white-space: pre-wrap; overflow-wrap: anywhere }
  #error:empty, #warnings:empty { display: none }
  #warnings { padding-inline-start: 22px; margin: 0 }
  #error { color: #e5484d }
  #tracks { display: grid; gap: 5px; max-height: 19rem; overflow: auto; margin-block: 12px }
  .track { display: grid; grid-template-columns: minmax(10ch, 1fr) minmax(12ch, 3fr); gap: 6px; align-items: center }
  .label { text-overflow: ellipsis; overflow: hidden; white-space: nowrap }
  .spans { height: 1.25em; position: relative; background: color-mix(in srgb, CanvasText 10%, Canvas); border-radius: 3px }
  .span { position: absolute; padding: 0; border: 0; height: 100%; min-width: 4px; background: Highlight; border-radius: 3px }
  .finding { display: block; margin-block: 6px; text-align: start; font: inherit }
  button, summary { cursor: pointer }
  @media (max-width: 480px) { .track { grid-template-columns: minmax(9ch, 1fr) minmax(10ch, 2fr) } }
</style>
<div id="stage"></div>
<div id="controls"><button id="toggle">pause</button><input id="scrub" aria-label="Scene time" type="range" min="0" step="any" value="0"><span id="clock"></span></div>
<pre id="error" role="alert"></pre>
<ul id="warnings" aria-label="Compiler warnings"></ul>
<details id="inspector">
  <summary>Timeline</summary>
  <div id="tracks"></div>
  <button id="check">Check layout</button>
  <div id="findings" aria-live="polite"></div>
</details>
<script>
  const seek = ${seek.toString()};
  const loopLength = ${loopLength.toString()};
  const byId = (id) => document.getElementById(id);
  const stage = byId("stage"), toggle = byId("toggle"), scrub = byId("scrub");
  const clock = byId("clock"), error = byId("error"), tracks = byId("tracks");
  const warnings = byId("warnings"), check = byId("check"), findings = byId("findings");
  let duration = 1, rate = 1, time = 0, playing = true, loop = true, last = performance.now();
  let version = 0, request = 0, timeline = [];
  const root = () => stage.querySelector("svg");
  const show = () => { scrub.value = time; clock.textContent = time.toFixed(2) + "s / " + duration.toFixed(2) + "s"; };
  const frame = (now) => {
    if (playing) {
      const next = time + (now - last) * rate / 1000;
      time = loop ? next % duration : Math.min(duration, next);
      if (!loop && time === duration) pause();
      show();
    }
    last = now;
    requestAnimationFrame(frame);
  };
  const play = () => {
    if (!loop && time === duration) time = 0;
    playing = true; toggle.textContent = "pause";
    last = performance.now();
    const svg = root();
    if (!svg) return;
    seek(time, stage);
    for (const animation of svg.getAnimations({ subtree: true })) animation.play();
    svg.unpauseAnimations();
  };
  const pause = () => { playing = false; toggle.textContent = "play"; seek(time, stage); };
  const jump = (at) => { time = Math.min(at, duration); pause(); show(); };
  toggle.onclick = () => (playing ? pause() : play());
  scrub.oninput = () => jump(Number(scrub.value));
  const text = (tag, value, className = "") => {
    const node = document.createElement(tag);
    node.textContent = value;
    node.className = className;
    return node;
  };
  const fillTracks = () => {
    tracks.replaceChildren();
    if (!timeline.length) tracks.append(text("p", "No compiled tracks for this SVG."));
    for (const { label, source, spans, period } of timeline) {
      const line = text("div", "", "track"), name = text("span", label, "label");
      const windows = text("div", "", "spans");
      name.title = [label, source].filter(Boolean).join(" · ");
      const cycles = period ? Math.min(24, Math.ceil(duration / period)) : 1;
      for (let i = 0; i < cycles; i++) {
        for (const span of spans) {
          const at = span.at + i * (period ?? 0);
          if (at > duration) continue;
          const button = text("button", "", "span");
          button.title = [label, at.toFixed(3) + "s", source].filter(Boolean).join(" · ");
          button.setAttribute("aria-label", button.title);
          button.style.left = Math.min(99, at / duration * 100) + "%";
          button.style.width = Math.min(span.over, duration - at) / duration * 100 + "%";
          button.onclick = () => jump(at);
          windows.append(button);
        }
      }
      line.append(name, windows);
      tracks.append(line);
    }
  };
  byId("inspector").ontoggle = () => {
    if (byId("inspector").open) fillTracks();
  };
  const load = async () => {
    const current = ++request;
    const data = await (await fetch("/build")).json();
    if (current !== request) return;
    version = data.version;
    check.disabled = false;
    findings.replaceChildren();
    error.textContent = data.error ?? "";
    if (data.error) { check.disabled = true; return; }
    stage.innerHTML = data.svg;
    duration = data.duration || loopLength(stage) || 1;
    loop = data.loop ?? true;
    rate = Number(root()?.getAttribute("data-playback-rate")) || 1;
    scrub.max = duration;
    time = loop ? time % duration : Math.min(time, duration);
    timeline = data.timeline;
    warnings.replaceChildren(...data.warnings.map((warning) => text("li", warning)));
    if (byId("inspector").open) fillTracks();
    playing ? play() : pause();
    show();
  };
  check.onclick = async () => {
    const checked = version;
    check.disabled = true;
    findings.textContent = "Checking…";
    try {
      const { findings: found, error: message } = await (await fetch("/check?version=" + checked)).json();
      if (checked !== version) return;
      findings.replaceChildren();
      if (message || !found.length) {
        findings.textContent = message || "No findings.";
        return;
      }
      for (const { source, rule, severity, message, times } of found) {
        const button = text("button", [source, severity, rule, message].filter(Boolean).join(" · "), "finding");
        button.onclick = () => jump(times[0] ?? 0);
        findings.append(button);
      }
    } catch {
      if (checked === version) findings.textContent = "Could not check the scene.";
    } finally {
      if (checked === version) check.disabled = false;
    }
  };
  new EventSource("/events").onmessage = load;
  load();
  requestAnimationFrame(frame);
</script>`;

const run = (cli: string, command: string, file: string, args: readonly string[]) =>
  new Promise<{ output: string; log: string; code: number | null }>((done) => {
    const child = spawn(
      process.execPath,
      [...process.execArgv, cli, command, file, "--json", ...args],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => done({ output: "", log: error.message, code: null }));
    child.on("close", (code) =>
      done({
        output: Buffer.concat(out).toString("utf8"),
        log: Buffer.concat(err).toString("utf8").trim(),
        code,
      }),
    );
  });

const IGNORED = /(^|[\\/])(node_modules|\.[^\\/]*)([\\/]|$)|\.svg$/;

export const dev = async (options: DevOptions): Promise<string> => {
  const source = resolve(options.file);
  const out = options.out === undefined ? undefined : resolve(options.out);
  const args = options.args ?? [];
  const clients = new Set<ServerResponse>();
  let state: Build = { version: 0 };
  let preview: Preview = { svg: "", warnings: [], timeline: [] };
  let checking: { version: string; run: ReturnType<typeof run> } | undefined;

  const once = async () => {
    let problem: string | undefined;

    try {
      const built = await run(options.cli, "svg", source, args);

      if (built.code !== 0) throw new Error(built.log || `exited with ${built.code}`);
      const next: Preview = JSON.parse(built.output);

      if (out) await writeFile(out, next.svg);

      preview = next;
      console.log(`✓ ${basename(source)} (${(preview.svg.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${problem}`);
    }

    state = { version: state.version + 1, ...(problem && { error: problem }) };

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
    const url = new URL(request.url ?? "/", "http://localhost");
    const headers = { "cache-control": "no-store" };

    switch (url.pathname) {
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
        response.writeHead(200, { ...headers, "content-type": "image/svg+xml" }).end(preview.svg);

        return;
      case "/build":
        response
          .writeHead(200, { ...headers, "content-type": "application/json" })
          .end(JSON.stringify({ ...preview, ...state }));

        return;
      case "/check": {
        const version = String(state.version);

        const reply = (json: string) =>
          response.writeHead(200, { ...headers, "content-type": "application/json" }).end(json);

        if (version !== url.searchParams.get("version") || state.error) {
          reply(JSON.stringify({ error: "The scene changed. Check the new build." }));

          return;
        }

        if (checking?.version !== version) {
          const task = run(options.cli, "check", source, args);
          checking = { version, run: task };
          void task.finally(() => {
            if (checking?.run === task) checking = undefined;
          });
        }

        void checking.run.then(({ output, log }) => {
          const message =
            version !== String(state.version)
              ? "The scene changed. Check the new build."
              : !output
                ? log || "The check returned no report."
                : undefined;

          reply(message ? JSON.stringify({ error: message }) : output);
        });

        return;
      }

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
