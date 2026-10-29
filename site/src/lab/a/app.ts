// Direction A: the scene's source is the control panel. Every edit recompiles a real svjeez SVG in the playground worker.
import { createCompiler } from "../compiler";
import { svgUrl } from "../util";
import initial from "./meadow.tsx.txt?raw";

type Kind =
  | "ws"
  | "comment"
  | "string"
  | "num"
  | "color"
  | "ease"
  | "keyword"
  | "fn"
  | "tag"
  | "attr"
  | "punct"
  | "plain";

interface Token {
  kind: Kind;
  start: number;
  text: string;
  line: number;
}

const KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "export",
  "default",
  "return",
  "function",
  "length",
]);

const NAMED: Record<string, [number, number, number, number]> = {
  in: [0.55, 0.06, 0.68, 0.19],
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  pop: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
};

const tokenize = (src: string): Token[] => {
  const out: Token[] = [];
  let i = 0;
  let line = 1;

  const push = (kind: Kind, text: string) => {
    out.push({ kind, start: i, text, line });

    for (const c of text) if (c === "\n") line++;
    i += text.length;
  };

  // Template literals: depth of `${` inside backticks.
  const tmpl: number[] = [];
  let braces = 0;

  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;

    if ((m = rest.match(/^\s+/))) push("ws", m[0]);
    else if ((m = rest.match(/^\/\/[^\n]*/))) push("comment", m[0]);
    else if (
      (m = rest.match(
        /^ease\.bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)/,
      ))
    )
      push("ease", m[0]);
    else if ((m = rest.match(/^ease\.(inOut|in|out|pop|linear)\b/))) push("ease", m[0]);
    else if ((m = rest.match(/^"#[0-9A-Fa-f]{6}"/))) push("color", m[0]);
    else if ((m = rest.match(/^"[^"\n]*"|^'[^'\n]*'/))) push("string", m[0]);
    else if (src[i] === "`") {
      push("string", "`");
      tmpl.push(braces);
      // read string part
      const s = src.slice(i).match(/^[^`$]*(?:\$(?!\{)[^`$]*)*/)![0];

      if (s) push("string", s);

      if (src[i] === "`") {
        push("string", "`");
        tmpl.pop();
      } else if (src.startsWith("${", i)) {
        push("punct", "${");
        braces++;
      }
    } else if (tmpl.length && src[i] === "}" && braces - 1 === tmpl.at(-1)) {
      push("punct", "}");
      braces--;
      const s = src.slice(i).match(/^[^`$]*(?:\$(?!\{)[^`$]*)*/)![0];

      if (s) push("string", s);

      if (src[i] === "`") {
        push("string", "`");
        tmpl.pop();
      } else if (src.startsWith("${", i)) {
        push("punct", "${");
        braces++;
      }
    } else if ((m = rest.match(/^\d+(?:\.\d+)?/))) push("num", m[0]);
    else if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const word = m[0];
      const before = src.slice(Math.max(0, i - 2), i);
      const after = src.slice(i + word.length);

      const kind: Kind = KEYWORDS.has(word)
        ? "keyword"
        : /<\/?$/.test(before)
          ? "tag"
          : /^=[{"]/.test(after)
            ? "attr"
            : after.startsWith("(")
              ? "fn"
              : "plain";

      push(kind, word);
    } else {
      const c = src[i]!;

      if (c === "{") braces++;

      if (c === "}") braces--;
      push("punct", c);
    }
  }

  return out;
};

/** JSX elements: tag name, the lines of the opening tag, the lines of the whole element. */
interface JsxElement {
  tag: string;
  nameEnd: number;
  open: [number, number];
  full: [number, number];
}

const lineAt = (src: string, at: number) => src.slice(0, at).split("\n").length;

const findElements = (src: string): JsxElement[] => {
  const els: JsxElement[] = [];
  const stack: JsxElement[] = [];
  const re = /<(\/?)([a-z][\w]*)|<(\/?)>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src))) {
    if (m[3] !== undefined) continue;
    const closing = m[1] === "/";
    const tag = m[2]!;

    if (closing) {
      const el = stack.pop();

      if (el) el.full[1] = lineAt(src, m.index);
      continue;
    }

    // walk to the end of the opening tag, skipping braces
    let j = re.lastIndex;
    let depth = 0;

    for (; j < src.length; j++) {
      const c = src[j];

      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }

    const selfClose = src[j - 1] === "/";
    const a = lineAt(src, m.index);
    const b = lineAt(src, j);
    const el: JsxElement = { tag, nameEnd: re.lastIndex, open: [a, b], full: [a, b] };
    els.push(el);

    if (!selfClose) stack.push(el);
  }

  return els;
};

const key = (el: JsxElement) => `${el.open[0]}-${el.open[1]}`;

