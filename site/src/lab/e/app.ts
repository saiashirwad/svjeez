import { compilerFor, latestWins } from "../compiler";
import { $, $$, svgUrl } from "../util";
import { DURATION, H, W } from "./geometry";
import { layout, type Layout } from "./layout";
import {
  breed,
  certificate,
  FIRST,
  mutate,
  parseGenome,
  numberSpec,
  numericKey,
  random,
  specimenNo,
  taxon,
  withChoice,
  withGene,
  type NumericKey,
  type Genome,
} from "./genome";

const SHELF_SIZE = 18;
const STORE = "svjeez-lab-e-shelf";

// ---------- state ----------

let genome: Genome = FIRST;
let lay: Layout = layout(genome);
let lineage = "";
interface Specimen {
  readonly genome: Genome;
  readonly no: string;
  thumb?: string;
}
const shelf: Specimen[] = [];

const set = (next: Genome, opts: { lineage?: string; shelve?: boolean } = {}) => {
  genome = next;
  lay = layout(next);
  lineage = opts.lineage ?? "";
  paintCard();
  paintControls();
  paintOverlay();
  clearTimeout(settleTimer);
  request(next, !!opts.shelve);
  if (!opts.shelve) settle();
};

// ---------- compiling ----------

const compile = compilerFor<Genome>(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }), (genome) => ({ genome }));

const img = $<HTMLImageElement>("[data-stage]");
const statFile = $("[data-file]");
const statGzip = $("[data-gzip]");
const statMs = $("[data-ms]");
const save = $<HTMLAnchorElement>("[data-save]");
const errorBox = $("[data-error]");

const origin = performance.now();
const loopTime = () => (((performance.now() - origin) / 1000) % DURATION + DURATION) % DURATION;
const atTime = (svg: string, t: number) => svg.replace("<svg ", `<svg style="--t0:-${t.toFixed(3)}s" `);
/** A still of the file: CSS paused at t, the boiling SMIL removed. */
const still = (svg: string, t: number) =>
  atTime(svg, t)
    .replace("<style><![CDATA[", "<style><![CDATA[\n.a{animation-play-state:paused!important}")
    .replace(/<animate\b[^>]*\/>/g, "");

/** A genome to compile, and whether the shelf keeps it once it's drawn. */
interface Job {
  readonly genome: Genome;
  readonly shelve: boolean;
}
let lastKey = "";
let shown = "";
let saveUrl = "";

const show = (svg: string) =>
  new Promise<void>((resolve) => {
    const url = svgUrl(atTime(svg, loopTime()));
    const next = new Image();
    next.onload = next.onerror = () => {
      const old = shown;
      img.src = url;
      shown = url;
      if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
      resolve();
    };
    next.src = url;
  });

const draw = async ({ genome: g, shelve: keep }: Job) => {
  const result = await compile(g);
  if (result.ok) {
    await show(result.svg);
    const no = specimenNo(g);
    if (saveUrl) URL.revokeObjectURL(saveUrl);
    saveUrl = svgUrl(result.svg);
    save.href = saveUrl;
    save.download = `${taxon(g).split(" ").slice(0, 2).join("-").toLowerCase()}-${no}.svg`;
    statFile.textContent = `catoid-${no}.svg`;
    statGzip.textContent = `${(result.stats.gzip / 1024).toFixed(1)} KB gzip`;
    statMs.textContent = `${Math.round(result.ms)} ms`;
    errorBox.hidden = true;
    if (keep) shelve(g, result.svg);
  } else {
    errorBox.hidden = false;
    errorBox.textContent = result.error.message;
  }
};

const push = latestWins(draw);

const request = (g: Genome, shelve: boolean) => {
  const key = JSON.stringify(g);
  if (key === lastKey && !shelve) return;
  lastKey = key;
  push({ genome: g, shelve });
};

// Hand edits go on the shelf once they stop changing.
let settleTimer = 0;
const settle = () => {
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => request(genome, true), 1400);
};

// ---------- shelf ----------

const shelfList = $("[data-shelf]");

const persist = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(shelf.map((s) => s.genome)));
  } catch {}
};

