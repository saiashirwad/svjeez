import { restyle } from "svjeez";
import type { Compiled } from "../../playground/core";
import { spectrum, type Point, type Spectrum, type Term } from "./fourier";
import { sceneSource, type Frame } from "./scene";
import { PRESETS } from "./shapes";

const LOOP = 8;
const MOST = 400;

/** Slider position, 0 to 1000, to a circle count, spaced by ratio so every small count gets its own stretch. */
const countAt = (p: number) => Math.max(1, Math.min(MOST, Math.round(MOST ** (p / 1000))));
const positionOf = (n: number) => Math.round((1000 * Math.log(n)) / Math.log(MOST));

/** Counts the picture passes through when a new shape arrives, so it grows from one circle to the chosen count. */
const sweep = (to: number) => {
  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 19, 24, 30, 38, 48, 60, 80, 110, 150, 200, 270, 400];
  return [...steps.filter((n) => n < to), to];
};

const createCompiler = () => {
  const worker = new Worker(new URL("../../playground/worker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, (r: Compiled) => void>();
  let next = 0;

  worker.onmessage = ({ data }: MessageEvent<{ id: number } & Compiled>) => {
    waiting.get(data.id)?.(data);
    waiting.delete(data.id);
  };

  return (source: string) =>
    new Promise<Compiled>((resolve) => {
      const id = ++next;
      waiting.set(id, resolve);
      worker.postMessage({ id, source });
    });
};

const thumbPath = (outline: readonly Point[]) =>
  outline
    .filter((_, i) => i % 4 === 0)
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${(-y).toFixed(3)}`)
    .join("") + "Z";

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB gzip`;

interface Shown {
  readonly spectrum: Spectrum;
  readonly n: number;
}

interface Telemetry {
  compiles: { n: number; ms: number; wall: number; gzip: number; bytes: number }[];
  shown: number;
}

export const start = (root: HTMLElement) => {
  const img = root.querySelector<HTMLImageElement>(".ld-canvas img")!;
  const canvas = root.querySelector<HTMLElement>(".ld-canvas")!;
  const ink = root.querySelector<SVGSVGElement>(".ld-ink")!;
  const inkPath = ink.querySelector("path")!;
  const slider = root.querySelector<HTMLInputElement>("[data-slider]")!;
  const count = root.querySelector<HTMLOutputElement>("[data-n]")!;
  const gzip = root.querySelector<HTMLElement>("[data-gzip]")!;
  const ms = root.querySelector<HTMLElement>("[data-ms]")!;
  const save = root.querySelector<HTMLAnchorElement>("[data-save]")!;
  const error = root.querySelector<HTMLElement>("[data-error]")!;
  const pen = root.querySelector<HTMLButtonElement>("[data-pen]")!;
  const tiles = [...root.querySelectorAll<HTMLButtonElement>(".ld-tile")];
  const compile = createCompiler();

  const telemetry: Telemetry = { compiles: [], shown: 0 };
  (window as unknown as { __labD: Telemetry }).__labD = telemetry;

  const spectra = new Map(PRESETS.map((p) => [p.name, spectrum(p.points())]));
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-preset]"))
    button.querySelector(".ld-thumb")!.setAttribute("d", thumbPath(spectra.get(button.dataset.preset!)!.outline));

  let current: Spectrum = spectra.get("heart")!;
  let n = 24;
  let shown: Shown | undefined;
  let wanted: Shown | undefined;
  let busy = false;
  let plan: number[] = [];
  let url = "";
  const epoch = performance.now();

  const pick = (tile: HTMLButtonElement) =>
    tiles.forEach((t) => t.setAttribute("aria-checked", String(t === tile)));

  const frameFor = (next: Shown): Frame => {
    const before = shown ?? { spectrum: next.spectrum, n: 0 };
    const same = before.spectrum === next.spectrum;
    return {
      spectrum: next.spectrum,
      n: next.n,
      before: { terms: before.spectrum.terms as Term[], n: before.n },
      freshFrom: same ? Math.min(before.n, next.n) : 0,
      loop: LOOP,
    };
  };

  /** Starts the new file at the loop's current moment, so the circles never rewind. */
  const paint = (svg: string) =>
    new Promise<void>((resolve) => {
      const at = ((performance.now() - epoch) / 1000) % LOOP;
      const next = URL.createObjectURL(new Blob([restyle(svg, { at })], { type: "image/svg+xml" }));
      const probe = new Image();
      probe.onload = probe.onerror = () => {
        const old = url;
        img.src = url = next;
        if (old) URL.revokeObjectURL(old);
        resolve();
      };
      probe.src = next;
    });

  const pump = async () => {
    if (busy) return;
    const fromPlan = plan.length > 0;
    const next = fromPlan ? { spectrum: current, n: plan.shift()! } : wanted;
    if (!fromPlan) wanted = undefined;
    if (!next) return;
    if (shown && shown.spectrum === next.spectrum && shown.n === next.n) return void pump();
    busy = true;
    const begin = performance.now();
    const result = await compile(sceneSource(frameFor(next)));

    if (result.ok) {
      await paint(result.svg);
      const wall = performance.now() - begin;
      telemetry.compiles.push({ n: next.n, ms: result.ms, wall, gzip: result.stats.gzip, bytes: result.stats.bytes });
      telemetry.shown++;
      shown = next;
      error.hidden = true;
      gzip.textContent = kb(result.stats.gzip);
      ms.textContent = `${Math.round(result.ms)} ms`;
      if (save.href) URL.revokeObjectURL(save.href);
      save.href = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
      if (fromPlan) setCount(next.n);
    } else {
      error.hidden = false;
      error.textContent = result.error.message;
    }
    busy = false;
    void pump();
  };

  const setCount = (value: number, moveSlider = true) => {
    count.value = String(value);
    if (moveSlider) slider.value = String(positionOf(value));
    root.style.setProperty("--fill", `${(positionOf(value) / 10).toFixed(1)}%`);
  };

  const request = (next: Shown) => {
    wanted = next;
    void pump();
  };

  const useShape = (s: Spectrum) => {
    current = s;
    plan = sweep(n);
    setCount(plan[0]!);
    void pump();
  };

  slider.addEventListener("input", () => {
    n = countAt(Number(slider.value));
    plan = [];
    setCount(n, false);
    request({ spectrum: current, n });
  });

  for (const tile of root.querySelectorAll<HTMLButtonElement>("[data-preset]"))
    tile.addEventListener("click", () => {
      pick(tile);
      root.removeAttribute("data-drawing");
      useShape(spectra.get(tile.dataset.preset!)!);
    });

  pen.addEventListener("click", () => {
    pick(pen);
    root.toggleAttribute("data-drawing");
  });

  // Drawing: anywhere on the picture, at any time.
  let stroke: Point[] = [];
  const toScene = (e: PointerEvent): Point => {
    const box = ink.getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * 960, ((e.clientY - box.top) / box.height) * 540];
  };
  const showStroke = (closed: boolean) =>
    inkPath.setAttribute(
      "d",
      stroke.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + (closed ? "Z" : ""),
    );

  ink.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ink.setPointerCapture(e.pointerId);
    stroke = [toScene(e)];
    root.setAttribute("data-inking", "");
    showStroke(false);
  });
  ink.addEventListener("pointermove", (e) => {
    if (!root.hasAttribute("data-inking")) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) stroke.push(toScene(ev));
    showStroke(false);
  });
  const finish = () => {
    if (!root.hasAttribute("data-inking")) return;
    root.removeAttribute("data-inking");
    const length = stroke.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - stroke[i - 1]![0], p[1] - stroke[i - 1]![1]) : 0), 0);
    if (stroke.length < 8 || length < 60) {
      inkPath.removeAttribute("d");
      return;
    }
    showStroke(true);
    canvas.dataset.landing = "";
    setTimeout(() => {
      delete canvas.dataset.landing;
      inkPath.removeAttribute("d");
    }, 900);
    const doodle = spectrum(stroke);
    pen.querySelector(".ld-thumb")!.setAttribute("d", thumbPath(doodle.outline));
    pen.dataset.drawn = "";
    pick(pen);
    root.removeAttribute("data-drawing");
    useShape(doodle);
  };
  ink.addEventListener("pointerup", finish);
  ink.addEventListener("pointercancel", finish);

  addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") root.removeAttribute("data-drawing");
  });

  pick(root.querySelector<HTMLButtonElement>('[data-preset="heart"]')!);
  useShape(current);
};