/** The source the worker compiles: the same code with `data-l` on every element, which `strip` takes off again. */
const annotate = (src: string, els: JsxElement[]) => {
  let out = src;

  for (const el of [...els].sort((a, b) => b.nameEnd - a.nameEnd))
    out = out.slice(0, el.nameEnd) + ` data-l="${key(el)}"` + out.slice(el.nameEnd);

  return out;
};

const strip = (svg: string) => svg.replace(/ data-l="[\d-]+"/g, "");

// ----- easing math

const bez = (p: readonly number[]) => {
  const [x1, y1, x2, y2] = p as [number, number, number, number];
  const cx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const cy = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;

  return (u: number) => {
    let lo = 0;
    let hi = 1;

    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;

      if (cx(mid) < u) lo = mid;
      else hi = mid;
    }

    return cy((lo + hi) / 2);
  };
};

const curvePath = (p: readonly number[], X: (u: number) => number, Y: (v: number) => number) => {
  const f = bez(p);
  let d = "";

  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    d += `${k ? "L" : "M"}${X(u).toFixed(2)} ${Y(f(u)).toFixed(2)}`;
  }

  return d;
};

const pointsOf = (text: string): number[] => {
  const named = /^ease\.(\w+)$/.exec(text);

  if (named) return [...(NAMED[named[1]!] ?? NAMED.out!)];

  return [...text.slice(text.indexOf("(")).matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
};

const fmt = (n: number, d: number) => String(Number(n.toFixed(d)));
const bezText = (p: readonly number[]) => `ease.bezier(${p.map((n) => fmt(n, 2)).join(", ")})`;

// ----- color math (HSL is enough for a sketch)

const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;

  return [h * 60, s, l];
};

const hslToHex = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));

    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

// ----- number specs: what a drag means for each number, by what it names

interface Spec {
  min: number;
  max: number;
  step: number;
  values?: number[];
  label: string;
}