const shelve = (g: Genome, svg?: string) => {
  const no = specimenNo(g);
  const found = shelf.findIndex((s) => s.no === no);
  const entry = found >= 0 ? shelf.splice(found, 1)[0]! : { genome: g, no };
  if (svg) {
    if (entry.thumb) URL.revokeObjectURL(entry.thumb);
    entry.thumb = svgUrl(still(svg, 1.4));
  }
  shelf.unshift(entry);
  for (const gone of shelf.splice(SHELF_SIZE)) if (gone.thumb) URL.revokeObjectURL(gone.thumb);
  persist();
  paintShelf();
};

const paintShelf = () => {
  const current = specimenNo(genome);
  shelfList.replaceChildren(
    ...shelf.map((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "le-jar";
      b.dataset.no = s.no;
      b.setAttribute("aria-label", `${taxon(s.genome)}, specimen ${s.no}`);
      if (s.no === current) b.setAttribute("aria-current", "true");
      const pic = document.createElement("img");
      pic.alt = "";
      pic.draggable = false;
      if (s.thumb) pic.src = s.thumb;
      const label = document.createElement("span");
      label.textContent = s.no;
      b.append(pic, label);
      jarDrag(b, s);
      li.append(b);
      return li;
    }),
  );
};

/** Restores shelved genomes from an earlier visit, compiling their thumbnails one by one. */
const restoreShelf = async () => {
  let saved: unknown = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {}
  for (const raw of Array.isArray(saved) ? saved.slice(0, SHELF_SIZE) : []) {
    const g = parseGenome(raw);
    if (!g) continue;
    const no = specimenNo(g);
    if (!shelf.some((s) => s.no === no)) shelf.push({ genome: g, no });
  }
  paintShelf();
  for (const s of [...shelf]) {
    if (s.thumb) continue;
    const r = await compile(s.genome);
    if (r.ok && !s.thumb && shelf.includes(s)) s.thumb = svgUrl(still(r.svg, 1.4));
  }
  paintShelf();
};

// ---------- the card ----------

const paintCard = () => {
  $("[data-no]").textContent = `No. ${specimenNo(genome)}`;
  $("[data-lineage]").textContent = lineage;
  $("[data-name]").textContent = taxon(genome);
  const cert = certificate(genome);
  const stamp = $("[data-stamp]");
  stamp.dataset.grade = String(cert.grade);
  $("[data-verdict]").textContent = cert.verdict;
  for (const part of ["heads", "ears", "eyes", "legs", "tails"] as const) {
    const n = part === "eyes" ? `${genome.eyes}${genome.bodyEyes ? `+${genome.bodyEyes}` : ""}` : String(genome[part]);
    $(`[data-count="${part}"]`).textContent = n;
    $<HTMLButtonElement>(`[data-less="${part}"]`).disabled = genome[part] === 0 && !(part === "eyes" && genome.bodyEyes);
  }
};

const restamp = () => $("[data-stamp]").animate(
  [{ transform: "rotate(-8deg) scale(1.6)", opacity: 0 }, { transform: "rotate(-4deg) scale(1)", opacity: 1 }],
  { duration: 260, easing: "cubic-bezier(.3,1.6,.5,1)" },
);

// ---------- drags ----------

/**
 * Follows the pointer that went down until it lifts or is cancelled. The listeners sit on the window, so a target that
 * is replaced or hidden mid-drag cannot strand the drag.
 */
