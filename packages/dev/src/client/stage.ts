import type { GroupedControl, StateView } from "../workspace.ts";
import type { ControlValue } from "./api.ts";
import { el, isNumber, shown } from "./dom.ts";

/*
 * Handles over the picture: every point the scene is written with is a dot you can take hold of, and the radius of a
 * circle drawn around one is a dot on its ring. They sit at the signal's value in scene coordinates, so they stay
 * put while the animation plays and follow the picture when the stage is resized.
 */

/** What a handle asks of the page; the same things a control in the code asks. */
export interface StageHost {
  readonly preview: (key: string, value: ControlValue) => void;
  readonly commit: (key: string, value: ControlValue) => void;
  readonly dragging: (on: boolean) => void;
  readonly hover: (control: GroupedControl | undefined) => void;
  readonly select: (control: GroupedControl) => void;
  /** Back to the written scene, when a drag is cancelled. */
  readonly revert: () => void;
}

export interface Stage {
  /** Lays the handles out again: after a state, a preview, a resize. */
  readonly sync: () => void;
  /** Rebuilds them for a state. */
  readonly show: (view: StateView) => void;
  /** Pulses the handle of a signal the pointer is over in the code. */
  readonly echo: (key: string | undefined) => void;
}

type Point = readonly [number, number];

interface Dot {
  readonly control: GroupedControl;
  readonly node: HTMLElement;
  readonly readout: HTMLElement;
  /** A radius handle: the key of the point it is drawn around, and its ring. */
  readonly around?: { readonly key: string; readonly ring: SVGCircleElement };
}

/** A written constant that is a place in the picture, not an offset from one: `JELLIES[0].at`, `RAYS[2].pts[1]`. */
const PLACE = /^\w+\[\d+\](?:\.\w+)?(?:\[\d+\])?@\d+:\d+$/;

const isPlace = (control: GroupedControl) =>
  control.kind === "vec" &&
  control.group !== "derived" &&
  control.sites.length === 2 &&
  Array.isArray(control.value) &&
  (control.prominence !== "deep" || PLACE.test(control.key));

const places = (text: string) => text.split(".")[1]?.length ?? 0;

/** Decimals the literal is written with, or the range steps by, whichever is more: what a release can write. */
const precision = (control: GroupedControl, which: number) =>
  Math.min(
    10,
    Math.max(places(control.sites[which]?.text ?? ""), places(String(control.range?.step ?? 0))),
  );

const round = (value: number, at: number) => Number(value.toFixed(at));

const CIRCLE = /circle\(\s*$/;
const CLOSE = /^\s*\)/;
const TAG = /<[A-Z]\w*(?=[\s>/])/g;
const PLACED = /\b(offset|at)=\{(\w+)\}/;

/** The point a `circle(NAME)` is drawn around, when its element says so with `offset={POINT}` or `at={POINT}`. */
const centerOf = (
  control: GroupedControl,
  view: StateView,
  points: ReadonlyMap<string, GroupedControl>,
): GroupedControl | undefined => {
  const text = view.source ?? "";
  const file = view.file ?? "";

  for (const use of control.uses ?? []) {
    if (!use.file.endsWith(file) || !CIRCLE.test(text.slice(Math.max(0, use.from - 12), use.from)))
      continue;

    if (!CLOSE.test(text.slice(use.to, use.to + 8))) continue;
    const head = text.slice(0, use.from);
    const start = [...head.matchAll(TAG)].at(-1)?.index ?? 0;
    const end = text.indexOf("/>", use.to);
    const element = text.slice(start, end === -1 ? text.length : end);
    const placed = PLACED.exec(element);
    const point = placed?.[2] === undefined ? undefined : points.get(placed[2]);

    if (point && !(placed?.[1] === "at" && /\b(anchor|origin)=/.test(element))) return point;
  }

  return undefined;
};

const SVG = "http://www.w3.org/2000/svg";

const pointOf = (value: ControlValue): Point | undefined =>
  Array.isArray(value) && value.length === 2 ? [Number(value[0]), Number(value[1])] : undefined;