const specFor = (src: string, tok: Token): Spec => {
  const before = src.slice(Math.max(0, tok.start - 60), tok.start);
  const decimals = (tok.text.split(".")[1] ?? "").length;
  const step = decimals ? 10 ** -decimals : 1;
  const generic: Spec = { min: 0, max: Math.max(10, Number(tok.text) * 3), step, label: "" };
  const constName = /const (\w+) = $/.exec(before)?.[1];
  const attr = /(\w+)=\{$/.exec(before)?.[1];

  const table: Record<string, Partial<Spec>> = {
    flowers: { min: 1, max: 12, step: 1, label: "how many" },
    gap: { min: 16, max: 160, step: 1, label: "px apart" },
    stagger: { min: 0, max: 0.4, step: 0.01, label: "s between flowers" },
    beat: { values: [0.6, 0.75, 1, 1.2, 1.5, 2, 3], label: "s per pulse" },
    r: { min: 2, max: 90, step: 1, label: "radius" },
    strokeWidth: { min: 0.5, max: 24, step: 0.5, label: "stroke" },
    cx: { min: 0, max: 480, step: 1, label: "x" },
    cy: { min: -200, max: 300, step: 1, label: "y" },
    width: { min: 120, max: 960, step: 10, label: "px" },
    height: { min: 120, max: 600, step: 10, label: "px" },
    duration: { min: 1, max: 20, step: 0.5, label: "s loop" },
  };

  const name = constName ?? attr ?? /(\w+): $/.exec(before)?.[1];

  if (name && table[name]) return { ...generic, ...table[name] } as Spec;

  if (before.endsWith("}, ")) return { min: 0.05, max: 4, step: 0.05, label: "s long" };

  if (before.endsWith(".at(")) return { min: 0, max: 6, step: 0.1, label: "s in" };

  if (/\.at\([\d.]+ \+ $/.test(before)) return { min: 0, max: 6, step: 0.1, label: "s in" };

  if (before.endsWith("y: ")) return { min: -100, max: 300, step: 1, label: "px down" };

  if (before.endsWith("scale: ")) return { min: 0, max: 3, step: 0.05, label: "×" };

  return generic;
};

// ----- compiler: the playground worker, latest-only

const compileRaw = createCompiler();

// ----- DOM

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

const root = $("[data-lab-a]");
const codeEl = $(".la-code", root);
const stage = $(".la-stage", root);
const img = $<HTMLImageElement>(".la-img", root);
const ghostHost = $(".la-ghost", root);
const ghost = ghostHost.attachShadow({ mode: "open" });
const boxes = $(".la-boxes", root);
const timeline = $(".la-timeline", root);
const playhead = $(".la-playhead", root);
const statsEl = $(".la-stats", root);
const errorEl = $(".la-error", root);
const hud = $(".la-hud", root);
const pop = $(".la-ease-pop", root);
const colorInput = $<HTMLInputElement>(".la-color-input", root);
const download = $<HTMLAnchorElement>(".la-download", root);
const playBtn = $<HTMLButtonElement>(".la-play", root);
const resetBtn = $<HTMLButtonElement>(".la-reset", root);

let source = initial;
let elements = findElements(source);
let duration = 6;
let origin = performance.now();
let paused = false;
let pausedAt = 0;
let files = 0;
let lastSvg = "";
let lastAnnotated = "";
let url = "";
let dragging: HTMLElement | null = null;

const now = () =>
  paused ? pausedAt : ((((performance.now() - origin) / 1000) % duration) + duration) % duration;

// ----- code rendering

const renderCode = () => {
  const toks = tokenize(source);
  elements = findElements(source);
  const lines: HTMLElement[] = [];

  const mk = (n: number) => {
    const row = document.createElement("div");
    row.className = "la-line";
    row.dataset.line = String(n);
    const no = document.createElement("span");
    no.className = "la-no";
    no.textContent = String(n);
    const tx = document.createElement("span");
    tx.className = "la-tx";
    row.append(no, tx);
    lines.push(row);

    return tx;
  };

  let tx = mk(1);
  let n = 1;

  for (const t of toks) {
    if (t.kind === "ws" || t.kind === "comment") {
      const parts = t.text.split("\n");
      parts.forEach((p, k) => {
        if (k) tx = mk(++n);

        if (p) tx.append(span(t.kind, p));
      });
      continue;
    }

    tx.append(widget(t));
  }

  codeEl.replaceChildren(...lines);
};

const span = (kind: Kind, text: string) => {
  const s = document.createElement("span");
  s.className = `c-${kind}`;
  s.textContent = text;

  return s;
};

const widget = (t: Token): Node => {
  if (t.kind === "num") return numWidget(t);

  if (t.kind === "color") return colorWidget(t);

  if (t.kind === "ease") return easeWidget(t);

  return span(t.kind, t.text);
};

/** Replace `len` characters at `start` in the source and recompile. Offsets after it shift; renderCode() on release fixes them. */
const edit = (start: number, len: number, text: string) => {
  source = source.slice(0, start) + text + source.slice(start + len);
  schedule();

  return text.length;
};

const numWidget = (t: Token) => {
  const s = span("num", t.text);
  s.classList.add("la-scrub");
  s.tabIndex = 0;
  const spec = specFor(source, t);
  s.title = spec.label ? `${spec.label}: drag sideways` : "drag sideways";
  let len = t.text.length;

  const decimals = Math.max(
    (t.text.split(".")[1] ?? "").length,
    (String(spec.step).split(".")[1] ?? "").length,
  );

  const set = (v: number) => {
    const text = fmt(v, decimals);

    if (text === s.textContent) return;
    s.textContent = text;
    len = edit(t.start, len, text);
    showHud(s, spec, v);
  };

  drag(s, {
    start: () => Number(s.textContent),
    move: (v0, dx, _dy, e) => {
      if (spec.values) {
        const i0 = spec.values.indexOf(v0);

        const i = Math.max(
          0,
          Math.min(spec.values.length - 1, (i0 < 0 ? 0 : i0) + Math.round(dx / 22)),
        );

        set(spec.values[i]!);

        return;
      }

      const range = spec.max - spec.min;
      const fine = e.shiftKey ? 0.2 : 1;
      const raw = v0 + ((dx * range) / 260) * fine;
      const v = Math.max(spec.min, Math.min(spec.max, Math.round(raw / spec.step) * spec.step));
      set(v);
    },
    end: () => hideHud(),
  });
  s.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const v0 = Number(s.textContent);
    const dir = e.key === "ArrowUp" ? 1 : -1;

    if (spec.values) {
      const i = spec.values.indexOf(v0) + dir;

      if (spec.values[i] !== undefined) set(spec.values[i]!);
    } else set(Math.max(spec.min, Math.min(spec.max, v0 + dir * spec.step)));
  });

  return s;
};

const colorWidget = (t: Token) => {
  const wrap = document.createElement("span");
  wrap.className = "la-colorwrap";
  const sw = document.createElement("span");
  sw.className = "la-swatch";
  sw.tabIndex = 0;
  sw.title = "drag: sideways for hue, up and down for light. Click to pick.";
  const text = span("string", t.text);
  wrap.append(sw, text);
  let len = t.text.length;
  let hex = t.text.slice(1, -1);
  sw.style.setProperty("--c", hex);

  const set = (next: string) => {
    hex = next;
    sw.style.setProperty("--c", hex);
    text.textContent = `"${hex}"`;
    len = edit(t.start, len, `"${hex}"`);
  };

  let moved = false;
  drag(sw, {
    start: () => {
      moved = false;

      return 0;
    },
    move: (_v, dx, dy) => {
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;

      if (!moved) return;
      const [h, s, l] = hexToHsl(start);
      set(
        hslToHex(
          (((h + dx * 1.2) % 360) + 360) % 360,
          Math.max(0.35, s),
          Math.max(0.08, Math.min(0.92, l - dy / 300)),
        ),
      );
    },
    end: () => {
      if (!moved) {
        colorInput.value = hex.toLowerCase();
        colorInput.oninput = () => set(colorInput.value.toUpperCase());
        colorInput.onchange = () => renderCode();
        colorInput.click();
      }
    },
  });
  let start = hex;
  sw.addEventListener("pointerdown", () => (start = hex), { capture: true });

  return wrap;
};