const drag = (down: PointerEvent, h: { move?: (m: PointerEvent) => void; end?: (u: PointerEvent, cancelled: boolean) => void }) => {
  try {
    (down.currentTarget as Element).setPointerCapture(down.pointerId);
  } catch {
    // The pointer may be gone already; the window listeners carry the drag either way.
  }
  const move = (m: PointerEvent) => {
    if (m.pointerId === down.pointerId) h.move?.(m);
  };
  const finish = (cancelled: boolean) => (u: PointerEvent) => {
    if (u.pointerId !== down.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    h.end?.(u, cancelled);
  };
  const up = finish(false);
  const cancel = finish(true);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
};

/** A drag that carries a floating copy of `html` once the pointer moves `slop` px, at once when `slop` is 0. */
const carryDrag = (
  down: PointerEvent,
  o: { html: string; slop: number; over: (m: PointerEvent, lifted: boolean) => void; end: (u: PointerEvent, lifted: boolean) => void },
) => {
  let held: ReturnType<typeof carry> | undefined;
  const lift = (at: PointerEvent) => {
    held = carry(o.html, at);
    document.body.classList.add("le-carrying");
  };
  if (!o.slop) lift(down);
  drag(down, {
    move(m) {
      if (!held && Math.hypot(m.clientX - down.clientX, m.clientY - down.clientY) > o.slop) lift(m);
      held?.place(m);
      o.over(m, !!held);
    },
    end(u, cancelled) {
      held?.drop();
      document.body.classList.remove("le-carrying");
      showDrop(undefined);
      frame.classList.remove("le-mating");
      if (!cancelled) o.end(u, !!held);
    },
  });
};

// ---------- genes ----------

const UNITS: Partial<Record<NumericKey, (v: number) => string>> = {
  length: (v) => `${v.toFixed(1)} cats`,
  girth: (v) => `${v} px girth`,
  legLength: (v) => `${v.toFixed(2)}× legs`,
  tailLength: (v) => `${v.toFixed(2)}× tail`,
  slice: (v) => `w ${(v * 2 - 1).toFixed(2)}`,
  oidness: (v) => `${Math.round(v * 100)}% ${genome.oid}`,
  ink: (v) => (v < 0.05 ? "steady line" : `${v.toFixed(1)} boil`),
};

const paintControls = () => {
  for (const b of $$<HTMLButtonElement>("[data-gene]")) {
    const on = String(Reflect.get(genome, b.dataset.gene ?? "")) === b.dataset.value;
    b.setAttribute("aria-checked", String(on));
  }
  for (const b of $$<HTMLButtonElement>("[data-scrub]")) {
    const key = numericKey(b.dataset.scrub);
    const v = genome[key];
    const { min, max } = numberSpec(key);
    b.textContent = UNITS[key]?.(v) ?? String(v);
    b.style.setProperty("--p", String((v - min) / (max - min)));
    b.disabled = (key === "slice" && genome.dimension !== "4d") || (key === "oidness" && genome.oid === "cat");
  }
};

for (const b of $$<HTMLButtonElement>("[data-gene]"))
  b.addEventListener("click", () => {
    set(withChoice(genome, b.dataset.gene, b.dataset.value));
    restamp();
  });

/** Drag a value sideways; arrow keys step it. */
for (const b of $$<HTMLButtonElement>("[data-scrub]")) {
  const key = numericKey(b.dataset.scrub);
  const { min, max, step } = numberSpec(key);
  b.addEventListener("pointerdown", (e) => {
    if (b.disabled) return;
    const v0 = genome[key];
    drag(e, { move: (m) => set(withGene(genome, key, v0 + ((m.clientX - e.clientX) / 160) * (max - min))) });
  });
  b.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    set(withGene(genome, key, genome[key] + d * Math.max(step, (max - min) / 40)));
  });
}

$("[data-mutate]").addEventListener("click", () => {
  const m = mutate(genome);
  set(m.genome, { shelve: true, lineage: m.tooFar ? "mutated too far" : "" });
  restamp();
  if (m.tooFar) frame.animate([{ rotate: "0deg" }, { rotate: "-2deg" }, { rotate: "1.5deg" }, { rotate: "0deg" }], { duration: 380 });
});
$("[data-dice]").addEventListener("click", () => {
  set(random(), { shelve: true });
  restamp();
});
const breedWith = (other: Specimen) => {
  const parent = specimenNo(genome);
  set(breed(genome, other.genome), { shelve: true, lineage: `${parent} × ${other.no}` });
  restamp();
};
$("[data-breed]").addEventListener("click", () => {
  const current = specimenNo(genome);
  const mates = shelf.filter((s) => s.no !== current);
  breedWith(mates.length ? mates[Math.floor(Math.random() * Math.min(mates.length, 5))]! : { genome: random(), no: "wild" });
});

// ---------- the stage overlay: stretch the body, add and remove parts ----------

