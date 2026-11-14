import { createContext, untrack } from "svelte";
import { polylinePath, restyle } from "svjeez";
import { compilerFor } from "@svjeez/live/client";
import { lazy, svgUrl } from "../util";
import { outlineOf, type Outline, type Point } from "./outline";
import first from "./first.tsx?svjeez";
import type { Frame } from "./scene";
import { FIRST, LOOP, PRESETS } from "./shapes";

/** Counts the picture passes through when a new shape arrives, so it grows from one circle to the chosen count. */
const sweep = (to: number) => {
  const steps = [
    1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 19, 24, 30, 38, 48, 60, 80, 110, 150, 200, 270, 400,
  ];

  return [...steps.filter((n) => n < to), to];
};

/** A preview of an outline, thinned to about 128 points. */
const thumbPath = (outline: Outline) => {
  const step = Math.max(1, Math.floor(outline.length / 128));

  return polylinePath(
    outline.flatMap(([x, y], i) => (i % step ? [] : [{ x, y: -y }])),
    { closed: true, precision: 3 },
  );
};

const strokePath = (points: readonly Point[], closed: boolean) =>
  polylinePath(
    points.map(([x, y]) => ({ x, y })),
    { closed, precision: 1 },
  );

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB gzip`;

export const PEN = "pen";

interface Shown {
  readonly outline: Outline;
  readonly n: number;
}

interface Telemetry {
  compiles: { n: number; ms: number; wall: number; gzip: number; bytes: number }[];
  shown: number;
}

declare global {
  interface Window {
    __labD?: Telemetry;
  }
}

export class Lab {
  /** The circle count the picture has reached, which trails the slider while a new shape sweeps up. */
  count = $state<number>(FIRST.n);
  picked = $state<string>(FIRST.preset);
  drawing = $state(false);
  inking = $state(false);
  landing = $state(false);
  inkPath = $state("");
  /** The build's picture of the first shape until the first edit compiles. */
  src = $state(first.src);
  saveHref = $state(first.src);
  gzip = $state("");
  ms = $state("");
  error = $state("");
  outlines = $state.raw<ReadonlyMap<string, Outline>>(new Map());
  doodle = $state.raw<Outline>();

  thumbs = $derived(new Map([...this.outlines].map(([name, o]) => [name, thumbPath(o)])));
  doodleThumb = $derived(this.doodle && thumbPath(this.doodle));

  #compile = lazy(() =>
    compilerFor<Frame>(
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
      (frame) => ({ frame }),
    ),
  );
  #target: number = FIRST.n;
  #current: Outline | undefined;
  #shown: Shown | undefined;
  #wanted: Shown | undefined;
  #busy = false;
  #plan: number[] = [];
  #points: Point[] = [];
  #epoch = 0;
  #telemetry: Telemetry = { compiles: [], shown: 0 };

  /**
   * Computes the presets in the browser and returns the cleanup that frees the object URLs. The first shape is already
   * on screen at its count, drawn when the site was built, so it does not sweep up from one circle.
   */
  start = () =>
    untrack(() => {
      this.#epoch = performance.now();
      window.__labD = this.#telemetry;
      this.outlines = new Map(PRESETS.map((p) => [p.name, outlineOf(p.points())]));
      this.#current = this.outlines.get(FIRST.preset)!;
      this.#shown = { outline: this.#current, n: FIRST.n };

      return () => {
        URL.revokeObjectURL(this.src);
        URL.revokeObjectURL(this.saveHref);
      };
    });

  setCount(n: number) {
    this.#target = n;
    this.#plan = [];
    this.count = this.#target;
    this.#wanted = { outline: this.#current!, n: this.#target };
    void this.#pump();
  }

  pickPreset(name: string) {
    this.picked = name;
    this.drawing = false;
    this.#show(this.outlines.get(name)!);
  }

  togglePen() {
    this.picked = PEN;
    this.drawing = !this.drawing;
  }

  beginStroke(point: Point) {
    this.#points = [point];
    this.inking = true;
    this.inkPath = strokePath(this.#points, false);
  }

  extendStroke(points: readonly Point[]) {
    if (!this.inking) return;
    this.#points.push(...points);
    this.inkPath = strokePath(this.#points, false);
  }

  endStroke() {
    if (!this.inking) return;
    this.inking = false;
    const points = this.#points;

    const length = points.reduce(
      (s, p, i) => (i ? s + Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1]) : 0),
      0,
    );

    if (points.length < 8 || length < 60) {
      this.inkPath = "";

      return;
    }

    this.inkPath = strokePath(points, true);
    this.landing = true;
    setTimeout(() => {
      this.landing = false;
      this.inkPath = "";
    }, 900);
    this.doodle = outlineOf(points);
    this.picked = PEN;
    this.drawing = false;
    this.#show(this.doodle);
  }

  #show(outline: Outline) {
    this.#current = outline;
    this.#plan = sweep(this.#target);
    this.count = this.#plan[0]!;
    void this.#pump();
  }

  #frameFor(next: Shown): Frame {
    const before = this.#shown ?? { outline: next.outline, n: 0 };
    const same = before.outline === next.outline;

    return {
      outline: next.outline,
      n: next.n,
      before: { outline: before.outline, n: before.n },
      freshFrom: same ? Math.min(before.n, next.n) : 0,
      loop: LOOP,
    };
  }

  /** Starts the new file at the loop's current moment, so the circles never rewind, while its `<Once>` parts pop in from the top. */
  #paint(svg: string) {
    return new Promise<void>((resolve) => {
      const at = ((performance.now() - this.#epoch) / 1000) % LOOP;
      const next = svgUrl(restyle(svg, { at, onceAt: 0 }));
      const probe = new Image();
      probe.onload = probe.onerror = () => {
        const old = this.src;
        this.src = next;

        if (old) URL.revokeObjectURL(old);
        resolve();
      };

      probe.src = next;
    });
  }

  async #pump() {
    if (this.#busy) return;
    const fromPlan = this.#plan.length > 0;
    const next = fromPlan ? { outline: this.#current!, n: this.#plan.shift()! } : this.#wanted;

    if (!fromPlan) this.#wanted = undefined;

    if (!next) return;
    const shown = this.#shown;

    if (shown && shown.outline === next.outline && shown.n === next.n) return void this.#pump();
    this.#busy = true;
    const begin = performance.now();
    const result = await this.#compile()(this.#frameFor(next));

    if (result.ok) {
      await this.#paint(result.svg);
      this.#telemetry.compiles.push({
        n: next.n,
        ms: result.ms,
        wall: performance.now() - begin,
        gzip: result.stats.gzip,
        bytes: result.stats.bytes,
      });
      this.#telemetry.shown++;
      this.#shown = next;
      this.error = "";
      this.gzip = kb(result.stats.gzip);
      this.ms = `${Math.round(result.ms)} ms`;

      if (this.saveHref) URL.revokeObjectURL(this.saveHref);
      this.saveHref = svgUrl(result.svg);

      if (fromPlan) this.count = next.n;
    } else {
      this.error = result.error.message;
    }

    this.#busy = false;
    void this.#pump();
  }
}

export const [getLab, setLab] = createContext<Lab>();