const glyphs = new Set<{ el: SVGSVGElement; p: () => number[] }>();

const easeWidget = (t: Token) => {
  const wrap = document.createElement("span");
  wrap.className = "la-easewrap";
  const g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  g.setAttribute("viewBox", "-2 -8 28 28");
  g.classList.add("la-glyph");
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "button");
  g.setAttribute("aria-label", "Bend this ease");
  const text = span("ease", "");
  wrap.append(g, text);
  let points = pointsOf(t.text);
  let len = t.text.length;
  let current = t.text;

  const paintText = () => {
    text.replaceChildren();
    const m = /^(ease\.)(\w+)(\(.*\))?$/.exec(current)!;
    text.append(span("plain", m[1]!), span("fn", m[2]!));

    if (m[3]) {
      text.append(span("punct", "("));
      points.forEach((p, i) => {
        if (i) text.append(span("punct", ", "));
        text.append(span("num", fmt(p, 2)));
      });
      text.append(span("punct", ")"));
    }
  };

  const X = (u: number) => u * 24;
  const Y = (v: number) => 18 - v * 18;

  const paint = () => {
    g.innerHTML = `<rect x="0" y="0" width="24" height="18" rx="2" class="g-box"/><path class="g-curve" d="${curvePath(points, X, Y)}"/><circle class="g-dot" r="2.2"/>`;
  };

  paint();
  paintText();
  const entry = { el: g, p: () => points };
  glyphs.add(entry);

  const set = (p: number[]) => {
    points = p;
    current = bezText(p);
    len = edit(t.start, len, current);
    paint();
    paintText();
  };

  const open = () => openEase(g, () => points, set);
  g.addEventListener("click", open);
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  return wrap;
};

// The ease editor: two handles, the curve, a dot riding it, and a ball that moves with only the eased value.
let easeClose: (() => void) | null = null;