const frame = $("[data-frame]");
const overlay = $<SVGSVGElement>("[data-overlay]");
const NS = "http://www.w3.org/2000/svg";
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element = overlay) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
};
const toScreen = (p: { x: number; y: number }) => ({ x: lay.ox + p.x * lay.scale, y: lay.oy + p.y * lay.scale });
const toCatoid = (p: { x: number; y: number }) => ({ x: (p.x - lay.ox) / lay.scale, y: (p.y - lay.oy) / lay.scale });
const viewPoint = (e: PointerEvent) => {
  const r = overlay.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
};

type Part = "heads" | "ears" | "eyes" | "legs" | "tails";

/** Where on the specimen a point lands: the nearest stretch of body, which side of it, and any head under it. */
const hitTest = (vp: { x: number; y: number }) => {
  const p = toCatoid(vp);
  let best = 0;
  let bestD = Infinity;
  lay.frames.forEach((f, i) => {
    const d = Math.hypot(f.p.x - p.x, f.p.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const f = lay.frames[best]!;
  const s = best / (lay.frames.length - 1);
  const belly = (p.x - f.p.x) * f.n.x + (p.y - f.p.y) * f.n.y > 0;
  const head = lay.orbit ? -1 : lay.heads.findIndex((h) => Math.hypot(h.at.x - p.x, h.at.y - p.y) < h.r * 1.4);
  return { s, belly, head, near: bestD < lay.G * 1.2 + 30 };
};

const addPart = (part: Part, vp?: { x: number; y: number }) => {
  const hit = vp ? hitTest(vp) : undefined;
  let g = genome;
  if (part === "heads") g = withGene(g, "heads", g.heads + 1);
  if (part === "ears") g = withGene(g, "ears", g.ears + 1);
  if (part === "eyes") g = hit && hit.head < 0 && hit.near ? withGene(g, "bodyEyes", g.bodyEyes + 1) : withGene(g, "eyes", g.eyes + 1);
  if (part === "legs") {
    const side = hit ? (hit.belly ? "belly" : "back") : g.legSide;
    g = withGene(g, "legs", g.legs + 1);
    g = withGene(g, "legSide", genome.legs === 0 || genome.legSide === side ? side : "both");
  }
  if (part === "tails") {
    g = withGene(g, "tails", g.tails + 1);
    if (hit) g = withGene(g, "tailAt", hit.s < 0.06 ? 0 : hit.s > 0.94 ? 1 : hit.s);
  }
  set(g);
};

const removePart = (part: Part, eyeOnBody = false) => {
  if (part === "eyes" && eyeOnBody) set(withGene(genome, "bodyEyes", genome.bodyEyes - 1));
  else set(withGene(genome, part, genome[part] - 1));
};

/** A floating copy of a part that follows the pointer while it's carried. */
const carry = (html: string, e: PointerEvent) => {
  const ghost = document.createElement("div");
  ghost.className = "le-ghost";
  ghost.innerHTML = html;
  document.body.append(ghost);
  const place = (m: PointerEvent) => ghost.style.setProperty("translate", `${m.clientX}px ${m.clientY}px`);
  place(e);
  return { place, drop: () => ghost.remove() };
};

const drop = el("circle", { r: 0, class: "le-drop" });
const showDrop = (vp: { x: number; y: number; inside: boolean } | undefined, part?: Part) => {
  if (!vp?.inside || !part) return drop.setAttribute("r", "0");
  const hit = hitTest(vp);
  const f = lay.frames[Math.round(hit.s * (lay.frames.length - 1))]!;
  const at = part === "heads" || part === "ears" || (part === "eyes" && hit.head >= 0) ? vp : toScreen(f.p);
  drop.setAttribute("cx", String(at.x));
  drop.setAttribute("cy", String(at.y));
  drop.setAttribute("r", String(Math.max(10, lay.G * lay.scale * 0.6)));
};

for (const b of $$<HTMLButtonElement>("[data-part]")) {
  const part = b.dataset.part as Part;
  const icon = b.querySelector("svg")!.outerHTML;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    carryDrag(e, {
      html: icon,
      slop: 6,
      over: (m) => showDrop(viewPoint(m), part),
      end: (u, lifted) => {
        if (!lifted) return addPart(part);
        const vp = viewPoint(u);
        if (vp.inside) addPart(part, vp);
      },
    });
  });
  b.addEventListener("click", (e) => {
    if (e.detail === 0) addPart(part);
  });
  b.addEventListener("keydown", (e) => {
    if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      removePart(part);
    }
  });
}