/** Hangs the handles on the stage, over whatever SVG `svg()` says it is showing. */
export const wireStage = (
  stage: HTMLElement,
  svg: () => SVGSVGElement | null,
  host: StageHost,
): Stage => {
  const layer = el("div", "handles");
  const rings = document.createElementNS(SVG, "svg");
  const dots: Dot[] = [];
  /** What a handle was last dragged to, until a newer state arrives with it written. */
  const live = new Map<string, { readonly value: ControlValue; readonly version: number }>();
  let version = 0;
  let angles = new Map<string, number>();

  rings.setAttribute("class", "rings");
  layer.append(rings);
  stage.append(layer);

  const valueOf = (control: GroupedControl) => live.get(control.key)?.value ?? control.value;

  /** The scene's place on screen: where its origin is, and pixels per scene unit. */
  const frame = () => {
    const art = svg();
    const box = art?.viewBox.baseVal;

    if (!art || !box || box.width === 0 || box.height === 0) return undefined;
    const shape = art.getBoundingClientRect();
    const around = stage.getBoundingClientRect();
    const scale = Math.min(shape.width / box.width, shape.height / box.height);

    if (!(scale > 0)) return undefined;

    return {
      scale,
      x:
        shape.left -
        around.left -
        stage.clientLeft +
        (shape.width - box.width * scale) / 2 -
        box.x * scale,
      y:
        shape.top -
        around.top -
        stage.clientTop +
        (shape.height - box.height * scale) / 2 -
        box.y * scale,
    };
  };

  const textOf = (dot: Dot) => {
    const value = valueOf(dot.control);
    const point = pointOf(value);

    return point ? point.map(shown).join(", ") : isNumber(value) ? shown(value) : "";
  };

  const place = () => {
    const at = frame();

    layer.hidden = at === undefined;

    if (!at) return;
    const byKey = new Map(dots.map((dot) => [dot.control.key, dot]));

    for (const dot of dots) {
      let x = 0;
      let y = 0;

      if (dot.around) {
        const owner = byKey.get(dot.around.key)?.control ?? dot.control;
        const center = pointOf(valueOf(owner)) ?? [0, 0];

        const radius = Number(valueOf(dot.control)) * at.scale;
        const angle = angles.get(dot.control.key) ?? -Math.PI / 4;
        const cx = at.x + center[0] * at.scale;
        const cy = at.y + center[1] * at.scale;

        x = cx + radius * Math.cos(angle);
        y = cy + radius * Math.sin(angle);
        dot.around.ring.setAttribute("cx", String(cx));
        dot.around.ring.setAttribute("cy", String(cy));
        dot.around.ring.setAttribute("r", String(radius));
      } else {
        const point = pointOf(valueOf(dot.control)) ?? [0, 0];

        x = at.x + point[0] * at.scale;
        y = at.y + point[1] * at.scale;
      }

      dot.node.style.left = x.toFixed(2) + "px";
      dot.node.style.top = y.toFixed(2) + "px";
      dot.node.classList.toggle("below", y < 44);
      dot.readout.textContent = textOf(dot);
    }
  };

  /** Takes hold of a handle: moves it by the pointer, previews as it goes, writes when it is let go. */
  const grab = (dot: Dot, down: PointerEvent) => {
    const { control, node } = dot;
    const at = frame();

    if (down.button !== 0 || !at) return;
    down.preventDefault();
    down.stopPropagation();
    node.setPointerCapture(down.pointerId);
    node.classList.add("dragging");
    layer.classList.add("busy");
    host.dragging(true);

    const from = valueOf(control);
    const start = pointOf(from);
    const radius = isNumber(from);
    const around = dot.around?.key;
    let rx = start?.[0] ?? Number(from);
    let ry = start?.[1] ?? 0;
    let value: ControlValue = from;
    let last = { x: down.clientX, y: down.clientY };
    let moved = false;

    const center = (): Point => {
      const owner = dots.find((each) => each.control.key === around)?.control;

      return (owner && pointOf(valueOf(owner))) ?? [0, 0];
    };

    const distance = (event: { clientX: number; clientY: number }) => {
      const origin = stage.getBoundingClientRect();
      const [cx = 0, cy = 0] = center();
      const dx = event.clientX - origin.left - stage.clientLeft - at.x - cx * at.scale;
      const dy = event.clientY - origin.top - stage.clientTop - at.y - cy * at.scale;

      return { r: Math.hypot(dx, dy) / at.scale, angle: Math.atan2(dy, dx) };
    };

    let away = radius ? distance(down).r : 0;

    const move = (event: PointerEvent) => {
      const factor = event.altKey ? 0.1 : 1;

      if (radius) {
        const now = distance(event);
        const snapped = event.shiftKey ? 5 : 0;

        rx = Math.max(0, rx + (now.r - away) * factor);
        away = now.r;
        angles.set(control.key, now.angle);
        value = round(snapped ? Math.round(rx / snapped) * snapped : rx, precision(control, 0));
      } else if (start) {
        rx += ((event.clientX - last.x) / at.scale) * factor;
        ry += ((event.clientY - last.y) / at.scale) * factor;
        const along = Math.abs(rx - start[0]) >= Math.abs(ry - start[1]);
        const x = event.shiftKey && !along ? start[0] : rx;
        const y = event.shiftKey && along ? start[1] : ry;

        value = [round(x, precision(control, 0)), round(y, precision(control, 1))];
      }

      last = { x: event.clientX, y: event.clientY };

      if (JSON.stringify(value) === JSON.stringify(valueOf(control))) return;
      moved = true;
      live.set(control.key, { value, version });
      place();
      host.preview(control.key, value);
    };

    const done = (event: PointerEvent) => {
      node.removeEventListener("pointermove", move);
      node.releasePointerCapture(down.pointerId);
      node.classList.remove("dragging");
      layer.classList.remove("busy");
      host.dragging(false);

      if (event.type === "pointercancel") {
        live.delete(control.key);
        host.revert();
      } else if (moved) host.commit(control.key, value);
      else host.select(control);
    };

    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", done, { once: true });
    node.addEventListener("pointercancel", done, { once: true });
  };

  let centers = new Map<string, GroupedControl>();

  const show = (view: StateView) => {
    if (view.version > version) live.clear();
    version = view.version;
    angles = view.file === shownFile ? angles : new Map();
    shownFile = view.file;
    centers = new Map(view.controls.filter(isPlace).map((control) => [control.label, control]));

    for (const dot of dots) dot.node.remove();
    rings.replaceChildren();
    dots.length = 0;

    const add = (control: GroupedControl, around?: GroupedControl) => {
      const node = el("div", "handle" + (around ? " radius" : ""));
      const tag = el("span", "tag");
      const value = el("b");
      const ring = around ? document.createElementNS(SVG, "circle") : undefined;

      const dot: Dot = {
        control,
        node,
        readout: value,
        ...(around && ring && { around: { key: around.key, ring } }),
      };

      node.dataset["key"] = control.key;
      tag.append(el("span", "", control.label), value);
      node.append(tag);
      node.addEventListener("pointerdown", (down) => grab(dot, down));
      node.addEventListener("pointerenter", () => {
        node.classList.add("over");
        ring?.classList.add("on");
        host.hover(control);
      });
      node.addEventListener("pointerleave", () => {
        node.classList.remove("over");
        ring?.classList.remove("on");
        host.hover(undefined);
      });

      if (ring) {
        ring.dataset["key"] = control.key;
        rings.append(ring);
      }

      layer.append(node);
      dots.push(dot);
    };

    for (const control of centers.values()) add(control);

    for (const control of view.controls) {
      if (control.kind !== "number" || control.group === "derived" || control.prominence === "deep")
        continue;
      const around = centerOf(control, view, centers);

      if (around) add(control, around);
    }

    place();
  };

  let shownFile: string | undefined;

  const echo = (key: string | undefined) => {
    for (const dot of dots) {
      const on = key !== undefined && dot.control.key === key;

      dot.node.classList.toggle("echo", on);
      dot.around?.ring.classList.toggle("on", on);
    }
  };

  new ResizeObserver(place).observe(stage);

  const alt = (event: KeyboardEvent) => stage.classList.toggle("alt", event.altKey);

  document.addEventListener("keydown", alt);
  document.addEventListener("keyup", alt);
  window.addEventListener("blur", () => stage.classList.remove("alt"));
  stage.addEventListener("pointerenter", place);

  return { sync: place, show, echo };
};