const openEase = (anchor: Element, get: () => number[], set: (p: number[]) => void) => {
  easeClose?.();
  const W = 200;
  const H = 240;
  const X = (u: number) => 20 + u * (W - 60);
  const Y = (v: number) => 195 - v * 85;
  const UX = (x: number) => (x - 20) / (W - 60);
  const UY = (y: number) => (195 - y) / 85;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const host = root.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(host.width - W - 8, r.left - host.left - W / 2))}px`;
  pop.style.top = `${r.bottom - host.top + 8}px`;
  const svg = pop.querySelector("svg")!;

  const paint = () => {
    const p = get();
    svg.innerHTML = `
      <rect x="${X(0)}" y="${Y(1)}" width="${X(1) - X(0)}" height="${Y(0) - Y(1)}" class="e-box"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(p[0]!)}" y2="${Y(p[1]!)}" class="e-arm"/>
      <line x1="${X(1)}" y1="${Y(1)}" x2="${X(p[2]!)}" y2="${Y(p[3]!)}" class="e-arm"/>
      <path d="${curvePath(p, X, Y)}" class="e-curve"/>
      <line x1="${W - 22}" y1="${Y(0)}" x2="${W - 22}" y2="${Y(1)}" class="e-lane"/>
      <circle class="e-ride" r="4"/><circle class="e-ball" cx="${W - 22}" r="6"/>
      <circle class="e-handle" data-h="0" cx="${X(p[0]!)}" cy="${Y(p[1]!)}" r="7"/>
      <circle class="e-handle" data-h="1" cx="${X(p[2]!)}" cy="${Y(p[3]!)}" r="7"/>
      ${p[1]! > 1 || p[3]! > 1 ? `<text x="${X(0.5)}" y="${Y(1) - 34}" class="e-note">overshoot</text>` : ""}`;
    pop.querySelector(".la-ease-text")!.textContent = bezText(p);
  };

  paint();
  editor = { svg, X, Y, get };

  const down = (e: PointerEvent) => {
    const h = (e.target as Element).closest<SVGElement>(".e-handle");

    if (!h) return;
    e.preventDefault();
    const which = Number(h.dataset.h);
    svg.setPointerCapture(e.pointerId);
    dragging = pop;

    const move = (ev: PointerEvent) => {
      const b = svg.getBoundingClientRect();
      const x = ((ev.clientX - b.left) / b.width) * W;
      const y = ((ev.clientY - b.top) / b.height) * H;
      const p = [...get()];
      p[which * 2] = Math.round(Math.max(0, Math.min(1, UX(x))) * 100) / 100;
      p[which * 2 + 1] = Math.round(Math.max(-0.8, Math.min(2.2, UY(y))) * 100) / 100;
      set(p);
      paint();
    };

    const up = () => {
      svg.removeEventListener("pointermove", move);
      dragging = null;
    };

    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up, { once: true });
  };

  svg.addEventListener("pointerdown", down);

  const outside = (e: PointerEvent) => {
    if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) easeClose?.();
  };

  const esc = (e: KeyboardEvent) => e.key === "Escape" && easeClose?.();
  setTimeout(() => document.addEventListener("pointerdown", outside));
  document.addEventListener("keydown", esc);
  easeClose = () => {
    pop.hidden = true;
    svg.removeEventListener("pointerdown", down);
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", esc);
    editor = null;
    easeClose = null;
    renderCode();
  };
};

let editor: {
  svg: SVGSVGElement;
  X: (u: number) => number;
  Y: (v: number) => number;
  get: () => number[];
} | null = null;

/** Horizontal drag on a token. Pointer capture keeps it going outside the token. */
const drag = (
  el: HTMLElement,
  h: {
    start: () => number;
    move: (v0: number, dx: number, dy: number, e: PointerEvent) => void;
    end: () => void;
  },
) => {
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const v0 = h.start();
    const x0 = e.clientX;
    const y0 = e.clientY;
    dragging = el;
    el.classList.add("is-dragging");
    root.classList.add("is-scrubbing");
    const move = (ev: PointerEvent) => h.move(v0, ev.clientX - x0, ev.clientY - y0, ev);

    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.classList.remove("is-dragging");
      root.classList.remove("is-scrubbing");
      dragging = null;
      h.end();
      renderCode();
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  });
};

const showHud = (el: HTMLElement, spec: Spec, v: number) => {
  const r = el.getBoundingClientRect();
  const host = root.getBoundingClientRect();
  hud.hidden = false;
  hud.style.left = `${r.left - host.left + r.width / 2}px`;
  hud.style.top = `${r.top - host.top}px`;

  const p = spec.values
    ? spec.values.indexOf(v) / (spec.values.length - 1)
    : (v - spec.min) / (spec.max - spec.min);

  hud.style.setProperty("--p", String(p));
  hud.querySelector(".la-hud-label")!.textContent = spec.label;
};

const hideHud = () => (hud.hidden = true);

// ----- compile loop

let busy = false;
let dirty = false;
let editedAt = 0;
const latencies: { compile: number; total: number }[] = [];

(window as unknown as { __labA: unknown }).__labA = { latencies, files: () => files };

const schedule = () => {
  editedAt = editedAt || performance.now();

  if (busy) {
    dirty = true;

    return;
  }

  void run();
};

const run = async () => {
  busy = true;
  dirty = false;
  const t0 = editedAt || performance.now();
  editedAt = 0;
  const els = findElements(source);
  const annotated = annotate(source, els);
  const result = await compileRaw(annotated);

  if (result.ok) {
    errorEl.hidden = true;
    root.classList.remove("has-error");
    await show(result.svg);
    latencies.push({ compile: result.ms, total: performance.now() - t0 });

    if (latencies.length > 400) latencies.shift();
    void stats(result.ms);
  } else {
    errorEl.hidden = false;
    errorEl.textContent = `${result.error.message} The picture shows the last file that compiled.`;
    root.classList.add("has-error");
  }

  busy = false;

  if (dirty) void run();
};

const withTime = (svg: string, t: number, pausedFrame: boolean) => {
  let out = svg.replace("<svg ", `<svg style="--t0:-${t.toFixed(3)}s" `);

  if (pausedFrame)
    out = out.replace(
      "<style><![CDATA[",
      "<style><![CDATA[\n.a{animation-play-state:paused!important}",
    );

  return out;
};

/** Swap the picture for a new file, starting it at the current moment so a drag never rewinds the loop. */
const paintImg = (t: number) =>
  new Promise<void>((resolve) => {
    const previous = url;
    url = svgUrl(withTime(lastSvg, t, paused));
    const next = new Image();
    next.onload = () => {
      img.src = url;

      if (!paused) origin = performance.now() - t * 1000;

      if (previous) URL.revokeObjectURL(previous);
      resolve();
    };

    next.onerror = () => resolve();
    next.src = url;
  });

const show = async (annotatedSvg: string) => {
  lastAnnotated = annotatedSvg;
  lastSvg = strip(annotatedSvg);
  files++;
  duration = Number(/\.a\{animation-duration:([\d.]+)s/.exec(lastSvg)?.[1] ?? 6) || 6;
  ghost.innerHTML = `<style>svg{display:block;inline-size:100%;block-size:auto}.a{animation-play-state:paused!important}</style>${annotatedSvg}`;
  const t = now() % duration;
  await paintImg(t);
  buildTimeline();
  const blob = new Blob([lastSvg], { type: "image/svg+xml" });

  if (download.href) URL.revokeObjectURL(download.href);
  download.href = URL.createObjectURL(blob);
};

const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`);