for (const b of $$<HTMLButtonElement>("[data-less]")) {
  const part = b.dataset.less as Part;
  b.addEventListener("click", () => removePart(part, part === "eyes" && genome.eyes === 0));
}

/** Grab handles over the drawn parts: carry one off the specimen to remove it, or to a new place on the body. */
const handles = el("g", {});
const bodyHit = el("path", { class: "le-body-hit" });
overlay.insertBefore(bodyHit, handles);

const paintOverlay = () => {
  const pts = lay.spine.map(toScreen);
  bodyHit.setAttribute("d", pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(""));
  bodyHit.setAttribute("stroke-width", String(Math.max(16, lay.G * lay.scale)));
  handles.replaceChildren();
  const handle = (part: Part, at: { x: number; y: number }, r: number, eyeOnBody = false) => {
    const p = toScreen(at);
    const c = el("circle", { cx: p.x, cy: p.y, r: Math.max(9, r * lay.scale), class: "le-handle" }, handles);
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      carryDrag(e, {
        html: $(`[data-part="${part}"] svg`).outerHTML,
        slop: 0,
        over: (m) => showDrop(viewPoint(m), part),
        end: (u) => {
          const vp = viewPoint(u);
          if (!vp.inside) return removePart(part, eyeOnBody);
          const hit = hitTest(vp);
          if (part === "tails") set(withGene(genome, "tailAt", hit.s < 0.06 ? 0 : hit.s > 0.94 ? 1 : hit.s));
          if (part === "legs") set(withGene(genome, "legSide", hit.belly ? "belly" : "back"));
        },
      });
    });
  };
  if (!lay.orbit) lay.heads.forEach((h) => handle("heads", h.at, h.r));
  lay.legs.forEach((l) => {
    const a = ((l.angle + 90) * Math.PI) / 180;
    handle("legs", { x: l.at.x + Math.cos(a) * l.length, y: l.at.y + Math.sin(a) * l.length }, l.width);
  });
  lay.tails.forEach((t) => {
    const a = ((t.angle - 90) * Math.PI) / 180;
    handle("tails", { x: t.at.x + Math.cos(a) * t.length, y: t.at.y + Math.sin(a) * t.length }, t.width * 1.4);
  });
  lay.bodyEyes.forEach((e) => handle("eyes", e, e.r, true));
};

// Drag the body: sideways stretches it, up and down fattens it.
bodyHit.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const from = genome;
  const px = overlay.getBoundingClientRect().width / W;
  const s0 = lay.scale;
  frame.classList.add("le-stretching");
  drag(e, {
    move(m) {
      const dx = (m.clientX - e.clientX) / px / s0;
      const dy = (m.clientY - e.clientY) / px / s0;
      let g = withGene(from, "length", from.length + (dx * 2) / 120);
      g = withGene(g, "girth", from.girth - dy * 0.5);
      if (g.length !== genome.length || g.girth !== genome.girth) set(g);
    },
    end(_, cancelled) {
      frame.classList.remove("le-stretching");
      if (!cancelled) restamp();
    },
  });
});

/** Carry a jar onto the stage to breed with it; click, or Enter on the focused jar, to bring it back. */
const jarDrag = (b: HTMLButtonElement, s: Specimen) => {
  const bringBack = () => {
    set(s.genome, { lineage: "from the shelf" });
    restamp();
  };
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    carryDrag(e, {
      html: `<img src="${s.thumb ?? ""}" alt="">`,
      slop: 8,
      over: (m, lifted) => frame.classList.toggle("le-mating", lifted && viewPoint(m).inside),
      end: (u, lifted) => {
        if (!lifted) return bringBack();
        if (viewPoint(u).inside && s.no !== specimenNo(genome)) breedWith(s);
      },
    });
  });
  b.addEventListener("click", (e) => {
    if (e.detail === 0) bringBack();
  });
};

paintShelf();
set(genome, { shelve: true });
void restoreShelf();
