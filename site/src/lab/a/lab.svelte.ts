// Direction A: the scene's source is the control panel. Every edit recompiles a real svjeez SVG in a worker.
import { createContext, untrack } from "svelte";
import { restyle } from "svjeez";
import { seek } from "svjeez/page";
import type { Compiled } from "@svjeez/live/compile";
import { compilerFor, latestWins } from "@svjeez/live/client";
import { svgUrl } from "../util";
import initial from "./meadow.tsx?raw";
import meadow from "./meadow.tsx?svjeez";
import { positionOf, type NumberParam } from "svjeez/params";
import { linesOf, parse, madeBy, type Literal, type Source } from "@svjeez/live/source";
import { readTimeline, type Bar, type Timeline } from "./timeline";

interface Hot {
  readonly keys: ReadonlySet<string>;
  readonly lines: ReadonlySet<number>;
  /** Where the `.to(…)` of the timeline bar under the pointer is in the source. */
  readonly step: number | null;
}

interface Hud {
  readonly left: number;
  readonly top: number;
  readonly p: number;
  readonly label: string;
}

export interface EaseEditor {
  readonly anchor: Element;
  readonly left: number;
  readonly top: number;
  readonly get: () => readonly number[];
  readonly set: (p: number[]) => void;
}

interface Stats {
  readonly gzip: number;
  readonly raw: number;
  readonly ms: number;
  readonly avg: number;
  readonly files: number;
}

interface Latency {
  compile: number;
  total: number;
}

declare global {
  interface Window {
    __labA?: { latencies: Latency[]; files: () => number };
  }
}

/** What the panel turns into controls: every number, color and ease but a param's own options. */
const live = (literal: Literal) => literal.kind !== "string" && !literal.param?.option;

/** The keys of the elements line `n` shapes, read from the first thing written on it. */
const keysForLine = (scene: Source, n: number): Set<string> => {
  const start = scene.lineStart(n);
  const line = scene.text.slice(start, scene.lineStart(n + 1));
  const indent = line.length - line.trimStart().length;

  if (!line.trim()) return new Set();

  return new Set(madeBy(scene, start + indent).map((e) => e.key));
};

/** The lines of the opening tags of the elements with these keys. */
const linesFor = (scene: Source, keys: Iterable<string>) => {
  const wanted = new Set(keys);
  const out = new Set<number>();

  for (const e of scene.elements)
    if (e.builtin && wanted.has(e.key))
      for (let n = e.openLines[0]; n <= e.openLines[1]; n++) out.add(n);

  return out;
};

const NO_HOT: Hot = { keys: new Set(), lines: new Set(), step: null };

/** Before the first compile there is no file to read a timeline from. */
const NO_TIMELINE: Timeline = { duration: 6, rows: [] };

type Compile = (source: string) => Promise<Compiled>;

const createCompiler = (): Compile =>
  compilerFor<string>(
    new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    (source) => ({
      source,
    }),
  );

/** The download is the file render() writes without `sources`: the same bytes minus the one attribute it adds. */
const strip = (svg: string) => svg.replaceAll(/ data-source="[^"]*"/g, "");

const gzip = async (text: string) => {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(s).arrayBuffer()).byteLength;
};