const gzip = async (text: string) => {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(s).arrayBuffer()).byteLength;
};

const stats = async (ms: number) => {
  const gz = await gzip(lastSvg);
  const recent = latencies.slice(-20);
  const avg = recent.reduce((s, l) => s + l.total, 0) / recent.length;
  statsEl.innerHTML = `<span><b>${bytes(gz)}</b> gzip</span><span><b>${bytes(new TextEncoder().encode(lastSvg).length)}</b> raw</span><span><b>${ms.toFixed(1)} ms</b> to compile</span><span><b>${avg.toFixed(0)} ms</b> drag to picture</span><span><b>${files}</b> ${files === 1 ? "file" : "files"} written</span>`;
};

// ----- timeline: read back from the compiled CSS, so it is the file's own clock

interface Bar {
  from: number;
  to: number;
  ease: number[] | null;
  line: number;
}

interface Row {
  cls: string;
  keys: string[];
  label: string;
  bars: Bar[];
}

let rows: Row[] = [];

const parseEase = (s: string | undefined): number[] | null => {
  if (!s) return null;
  const m = /cubic-bezier\(([^)]+)\)/.exec(s);

  if (m) return m[1]!.split(",").map(Number);

  if (s.trim() === "linear") return [0, 0, 1, 1];

  return null;
};

const buildTimeline = () => {
  const css = /<style><!\[CDATA\[([\s\S]*?)\]\]><\/style>/.exec(lastSvg)?.[1] ?? "";
  const defaultEase = parseEase(/\.a\{[^}]*animation-timing-function:([^;}]+)/.exec(css)?.[1]);
  const frames = new Map<string, { pct: number; value: string; ease?: string }[]>();

  for (const m of css.matchAll(/@keyframes (\w+)\{((?:[^{}]*\{[^}]*\})*)\}/g)) {
    const stops: { pct: number; value: string; ease?: string }[] = [];

    for (const s of m[2]!.matchAll(/([\d.%,]+)\{([^}]*)\}/g)) {
      const decl = s[2]!;
      const ease = /animation-timing-function:([^;]+)/.exec(decl)?.[1];
      const value = decl.replace(/;?animation-timing-function:[^;]+/, "");

      for (const p of s[1]!.split(",")) stops.push({ pct: parseFloat(p) / 100, value, ease });
    }

    stops.sort((a, b) => a.pct - b.pct);
    frames.set(m[1]!, stops);
  }

  const next: Row[] = [];

  for (const m of css.matchAll(/\.(m\d+)\{([^}]*)\}/g)) {
    const props = Object.fromEntries(m[2]!.split(";").map((d) => d.split(":") as [string, string]));
    const stops = frames.get(props["animation-name"] ?? "");

    if (!stops) continue;
    const period = Number(/([\d.]+)s/.exec(props["animation-duration"] ?? "")?.[1] ?? duration);
    const base = parseEase(props["animation-timing-function"]) ?? defaultEase;
    const els = [...ghost.querySelectorAll(`.${m[1]}`)];
    const keys = [...new Set(els.map((e) => e.closest("[data-l]")?.getAttribute("data-l") ?? ""))];
    const el = elements.find((e) => key(e) === keys[0]);
    const stepLines = el ? toLines(el) : [];
    const segs: Omit<Bar, "from" | "to">[] = [];
    const spans: [number, number][] = [];

    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i]!;
      const b = stops[i + 1]!;

      if (a.value === b.value || b.pct <= a.pct) continue;
      spans.push([a.pct * period, b.pct * period]);
      segs.push({
        ease: parseEase(a.ease) ?? base,
        line: stepLines[segs.length] ?? el?.open[0] ?? 0,
      });
    }

    const bars: Bar[] = [];

    for (let k = 0; k * period < duration - 1e-6; k++)
      spans.forEach(([f, t], i) =>
        bars.push({ from: f + k * period, to: t + k * period, ...segs[i]! }),
      );
    const same = next.filter((r) => r.keys[0] === keys[0]).length;
    next.push({ cls: m[1]!, keys, label: el ? rowName(el, same) : "?", bars });
  }

  rows = next;
  paintTimeline();
};

