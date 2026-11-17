import { createContext, untrack } from "svelte";
import { seek, restyle } from "svjeez/page";
import type { Compiled } from "@svjeez/live/compile";
import { createCompiler, latestWins } from "@svjeez/live/client";
import { clamp, gzipSize, svgUrl } from "../util";
import initial from "./meadow.tsx?raw";
import meadow from "./meadow.tsx?svjeez";
import type { NumberParam } from "svjeez/params";
import { positionOf } from "@svjeez/live/fit";
import { linesOf, parse, madeBy, type Literal, type Source } from "@svjeez/live/source";
import { readTimeline, type Bar, type Timeline } from "./timeline";

interface Hot {
  readonly keys: ReadonlySet<string>;
  readonly lines: ReadonlySet<number>;
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

const live = (literal: Literal) => literal.kind !== "string" && !literal.param?.option;

const keysForLine = (scene: Source, n: number): Set<string> => {
  const start = scene.lineStart(n);
  const line = scene.text.slice(start, scene.lineStart(n + 1));
  const indent = line.length - line.trimStart().length;

  if (!line.trim()) return new Set();

  return new Set(madeBy(scene, start + indent).map((e) => e.key));
};

const linesFor = (scene: Source, keys: Iterable<string>) => {
  const wanted = new Set(keys);
  const out = new Set<number>();

  for (const e of scene.elements)
    if (e.builtin && wanted.has(e.key))
      for (let n = e.openLines[0]; n <= e.openLines[1]; n++) out.add(n);

  return out;
};

const NO_HOT: Hot = { keys: new Set(), lines: new Set(), step: null };

const NO_TIMELINE: Timeline = { duration: 6, rows: [] };

type Compile = (source: string) => Promise<Compiled>;

const strip = (svg: string) => svg.replaceAll(/ data-source="[^"]*"/g, "");

export class Lab {
  source = $state.raw(initial);
  shown = $state.raw(initial);
  #scene = $derived(parse(this.shown));
  lines = $derived(linesOf(this.#scene, live));

  compiled = $state.raw({ svg: "", source: initial });
  svg = $derived(strip(this.compiled.svg));
  #timeline = $derived(
    this.compiled.svg ? readTimeline(this.compiled.svg, parse(this.compiled.source)) : NO_TIMELINE,
  );
  duration = $derived(this.#timeline.duration);
  rows = $derived(this.#timeline.rows);

  error = $state<string | null>(null);
  stats = $state.raw<Stats | null>(null);
  imgSrc = $state(meadow.src);

  /** The file's clock in seconds, and the page's in milliseconds, both set once a frame. */
  t = $state(0);
  #ms = $state(0);
  paused = $state(false);
  /** Where the dots on every ease ride, 0 to 1, resting at the end for a beat before the next lap. */
  ride = $derived(clamp((((this.#ms / 1400) % 1.25) / 1.25) * 1.25, 0, 1));
  live = $derived.by(() => {
    const out = new Set<number>();

    for (const r of this.rows)
      for (const b of r.bars) if (this.t >= b.from && this.t < b.to) out.add(b.line);

    return out;
  });

  hot = $state.raw<Hot>(NO_HOT);
  hud = $state.raw<Hud | null>(null);
  ease = $state.raw<EaseEditor | null>(null);
  scrubbing = $state(false);

  ghost: ShadowRoot | undefined;
  #root: HTMLElement | undefined;
  #dragging = false;
  #seeking = false;
  #origin = 0;
  #pausedAt = 0;
  #url = "";
  #files = 0;
  #editedAt = 0;
  #latencies: Latency[] = [];
  #queue: ((source: string) => void) | undefined;

  start = (root: HTMLElement) =>
    untrack(() => {
      this.#root = root;
      this.#origin = performance.now();
      const compile = createCompiler({ sources: true });
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

  edit(start: number, len: number, text: string) {
    this.source = this.source.slice(0, start) + text + this.source.slice(start + len);
    this.#schedule();
  }

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

  openEase(anchor: Element, get: () => readonly number[], set: (p: number[]) => void) {
    this.closeEase();
    const W = 200;
    const r = anchor.getBoundingClientRect();
    const host = this.#root!.getBoundingClientRect();

    this.ease = {
      anchor,
      left: clamp(r.left - host.left - W / 2, 8, Math.max(8, host.width - W - 8)),
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

  holdEase(held: boolean) {
    this.#dragging = held;
  }

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

  seekStart() {
    this.#seeking = true;
    this.paused = true;
  }

  seek(at: number) {
    this.#pausedAt = clamp(at * this.duration, 0, this.duration - 0.001);
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
      gzip: await gzipSize(svg),
      raw: new TextEncoder().encode(svg).length,
      ms,
      avg: recent.reduce((s, l) => s + l.total, 0) / recent.length,
      files: this.#files,
    };
  }
}

export const [getLab, setLab] = createContext<Lab>();