export class Lab {
  /** What the worker compiles. Every step of a drag edits it. */
  source = $state.raw(initial);
  /** What the code panel shows: the source as of the last gesture's end, so a drag never rebuilds the token under the pointer. */
  shown = $state.raw(initial);
  #scene = $derived(parse(this.shown));
  lines = $derived(linesOf(this.#scene, live));

  /** The last file that compiled, with `data-source` on every element, and the source it came from. */
  compiled = $state.raw({ svg: "", source: initial });
  svg = $derived(strip(this.compiled.svg));
  #timeline = $derived(
    this.compiled.svg ? readTimeline(this.compiled.svg, parse(this.compiled.source)) : NO_TIMELINE,
  );
  duration = $derived(this.#timeline.duration);
  rows = $derived(this.#timeline.rows);

  error = $state<string | null>(null);
  stats = $state.raw<Stats | null>(null);
  /** The meadow compiled at build time, until the first file from the worker replaces it. */
  imgSrc = $state(meadow.src);

  /** The file's clock in seconds, and the page's in milliseconds, both set once a frame. */
  t = $state(0);
  #ms = $state(0);
  paused = $state(false);
  /** Where the dots on every ease ride, 0 to 1, resting at the end for a beat before the next lap. */
  ride = $derived(Math.min(1, (((this.#ms / 1400) % 1.25) / 1.25) * 1.25));
  /** The source lines of the steps under the playhead. */
  live = $derived.by(() => {
    const out = new Set<number>();

    for (const r of this.rows)
      for (const b of r.bars) if (this.t >= b.from && this.t < b.to) out.add(b.line);

    return out;
  });

  hot = $state.raw<Hot>(NO_HOT);
  hud = $state.raw<Hud | null>(null);
  ease = $state.raw<EaseEditor | null>(null);
  /** A number or swatch is being dragged, which turns the whole page's cursor. */
  scrubbing = $state(false);

  /** The paused twin of the picture, in a shadow root, for hit tests and highlight boxes. */
  ghost: ShadowRoot | undefined;
  #root: HTMLElement | undefined;
  /** Any drag in the panel or the ease editor; hover linking waits for it to end. */
  #dragging = false;
  #seeking = false;
  #origin = 0;
  #pausedAt = 0;
  #url = "";
  #files = 0;
  #editedAt = 0;
  #latencies: Latency[] = [];
  #queue: ((source: string) => void) | undefined;

  /** Attach to the lab's root: starts the compiler and the frame loop. */
  start = (root: HTMLElement) =>
    untrack(() => {
      this.#root = root;
      this.#origin = performance.now();
      const compile = createCompiler();
      this.#queue = latestWins((source) => this.#run(compile, source));
      window.__labA = { latencies: this.#latencies, files: () => this.#files };
      this.#schedule();

      const tick = (ms: number) => {
        this.#tick(ms);
        frame = requestAnimationFrame(tick);
      };

      let frame = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(frame);
    });

  #now = () =>
    this.paused
      ? this.#pausedAt
      : ((((performance.now() - this.#origin) / 1000) % this.duration) + this.duration) %
        this.duration;

  #tick(ms: number) {
    const t = this.#now();
    const ghost = this.ghost?.querySelector("svg");

    if (ghost) seek(t, ghost);
    this.t = t;
    this.#ms = ms;
  }

  // ----- editing

  /** Replace `len` characters at `start` in the source and recompile. */
  edit(start: number, len: number, text: string) {
    this.source = this.source.slice(0, start) + text + this.source.slice(start + len);
    this.#schedule();
  }

  /** The gesture ended: the panel re-reads the source, so every offset is fresh. */
  commit() {
    this.shown = this.source;
  }

  reset() {
    this.source = initial;
    this.commit();
    this.#schedule();
  }

  grab() {
    this.#dragging = true;
    this.scrubbing = true;
  }

  release() {
    this.#dragging = false;
    this.scrubbing = false;
    this.hud = null;
    this.commit();
  }

  showHud(el: Element, param: NumberParam, v: number) {
    const r = el.getBoundingClientRect();
    const host = this.#root!.getBoundingClientRect();

    this.hud = {
      left: r.left - host.left + r.width / 2,
      top: r.top - host.top,
      p: positionOf(param, v),
      label: param.label ?? "",
    };
  }

  hideHud() {
    this.hud = null;
  }

  // ----- the ease editor

  openEase(anchor: Element, get: () => readonly number[], set: (p: number[]) => void) {
    this.closeEase();
    const W = 200;
    const r = anchor.getBoundingClientRect();
    const host = this.#root!.getBoundingClientRect();

    this.ease = {
      anchor,
      left: Math.max(8, Math.min(host.width - W - 8, r.left - host.left - W / 2)),
      top: r.bottom - host.top + 8,
      get,
      set,
    };
  }

  closeEase() {
    if (!this.ease) return;
    this.ease = null;
    this.#dragging = false;
    this.commit();
  }

  /** A handle in the ease editor is held. */
  holdEase(held: boolean) {
    this.#dragging = held;
  }

  // ----- linking: lines, elements and timeline rows

  #setHot(keys: ReadonlySet<string>, lines: ReadonlySet<number>, step: number | null = null) {
    this.hot = keys.size || lines.size ? { keys, lines, step } : NO_HOT;
  }

  clearHot() {
    this.hot = NO_HOT;
  }

  hoverLine(n: number) {
    if (this.#dragging) return;
    this.#setHot(keysForLine(this.#scene, n), new Set([n]));
  }

  leaveCode() {
    if (!this.#dragging) this.clearHot();
  }

  hoverStage(x: number, y: number) {
    if (this.#dragging) return;

    const k = this.ghost
      ?.elementFromPoint(x, y)
      ?.closest("[data-source]")
      ?.getAttribute("data-source");

    if (!k) return this.clearHot();
    this.#setHot(new Set([k]), linesFor(this.#scene, [k]));
  }

  hoverRow(keys: readonly string[], bar?: Bar) {
    if (this.#dragging || this.#seeking) return;
    const lines = linesFor(this.#scene, keys);

    if (bar) lines.add(bar.line);
    this.#setHot(new Set(keys), lines, bar?.at ?? null);
  }

  leaveTimeline() {
    if (!this.#seeking) this.clearHot();
  }

  // ----- clock: scrubbing the timeline pauses the file at that moment

  seekStart() {
    this.#seeking = true;
    this.paused = true;
  }

  seek(at: number) {
    this.#pausedAt = Math.max(0, Math.min(this.duration - 0.001, at * this.duration));
    void this.#paintImg(this.#pausedAt);
  }

  seekEnd() {
    this.#seeking = false;
  }

  setPaused(p: boolean) {
    if (p === this.paused) return;

    if (p) this.#pausedAt = this.#now();
    this.paused = p;
    void this.#paintImg(this.#pausedAt);
  }

  // ----- compile loop

  #schedule() {
    this.#editedAt = this.#editedAt || performance.now();
    this.#queue?.(this.source);
  }

  async #run(compile: Compile, source: string) {
    const t0 = this.#editedAt || performance.now();
    this.#editedAt = 0;
    const result = await compile(source);

    if (!result.ok) {
      this.error = `${result.error.message} The picture shows the last file that compiled.`;

      return;
    }

    this.error = null;
    this.compiled = { svg: result.svg, source };
    this.#files++;
    await this.#paintImg(this.#now() % this.duration);
    this.#latencies.push({ compile: result.ms, total: performance.now() - t0 });

    if (this.#latencies.length > 400) this.#latencies.shift();
    void this.#stats(result.ms);
  }

  /** Swap the picture for a new file, starting it at the current moment so a drag never rewinds the loop. */
  #paintImg(t: number) {
    return new Promise<void>((resolve) => {
      const previous = this.#url;
      const url = svgUrl(restyle(this.svg, { at: t, paused: this.paused }));
      this.#url = url;
      const next = new Image();

      next.onload = () => {
        this.imgSrc = url;

        if (!this.paused) this.#origin = performance.now() - t * 1000;

        if (previous) URL.revokeObjectURL(previous);
        resolve();
      };

      next.onerror = () => resolve();
      next.src = url;
    });
  }

  async #stats(ms: number) {
    const svg = this.svg;
    const recent = this.#latencies.slice(-20);

    this.stats = {
      gzip: await gzip(svg),
      raw: new TextEncoder().encode(svg).length,
      ms,
      avg: recent.reduce((s, l) => s + l.total, 0) / recent.length,
      files: this.#files,
    };
  }
}

export const [getLab, setLab] = createContext<Lab>();