/** A row's name: what the element fills with, or its tag, numbered when a map() made copies of it. */
const rowName = (el: JsxElement, copy: number) => {
  const text = source
    .split("\n")
    .slice(el.open[0] - 1, el.open[1])
    .join("\n");

  const name = /fill=\{(\w+)\}/.exec(text)?.[1] ?? (el.tag === "g" ? "flower" : el.tag);
  const copies = elements.length && /Array\.from/.test(source) && el.tag === "g";

  return copies ? `${name} ${copy + 1}` : name;
};

/** The source line of each `.to(` inside an element's opening tag, in order. */
const toLines = (el: JsxElement) => {
  const lines = source.split("\n");
  const out: number[] = [];

  for (let n = el.open[0]; n <= el.open[1]; n++)
    for (const _ of lines[n - 1]!.matchAll(/\.to\(/g)) out.push(n);

  return out;
};

const paintTimeline = () => {
  const W = 1000;
  const RH = 22;
  const body = timeline.querySelector(".la-rows")!;
  body.replaceChildren();

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "la-row";
    row.dataset.keys = r.keys.join(" ");
    const lab = document.createElement("span");
    lab.className = "la-row-label";
    lab.textContent = r.label;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${RH}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("la-row-track");
    let inner = "";

    for (const b of r.bars) {
      const x0 = (b.from / duration) * W;
      const x1 = (b.to / duration) * W;
      const X = (u: number) => x0 + u * (x1 - x0);
      const Y = (v: number) => RH - 4 - v * (RH - 8);
      inner += `<g class="la-bar" data-line="${b.line}"><rect x="${x0}" y="3" width="${Math.max(1.5, x1 - x0)}" height="${RH - 6}" rx="3"/>${b.ease ? `<path d="${curvePath(b.ease, X, Y)}"/>` : ""}</g>`;
    }

    svg.innerHTML = inner;
    row.append(lab, svg);
    body.append(row);
  }

  const ticks = timeline.querySelector(".la-ticks")!;
  ticks.replaceChildren(
    ...Array.from({ length: Math.floor(duration) + 1 }, (_, s) => {
      const t = document.createElement("span");
      t.textContent = `${s}s`;
      t.style.setProperty("--x", String(s / duration));

      return t;
    }),
  );
};

// ----- linking: lines ↔ elements ↔ timeline rows

const linesFor = (keys: Iterable<string>) => {
  const out = new Set<number>();

  for (const k of keys) {
    const [a, b] = k.split("-").map(Number) as [number, number];

    for (let n = a; n <= b; n++) out.add(n);
  }

  return out;
};

/** Which elements a line of code shapes: its own element, the element a map() on it makes, or every element that uses the const it declares. */
const keysForLine = (n: number, depth = 0): Set<string> => {
  const text = source.split("\n")[n - 1] ?? "";
  const own = elements.filter((e) => n >= e.open[0] && n <= e.open[1]);

  if (own.length) return new Set(own.map(key));
  const decl = /const (\w+) =/.exec(text)?.[1];

  if (decl && depth < 2) {
    const out = new Set<string>();
    source.split("\n").forEach((l, i) => {
      if (i + 1 !== n && new RegExp(`\\b${decl}\\b`).test(l))
        for (const k of keysForLine(i + 1, depth + 1)) out.add(k);
    });

    return out;
  }

  if (/=>/.test(text)) {
    const inner = elements.find((e) => e.open[0] > n);

    return inner ? keysForLine(inner.open[0], depth) : new Set();
  }

  const around = elements
    .filter((e) => n >= e.full[0] && n <= e.full[1])
    .sort((a, b) => b.open[0] - a.open[0])[0];

  return around ? new Set([key(around)]) : new Set();
};

let hot = new Set<string>();
let hotStep = 0;

const setHot = (keys: Set<string>, lines: Set<number>, step = 0) => {
  hot = keys;
  hotStep = step;

  for (const l of codeEl.querySelectorAll<HTMLElement>(".la-line"))
    l.classList.toggle(
      "is-hot",
      lines.has(Number(l.dataset.line)) || step === Number(l.dataset.line),
    );

  for (const r of timeline.querySelectorAll<HTMLElement>(".la-row"))
    r.classList.toggle(
      "is-hot",
      r.dataset.keys!.split(" ").some((k) => keys.has(k)),
    );
  root.classList.toggle("is-linking", keys.size > 0);
};

codeEl.addEventListener("pointerover", (e) => {
  if (dragging) return;
  const line = (e.target as Element).closest<HTMLElement>(".la-line");

  if (!line) return;
  const n = Number(line.dataset.line);
  setHot(keysForLine(n), new Set([n]));
});

codeEl.addEventListener("pointerleave", () => !dragging && setHot(new Set(), new Set()));

stage.addEventListener("pointermove", (e) => {
  if (dragging) return;
  const hit = ghost.elementFromPoint(e.clientX, e.clientY)?.closest("[data-l]");
  const k = hit?.getAttribute("data-l");

  if (!k) return setHot(new Set(), new Set());
  // An element inside a group: the outermost animated part is what the eye picks out, so prefer the innermost element hit.
  setHot(new Set([k]), linesFor([k]));
});

