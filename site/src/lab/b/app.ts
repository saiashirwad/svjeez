import type { Compiled } from "../../playground/core";
import { COLORS, DEFAULT_FEEL, type Feel, isDay, skyAt, source } from "./feel";

// ---------- state ----------

let feel: Feel = DEFAULT_FEEL;
const listeners = new Set<() => void>();
const update = (patch: Partial<Feel>) => {
  feel = { ...feel, ...patch };
  listeners.forEach((f) => f());
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The scene's landing spring, the same formula the scene source runs. */
const spring = (s: number, f: Feel = feel) => {
  const w = 2 * Math.PI * f.hz;
  return f.squash * Math.exp(-f.damping * w * s) * Math.cos(w * Math.sqrt(1 - f.damping ** 2) * s);
};

/** y of a cubic-bezier ease at progress x. */
const bezierAt = ([x1, y1, x2, y2]: Feel["fall"], x: number) => {
  const c = (a: number, b: number, u: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (c(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return c(y1, y2, (lo + hi) / 2);
};

// ---------- compiling ----------

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const waiting = new Map<number, (r: Compiled) => void>();
let nextId = 0;
worker.onmessage = ({ data }: MessageEvent<{ id: number } & Compiled>) => {
  waiting.get(data.id)?.(data);
  waiting.delete(data.id);
};
const compile = (src: string) =>
  new Promise<Compiled>((resolve) => {
    const id = ++nextId;
    waiting.set(id, resolve);
    worker.postMessage({ id, source: src });
  });

const img = document.querySelector<HTMLImageElement>("[data-stage]")!;
const statFile = document.querySelector<HTMLElement>("[data-file]")!;
const statGzip = document.querySelector<HTMLElement>("[data-gzip]")!;
const statMs = document.querySelector<HTMLElement>("[data-ms]")!;
const save = document.querySelector<HTMLAnchorElement>("[data-save]")!;
const errorBox = document.querySelector<HTMLElement>("[data-error]")!;

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
let busy = false;
let queued: string | undefined;
let lastSource = "";
let files = 0;
let url = "";

const pump = async () => {
  if (busy || queued === undefined) return;
  const src = queued;
  queued = undefined;
  busy = true;
  const result = await compile(src);
  busy = false;

  if (result.ok) {
    files++;
    const next = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    const old = url;
    url = next;
    img.src = next;
    save.href = next;
    if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);
    statFile.textContent = `gummies-${String(files).padStart(3, "0")}.svg`;
    statGzip.textContent = `${kb(result.stats.gzip)} gzip`;
    statMs.textContent = `${Math.round(result.ms)} ms`;
    for (const el of [statFile, statGzip])
      el.animate([{ color: "var(--hot)" }, { color: "inherit" }], { duration: 500 });
    errorBox.hidden = true;
  } else {
    errorBox.hidden = false;
    errorBox.textContent = result.error.message;
  }
  pump();
};

const request = () => {
  const src = source(feel);
  if (src === lastSource) return;
  lastSource = src;
  queued = src;
  pump();
};
listeners.add(request);

// ---------- svg helpers ----------

const NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;
const set = <E extends Element>(el: E, attrs: Attrs) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const add = <K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Attrs = {}) =>
  parent.appendChild(set(document.createElementNS(NS, tag), attrs));

const localPoint = (svg: SVGSVGElement, e: PointerEvent) => {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: p.x, y: p.y };
};

/** Pointer drag on `target`, reported in the instrument's own coordinates. */
const drag = (
  svg: SVGSVGElement,
  target: Element,
  handlers: {
    start?: (p: { x: number; y: number }) => void;
    move: (p: { x: number; y: number }, from: { x: number; y: number }) => void;
    end?: () => void;
  },
) => {
  target.addEventListener("pointerdown", (event) => {
    const e = event as PointerEvent;
    e.preventDefault();
    e.stopPropagation();
    const from = localPoint(svg, e);
    (target as Element).setPointerCapture(e.pointerId);
    svg.classList.add("held");
    handlers.start?.(from);
    const move = (m: Event) => handlers.move(localPoint(svg, m as PointerEvent), from);
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      svg.classList.remove("held");
      handlers.end?.();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
};

const keys = (svg: SVGSVGElement, map: Record<string, () => void>) =>
  svg.addEventListener("keydown", (e) => {
    const f = map[e.key];
    if (f) {
      e.preventDefault();
      f();
    }
  });

const instrument = (name: string) => {
  const svg = document.querySelector<SVGSVGElement>(`[data-instrument="${name}"]`)!;
  const readout = document.querySelector<HTMLElement>(`[data-readout="${name}"]`)!;
  return { svg, readout };
};

const frames: ((now: number, dt: number) => void)[] = [];

// ---------- spring ----------
{
  const { svg, readout } = instrument("spring");
  const AX = 58;
  const REST = 104;
  const PX = 70;
  const T0 = 124;
  const T1 = 252;
  const SPAN = 1.6;
  const MID = 96;
  const AMP = 95;
  add(svg, "rect", { x: AX - 26, y: 8, width: 52, height: 6, rx: 3, class: "ink-fill" });
  const coil = add(svg, "polyline", { class: "coil" });
  const weight = add(svg, "g", { class: "grab" });
  const body = add(weight, "rect", { fill: COLORS[0], rx: 12 });
  const eyeL = add(weight, "circle", { r: 2.6, class: "eye" });
  const eyeR = add(weight, "circle", { r: 2.6, class: "eye" });
  add(svg, "line", { x1: T0, x2: T1, y1: MID, y2: MID, class: "axis" });
  const envelope = add(svg, "path", { class: "envelope" });
  const trace = add(svg, "path", { class: "trace" });
  const pen = add(svg, "circle", { r: 4, fill: COLORS[0] });
  const period = add(svg, "circle", { r: 9, class: "knob" });
  const decay = add(svg, "circle", { r: 9, class: "knob" });
  const periodLabel = add(svg, "text", { class: "tiny", "text-anchor": "middle" });
  const decayLabel = add(svg, "text", { class: "tiny", "text-anchor": "middle" });
  const tx = (s: number) => T0 + (s / SPAN) * (T1 - T0);

  let held: number | undefined;
  let plucked = performance.now();
  const pluck = () => (plucked = performance.now());

  drag(svg, weight, {
    move: (p) => {
      held = clamp((p.y - REST) / PX, 0.04, 0.6);
      update({ squash: Number(held.toFixed(2)) });
    },
    end: () => {
      held = undefined;
      pluck();
    },
  });
  drag(svg, period, {
    move: (p) => {
      const half = clamp((p.x - T0) / (T1 - T0), 0.04, 0.7) * SPAN;
      const hz = clamp(1 / (2 * half * Math.sqrt(1 - feel.damping ** 2)), 0.8, 8);
      update({ hz: Number(hz.toFixed(1)) });
      pluck();
    },
  });
  drag(svg, decay, {
    move: (p) => {
      const e = clamp((p.y - MID) / AMP, feel.squash * 0.002, feel.squash * 0.97);
      const z = clamp(-Math.log(e / feel.squash) / (2 * Math.PI * feel.hz * 0.5), 0.03, 0.9);
      update({ damping: Number(z.toFixed(2)) });
      pluck();
    },
  });
  keys(svg, {
    ArrowUp: () => (update({ squash: clamp(feel.squash - 0.02, 0.04, 0.6) }), pluck()),
    ArrowDown: () => (update({ squash: clamp(feel.squash + 0.02, 0.04, 0.6) }), pluck()),
    ArrowLeft: () => (update({ hz: clamp(feel.hz - 0.2, 0.8, 8) }), pluck()),
    ArrowRight: () => (update({ hz: clamp(feel.hz + 0.2, 0.8, 8) }), pluck()),
  });

  frames.push((now) => {
    const f = feel;
    const tau = (now - plucked) / 1000;
    if (tau > 3.2 && held === undefined) pluck();
    const s = held ?? (tau < SPAN + 0.6 ? spring(Math.min(tau, SPAN), f) : 0);
    const cy = REST + s * PX;
    const w = 40 * (1 + 0.8 * s);
    const h = 32 * (1 - s);
    set(body, { x: AX - w / 2, y: cy - h / 2, width: w, height: h });
    set(eyeL, { cx: AX - 7, cy: cy - h * 0.12 });
    set(eyeR, { cx: AX + 7, cy: cy - h * 0.12 });

    const loops = Math.round(5 + f.hz * 1.4);
    const top = 14;
    const bottom = cy - h / 2;
    const pts = [`${AX},${top}`];
    for (let i = 1; i < loops * 2; i++)
      pts.push(`${AX + (i % 2 ? 13 : -13)},${top + ((bottom - top) * i) / (loops * 2)}`);
    pts.push(`${AX},${bottom}`);
    set(coil, { points: pts.join(" ") });

    let d = "";
    let env = "";
    let low = "";
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * SPAN;
      d += `${i ? "L" : "M"}${tx(t).toFixed(1)} ${(MID + spring(t, f) * AMP).toFixed(1)}`;
      const e = f.squash * Math.exp(-f.damping * 2 * Math.PI * f.hz * t) * AMP;
      env += `${i ? "L" : "M"}${tx(t).toFixed(1)} ${(MID - e).toFixed(1)}`;
      low += `${i ? "L" : "M"}${tx(t).toFixed(1)} ${(MID + e).toFixed(1)}`;
    }
    set(trace, { d });
    set(envelope, { d: `${env}${low}` });
    if (held === undefined && tau < SPAN) set(pen, { cx: tx(tau), cy: MID + s * AMP, opacity: 1 });
    else set(pen, { opacity: 0 });

    const w0 = 2 * Math.PI * f.hz;
    const half = Math.PI / (w0 * Math.sqrt(1 - f.damping ** 2));
    set(period, { cx: tx(Math.min(half, SPAN)), cy: MID + spring(half, f) * AMP });
    set(periodLabel, { x: tx(Math.min(half, SPAN)), y: MID + spring(half, f) * AMP - 14 });
    periodLabel.textContent = `${f.hz.toFixed(1)} Hz`;
    const dy = f.squash * Math.exp(-f.damping * w0 * 0.5) * AMP;
    set(decay, { cx: tx(0.5), cy: MID + dy });
    set(decayLabel, { x: tx(0.5), y: MID + dy + 22 });
    decayLabel.textContent = `damping ${f.damping.toFixed(2)}`;
    readout.textContent = `squash ${f.squash.toFixed(2)}`;
  });
}

// ---------- ease pad ----------
{
  const { svg, readout } = instrument("ease");
  const X0 = 22;
  const Y0 = 48;
  const S = 136;
  const LANE = 214;
  const px = (x: number) => X0 + x * S;
  const py = (y: number) => Y0 + y * S;
  add(svg, "rect", { x: X0, y: Y0, width: S, height: S, class: "pad" });
  add(svg, "text", { x: X0, y: Y0 - 8, class: "tiny" }).textContent = "apex";
  add(svg, "text", { x: X0, y: Y0 + S + 16, class: "tiny" }).textContent = "ground";
  add(svg, "text", { x: X0 + S, y: Y0 + S + 16, class: "tiny", "text-anchor": "end" }).textContent = "time →";
  const arms = add(svg, "path", { class: "arm" });
  const strobe = add(svg, "g");
  const curve = add(svg, "path", { class: "trace" });
  const ball = add(svg, "circle", { r: 5.5, fill: COLORS[1] });
  add(svg, "line", { x1: LANE, x2: LANE, y1: Y0, y2: Y0 + S + 2, class: "axis" });
  const laneStrobe = add(svg, "g");
  const drop = add(svg, "rect", { fill: COLORS[1], rx: 7, width: 24, height: 22 });
  const h1 = add(svg, "circle", { r: 9, class: "knob" });
  const h2 = add(svg, "circle", { r: 9, class: "knob" });
  const dots = Array.from({ length: 11 }, () => add(strobe, "circle", { r: 2.2, class: "strobe" }));
  const laneDots = Array.from({ length: 11 }, () => add(laneStrobe, "line", { class: "strobe-line" }));

  const handle = (el: Element, i: 0 | 1) =>
    drag(svg, el, {
      move: (p) => {
        const next = [...feel.fall] as [number, number, number, number];
        next[i * 2] = Number(clamp((p.x - X0) / S, 0, 1).toFixed(2));
        next[i * 2 + 1] = Number(clamp((p.y - Y0) / S, -0.35, 1.35).toFixed(2));
        update({ fall: next });
      },
    });
  handle(h1, 0);
  handle(h2, 1);
  const nudge = (i: number, d: number) => {
    const next = [...feel.fall] as [number, number, number, number];
    next[i] = Number(clamp(next[i]! + d, i % 2 ? -0.35 : 0, i % 2 ? 1.35 : 1).toFixed(2));
    update({ fall: next });
  };
  keys(svg, {
    ArrowLeft: () => nudge(0, -0.02),
    ArrowRight: () => nudge(0, 0.02),
    ArrowUp: () => nudge(1, -0.02),
    ArrowDown: () => nudge(1, 0.02),
  });

  frames.push((now) => {
    const [x1, y1, x2, y2] = feel.fall;
    set(curve, { d: `M${px(0)} ${py(0)}C${px(x1)} ${py(y1)} ${px(x2)} ${py(y2)} ${px(1)} ${py(1)}` });
    set(arms, { d: `M${px(0)} ${py(0)}L${px(x1)} ${py(y1)}M${px(1)} ${py(1)}L${px(x2)} ${py(y2)}` });
    set(h1, { cx: px(x1), cy: py(y1) });
    set(h2, { cx: px(x2), cy: py(y2) });
    dots.forEach((dot, k) => set(dot, { cx: px(k / 10), cy: py(bezierAt(feel.fall, k / 10)) }));
    laneDots.forEach((l, k) => {
      const y = py(bezierAt(feel.fall, k / 10));
      set(l, { x1: LANE - 8, x2: LANE + 8, y1: y, y2: y });
    });

    const beat = 60 / feel.bpm;
    const cycle = beat + 0.7;
    const t = ((now / 1000) % cycle) / beat;
    const p = Math.min(t, 1);
    const v = bezierAt(feel.fall, p);
    set(ball, { cx: px(p), cy: py(v) });
    const landed = t >= 1 ? spring((t - 1) * beat) : 0;
    const w = 24 * (1 + 0.8 * landed);
    const h = 22 * (1 - landed);
    set(drop, { x: LANE - w / 2, y: py(v) - h, width: w, height: h });
    readout.textContent = `${x1}, ${y1}, ${x2}, ${y2}`;
  });
}

// ---------- rhythm comb ----------
{
  const { svg, readout } = instrument("comb");
  const X0 = 16;
  const BEAT = 29;
  const TOP = 22;
  const ROW = 24;
  const bx = (b: number) => X0 + b * BEAT;
  for (let b = 0; b <= 8; b++) {
    add(svg, "line", { x1: bx(b), x2: bx(b), y1: TOP - 10, y2: TOP + ROW * 5, class: b % 4 ? "beat" : "bar" });
    if (b < 8) add(svg, "text", { x: bx(b) + 3, y: TOP + ROW * 5 + 12, class: "tiny" }).textContent = String(b + 1);
  }
  const spine = add(svg, "line", { class: "spine" });
  const rows = COLORS.map((fill, i) => {
    const g = add(svg, "g");
    const bar = add(g, "rect", { y: TOP + i * ROW + 3, height: ROW - 6, rx: (ROW - 6) / 2, fill, opacity: 0.28 });
    const dot = add(g, "circle", { r: 6.5, fill });
    return { bar, dot, i };
  });
  const head = add(svg, "line", { y1: TOP - 10, y2: TOP + ROW * 5, class: "playhead" });
  const grip = add(svg, "rect", { x: 0, y: 0, width: 260, height: 170, fill: "transparent", class: "grab-x" });

  let s0 = 0;
  drag(svg, grip, {
    start: () => (s0 = feel.stagger),
    move: (p, from) => {
      let s = clamp(s0 + (p.x - from.x) / (BEAT * 4), -0.8, 0.8);
      if (Math.abs(s) < 0.02) s = 0;
      update({ stagger: Number(s.toFixed(2)) });
    },
  });
  keys(svg, {
    ArrowLeft: () => update({ stagger: Number(clamp(feel.stagger - 0.05, -0.8, 0.8).toFixed(2)) }),
    ArrowRight: () => update({ stagger: Number(clamp(feel.stagger + 0.05, -0.8, 0.8).toFixed(2)) }),
  });

  let beats = 0;
  frames.push((_, dt) => {
    beats = (beats + (dt / 1000) * (feel.bpm / 60)) % 8;
    set(head, { x1: bx(beats), x2: bx(beats) });
    const launches = rows.map(({ i }) => {
      const order = feel.stagger < 0 ? COLORS.length - 1 - i : i;
      return 0.75 + order * Math.abs(feel.stagger);
    });
    rows.forEach(({ bar, dot, i }) => {
      const b = launches[i]!;
      set(bar, { x: bx(b), width: 2 * BEAT });
      const air = beats >= b && beats < b + 2 ? Math.sin(((beats - b) / 2) * Math.PI) : 0;
      set(dot, { cx: bx(b), cy: TOP + i * ROW + ROW / 2 - air * 7, r: 6.5 + air * 2 });
    });
    set(spine, {
      x1: bx(launches[0]!),
      y1: TOP + ROW / 2,
      x2: bx(launches[4]!),
      y2: TOP + ROW * 4.5,
    });
    const s = feel.stagger;
    readout.textContent = s === 0 ? "all at once" : `${Math.abs(s).toFixed(2)} beat ${s < 0 ? "←" : "→"}`;
  });
}

// ---------- metronome ----------
{
  const { svg, readout } = instrument("tempo");
  const PX = 90;
  const PY = 196;
  const rOf = (bpm: number) => 150 - ((bpm - 50) / 150) * 100;
  add(svg, "path", { d: "M26 214L154 214L118 12L62 12Z", class: "case" });
  add(svg, "path", { d: "M62 214L118 214L110 172L70 172Z", class: "case-dark" });
  for (const bpm of [60, 80, 100, 120, 140, 160, 180, 200]) {
    const y = PY - rOf(bpm);
    add(svg, "line", { x1: PX + 9, x2: PX + 15, y1: y, y2: y, class: "scale" });
    add(svg, "text", { x: PX + 18, y: y + 3, class: "tiny scale-text" }).textContent = `${bpm}`;
  }
  const arm = add(svg, "g");
  add(arm, "line", { x1: PX, y1: PY, x2: PX, y2: PY - 172, class: "rod" });
  const bob = add(arm, "path", { class: "bob grab" });
  add(svg, "circle", { cx: PX, cy: PY, r: 4, class: "ink-fill" });
  const flash = add(svg, "circle", { cx: PX, cy: 26, r: 6, class: "tick" });

  let holding = false;
  let angle = 0;
  let phase = 0;
  drag(svg, bob, {
    start: () => (holding = true),
    move: (p) => {
      const r = clamp(PY - p.y, 50, 150);
      update({ bpm: Math.round(50 + ((150 - r) / 100) * 150) });
    },
    end: () => (holding = false),
  });
  keys(svg, {
    ArrowUp: () => update({ bpm: clamp(feel.bpm - 2, 50, 200) }),
    ArrowDown: () => update({ bpm: clamp(feel.bpm + 2, 50, 200) }),
  });

  frames.push((_, dt) => {
    const before = Math.floor(phase);
    phase += (dt / 1000) * (feel.bpm / 60);
    if (Math.floor(phase) !== before && !holding)
      flash.animate([{ opacity: 1, r: 9 }, { opacity: 0, r: 4 }] as Keyframe[], { duration: 260 });
    const target = holding ? 0 : 24 * Math.sin(Math.PI * phase);
    angle += (target - angle) * (holding ? 0.2 : 1);
    set(arm, { transform: `rotate(${angle.toFixed(2)} ${PX} ${PY})` });
    const y = PY - rOf(feel.bpm);
    set(bob, { d: `M${PX - 13} ${y - 8}L${PX + 13} ${y - 8}L${PX + 9} ${y + 8}L${PX - 9} ${y + 8}Z` });
    readout.textContent = `${feel.bpm} bpm`;
  });
}

// ---------- sun ----------
{
  const { svg, readout } = instrument("sun");
  const CX = 130;
  const CY = 124;
  const R = 92;
  const sky = add(svg, "rect", { width: 260, height: 160, rx: 0 });
  const stars = add(svg, "g", { class: "stars" });
  for (let i = 0; i < 18; i++)
    add(stars, "circle", { cx: (i * 73) % 250 + 5, cy: (i * 37) % 100 + 8, r: i % 3 ? 0.8 : 1.3 });
  add(svg, "circle", { cx: CX, cy: CY, r: R, class: "orbit" });
  const sun = add(svg, "circle", { r: 13, fill: "#FFD60A", class: "grab" });
  const moon = add(svg, "circle", { r: 9, fill: "#F4F1E6", class: "grab" });
  add(svg, "path", { d: `M0 ${CY}Q60 ${CY - 18} 120 ${CY}T260 ${CY - 6}V160H0Z`, fill: "#1B1B2F" });
  const clock = add(svg, "text", { x: 250, y: 150, class: "clock", "text-anchor": "end" });
  // Sun angle: π at 6:00 (left horizon), π/2 at noon, 0 at 18:00.
  const sunAngle = () => Math.PI - ((feel.hour - 6) / 12) * Math.PI;
  const hourOf = (a: number) => (((6 + ((Math.PI - a) / Math.PI) * 12) % 24) + 24) % 24;
  const grab = (offset: number) => (p: { x: number; y: number }) =>
    update({ hour: Number(hourOf(Math.atan2(CY - p.y, p.x - CX) - offset).toFixed(2)) });
  drag(svg, sun, { move: grab(0) });
  drag(svg, moon, { move: grab(Math.PI) });
  keys(svg, {
    ArrowLeft: () => update({ hour: (feel.hour + 23.5) % 24 }),
    ArrowRight: () => update({ hour: (feel.hour + 0.5) % 24 }),
  });

  frames.push(() => {
    const a = sunAngle();
    set(sky, { fill: skyAt(feel.hour) });
    set(sun, { cx: CX + R * Math.cos(a), cy: CY - R * Math.sin(a) });
    set(moon, { cx: CX - R * Math.cos(a), cy: CY + R * Math.sin(a) });
    stars.style.opacity = isDay(feel.hour) ? "0" : "1";
    const h = Math.floor(feel.hour);
    const m = Math.round((feel.hour - h) * 60) % 60;
    const time = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
    clock.textContent = time;
    readout.textContent = time;
  });
}

// ---------- go ----------

let last = performance.now();
const tick = (now: number) => {
  const dt = Math.min(now - last, 50);
  last = now;
  for (const f of frames) f(now, dt);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
request();
