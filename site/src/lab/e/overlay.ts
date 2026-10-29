import { $ } from "../util";
import { carryDrag, drag } from "./drags";
import { hitTest, moveOnBody, removePart, toScreen, type Part } from "./edit";
import { withGene } from "./genome";
import { H, W, type Pt } from "./geometry";
import { restamp } from "./card";
import { set, state } from "./state";

export const frame = $("[data-frame]");
const overlay = $<SVGSVGElement>("[data-overlay]");
const NS = "http://www.w3.org/2000/svg";

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element = overlay) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
};

/** A pointer in the stage's 640×400 frame, and whether it is over the stage at all. */
export const viewPoint = (e: PointerEvent) => {
  const r = overlay.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
};

const drop = el("circle", { r: 0, class: "le-drop" });

/** The ring that shows where a carried part would land. No point, or one off the stage, hides it. */
export const showDrop = (vp: (Pt & { inside: boolean }) | undefined, part?: Part) => {
  const { lay } = state;
  if (!vp?.inside || !part) return drop.setAttribute("r", "0");
  const hit = hitTest(vp);
  const f = lay.frames[Math.round(hit.s * (lay.frames.length - 1))]!;
  const at = part === "heads" || part === "ears" || (part === "eyes" && hit.head >= 0) ? vp : toScreen(f.p);
  drop.setAttribute("cx", String(at.x));
  drop.setAttribute("cy", String(at.y));
  drop.setAttribute("r", String(Math.max(10, lay.G * lay.scale * 0.6)));
};

/** Grab handles over the drawn parts: carry one off the specimen to remove it, or to a new place on the body. */
const handles = el("g", {});
const bodyHit = el("path", { class: "le-body-hit" });
overlay.insertBefore(bodyHit, handles);

const addHandle = (part: Part, at: Pt, r: number, eyeOnBody = false) => {
  const { lay } = state;
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
        if (vp.inside) moveOnBody(part, vp);
        else removePart(part, eyeOnBody);
      },
      clear: () => showDrop(undefined),
    });
  });
};

export const paintOverlay = () => {
  const { lay } = state;
  const pts = lay.spine.map(toScreen);
  bodyHit.setAttribute("d", pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(""));
  bodyHit.setAttribute("stroke-width", String(Math.max(16, lay.G * lay.scale)));
  handles.replaceChildren();
  if (!lay.orbit) lay.heads.forEach((h) => addHandle("heads", h.at, h.r));
  lay.legs.forEach((l) => {
    const a = ((l.angle + 90) * Math.PI) / 180;
    addHandle("legs", { x: l.at.x + Math.cos(a) * l.length, y: l.at.y + Math.sin(a) * l.length }, l.width);
  });
  lay.tails.forEach((t) => {
    const a = ((t.angle - 90) * Math.PI) / 180;
    addHandle("tails", { x: t.at.x + Math.cos(a) * t.length, y: t.at.y + Math.sin(a) * t.length }, t.width * 1.4);
  });
  lay.bodyEyes.forEach((e) => addHandle("eyes", e, e.r, true));
};

// Drag the body: sideways stretches it, up and down fattens it.
bodyHit.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const from = state.genome;
  const px = overlay.getBoundingClientRect().width / W;
  const s0 = state.lay.scale;
  frame.classList.add("le-stretching");
  drag(e, {
    move(m) {
      const dx = (m.clientX - e.clientX) / px / s0;
      const dy = (m.clientY - e.clientY) / px / s0;
      let g = withGene(from, "length", from.length + (dx * 2) / 120);
      g = withGene(g, "girth", from.girth - dy * 0.5);
      if (g.length !== state.genome.length || g.girth !== state.genome.girth) set(g);
    },
    end(_, cancelled) {
      frame.classList.remove("le-stretching");
      if (!cancelled) restamp();
    },
  });
});