stage.addEventListener("pointerleave", () => setHot(new Set(), new Set()));

timeline.addEventListener("pointerover", (e) => {
  if (dragging || scrubbing) return;
  const bar = (e.target as Element).closest<SVGGElement>(".la-bar");
  const row = (e.target as Element).closest<HTMLElement>(".la-row");

  if (!row) return;
  const keys = new Set(row.dataset.keys!.split(" "));
  setHot(keys, linesFor(keys), bar ? Number(bar.dataset.line) : 0);
});

timeline.addEventListener("pointerleave", () => !scrubbing && setHot(new Set(), new Set()));

// ----- clock: scrubbing the timeline pauses the file at that moment

let scrubbing = false;
const lanes = $(".la-lanes", root);

const seek = (e: PointerEvent) => {
  const b = timeline.querySelector(".la-ticks")!.getBoundingClientRect();
  pausedAt = Math.max(0, Math.min(duration - 0.001, ((e.clientX - b.left) / b.width) * duration));
  void paintImg(pausedAt);
};

lanes.addEventListener("pointerdown", (e) => {
  scrubbing = true;
  paused = true;
  lanes.setPointerCapture(e.pointerId);
  root.classList.add("is-paused");
  seek(e);
});

lanes.addEventListener("pointermove", (e) => scrubbing && seek(e));

lanes.addEventListener("pointerup", () => (scrubbing = false));

const setPaused = (p: boolean) => {
  if (p === paused) return;

  if (p) pausedAt = now();
  paused = p;
  root.classList.toggle("is-paused", p);
  void paintImg(p ? pausedAt : pausedAt);
};

playBtn.addEventListener("click", () => setPaused(!paused));

resetBtn.addEventListener("click", () => {
  source = initial;
  renderCode();
  schedule();
});

// ----- the frame loop: playhead, glyph dots, the ghost's clock, highlight boxes, lines that are playing

const tick = (ms: number) => {
  const t = now();
  playhead.style.setProperty("--x", String(t / duration));
  $(".la-time", root).textContent = `${t.toFixed(2)}s`;
  playBtn.textContent = paused ? "Play" : "Pause";

  const svg = ghost.querySelector("svg");

  if (svg) svg.style.setProperty("--t0", `-${t.toFixed(3)}s`);

  const u = ((ms / 1400) % 1.25) / 1.25;
  const ride = Math.min(1, u * 1.25);

  for (const entry of glyphs) {
    const { el, p } = entry;

    if (!el.isConnected) {
      glyphs.delete(entry);
      continue;
    }

    const dot = el.querySelector(".g-dot");
    dot?.setAttribute("cx", String(ride * 24));
    dot?.setAttribute("cy", String(18 - bez(p())(ride) * 18));
  }

  if (editor) {
    const f = bez(editor.get());
    const ridee = editor.svg.querySelector(".e-ride");
    ridee?.setAttribute("cx", String(editor.X(ride)));
    ridee?.setAttribute("cy", String(editor.Y(f(ride))));
    editor.svg.querySelector(".e-ball")?.setAttribute("cy", String(editor.Y(f(ride))));
  }

  // Highlight boxes follow the ghost copy, which sits paused at the same moment as the picture.
  const sb = stage.getBoundingClientRect();
  const want: DOMRect[] = [];

  if (hot.size)
    for (const k of hot)
      for (const el of ghost.querySelectorAll(`[data-l="${k}"]`)) {
        const r = el.getBoundingClientRect();

        if (r.width * r.height > 0) want.push(r);
      }

  while (boxes.children.length < want.length) boxes.append(document.createElement("i"));
  [...boxes.children].forEach((b, i) => {
    const r = want[i];
    const box = b as HTMLElement;
    box.hidden = !r;

    if (!r) return;
    const pad = 4;
    box.style.inset = `${r.top - sb.top - pad}px auto auto ${r.left - sb.left - pad}px`;
    box.style.inlineSize = `${r.width + pad * 2}px`;
    box.style.blockSize = `${r.height + pad * 2}px`;
  });

  // A step's line glows while its bar is under the playhead.
  const live = new Set<number>();

  for (const r of rows) for (const b of r.bars) if (t >= b.from && t < b.to) live.add(b.line);

  for (const l of codeEl.querySelectorAll<HTMLElement>(".la-line"))
    l.classList.toggle("is-live", live.has(Number(l.dataset.line)));

  for (const b of timeline.querySelectorAll<SVGGElement>(".la-bar"))
    b.classList.toggle("is-step", hotStep > 0 && Number(b.dataset.line) === hotStep);

  requestAnimationFrame(tick);
};

renderCode();

schedule();

requestAnimationFrame(tick);
