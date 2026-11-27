import type { ControlValue } from "@svjeez/live";
import type { GroupedControl } from "../workspace.ts";
import { NAMED, bezierOf, bezierText, curveGlyph, curvePath } from "./ease.ts";
import type { Bezier } from "./ease.ts";
import { el } from "./dom.ts";

/*
 * The small pickers a literal opens: colors, with the scene's other colors to hand, and curves, with the named ones
 * and a bezier to drag. Each previews as it is turned and writes the file when a value is chosen.
 */

export interface PickerHost {
  readonly preview: (key: string, value: ControlValue) => void;
  readonly commit: (key: string, value: ControlValue) => void;
  /** Back to what the file says: the picker closed without choosing. */
  readonly revert: () => void;
  /** Show this text in the literal while it previews. */
  readonly show: (key: string, text: string) => void;
}

let current: { readonly node: HTMLElement; readonly close: (keep: boolean) => void } | undefined;

/** Closes the open picker. Without `keep`, a value it previewed is taken back. */
export const closePicker = (keep = false): void => {
  current?.close(keep);
};

const open = (anchor: HTMLElement, node: HTMLElement, onClose: (kept: boolean) => void) => {
  closePicker();
  document.body.append(node);
  const box = anchor.getBoundingClientRect();
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const below = box.bottom + 6 + height < innerHeight;

  node.style.left = Math.max(8, Math.min(innerWidth - width - 8, box.left - 8)) + "px";
  node.style.top = (below ? box.bottom + 6 : Math.max(8, box.top - height - 6)) + "px";
  requestAnimationFrame(() => node.classList.add("on"));

  const outside = (event: PointerEvent) => {
    if (
      event.target instanceof Node &&
      !node.contains(event.target) &&
      !anchor.contains(event.target)
    )
      close(false);
  };

  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close(false);
  };

  const close = (kept: boolean) => {
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", escape, true);
    node.remove();
    current = undefined;
    onClose(kept);
  };

  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", escape, true);
  current = { node, close };
};

const head = (control: GroupedControl, value: string) => {
  const top = el("div", "pop-head");
  const sub = el("span", "pop-value", value);

  top.append(el("span", "pop-title", control.label), sub);

  return { top, sub };
};

const longHex = (value: string): string =>
  /^#[0-9a-f]{3}$/i.test(value)
    ? "#" + Array.from(value.slice(1), (c) => c + c).join("")
    : value.slice(0, 7);

/** A color: the system picker, the hex to type, and the scene's other colors. */
export const pickColor = (
  anchor: HTMLElement,
  control: GroupedControl,
  palette: readonly string[],
  host: PickerHost,
): void => {
  const value = String(control.value);
  const node = el("div", "pop");
  const { top, sub } = head(control, value);
  const row = el("div", "pop-color");
  const input = el("input");
  const hex = el("input", "pop-hex");
  const swatches = el("div", "pop-swatches");
  let previewed = false;
  let chosen = value;

  input.type = "color";
  input.value = longHex(value).toLowerCase();
  input.setAttribute("aria-label", "Color");
  hex.type = "text";
  hex.value = value;
  hex.spellcheck = false;
  hex.setAttribute("aria-label", "Hex");
  row.append(input, hex);

  const try_ = (next: string) => {
    previewed = true;
    chosen = next;
    sub.textContent = next;
    host.show(control.key, next);
    host.preview(control.key, next);
  };

  const keep = (next: string) => {
    chosen = next;
    closePicker(true);
  };

  input.addEventListener("input", () => {
    hex.value = input.value;
    try_(input.value);
  });
  input.addEventListener("change", () => keep(input.value));
  hex.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex.value))
      keep(hex.value);
  });

  for (const color of palette) {
    const swatch = el("button", "pop-swatch");

    swatch.type = "button";
    swatch.style.setProperty("--c", color);
    swatch.title = color;
    swatch.setAttribute("aria-current", String(color.toLowerCase() === value.toLowerCase()));
    swatch.addEventListener("pointerenter", () => try_(color));
    swatch.addEventListener("click", () => keep(color));
    swatches.append(swatch);
  }

  node.append(top, row);

  if (palette.length > 1) node.append(el("div", "pop-label", "In this scene"), swatches);

  open(anchor, node, (kept) => {
    if (kept && chosen !== value) host.commit(control.key, chosen);
    else if (previewed) host.revert();
  });
};

const SVG = "http://www.w3.org/2000/svg";

const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG, tag);

  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);

  return node;
};

/** An ease: the named curves, and a bezier whose two handles you drag. */
export const pickEase = (anchor: HTMLElement, control: GroupedControl, host: PickerHost): void => {
  const value = String(control.value);
  const node = el("div", "pop pop-ease");
  const { top, sub } = head(control, value.replace(/^ease\./, ""));
  const presets = el("div", "pop-presets");
  const size = 168;
  const pad = 28;
  const span = size - pad * 2;
  let points: Bezier = bezierOf(value) ?? [0.25, 0.1, 0.25, 1];
  let chosen = value;
  let previewed = false;

  const editor = svgEl("svg", {
    viewBox: "0 0 " + size + " " + size,
    class: "pop-editor",
    width: String(size),
    height: String(size),
  });

  const frame = svgEl("rect", {
    x: String(pad),
    y: String(pad),
    width: String(span),
    height: String(span),
    class: "box",
  });

  const diagonal = svgEl("path", {
    d: "M" + pad + " " + (pad + span) + "L" + (pad + span) + " " + pad,
    class: "diag",
  });

  const arms = [svgEl("line", { class: "arm" }), svgEl("line", { class: "arm" })];
  const curve = svgEl("path", { class: "line", transform: "translate(" + pad + " " + pad + ")" });

  const handles = [
    svgEl("circle", { r: "5", class: "handle" }),
    svgEl("circle", { r: "5", class: "handle" }),
  ];

  editor.append(frame, diagonal, ...arms, curve, ...handles);

  const at = (x: number, y: number) => [pad + x * span, pad + (1 - y) * span] as const;

  const draw = () => {
    curve.setAttribute("d", curvePath(points, span, span));
    const ends = [at(0, 0), at(1, 1)];

    for (const i of [0, 1]) {
      const [hx, hy] = at(points[i * 2] ?? 0, points[i * 2 + 1] ?? 0);
      const [ex, ey] = ends[i] ?? [0, 0];

      handles[i]?.setAttribute("cx", String(hx));
      handles[i]?.setAttribute("cy", String(hy));
      arms[i]?.setAttribute("x1", String(ex));
      arms[i]?.setAttribute("y1", String(ey));
      arms[i]?.setAttribute("x2", String(hx));
      arms[i]?.setAttribute("y2", String(hy));
    }
  };

  const try_ = (text: string) => {
    previewed = true;
    chosen = text;
    sub.textContent = text.replace(/^ease\./, "");
    host.show(control.key, text);
    host.preview(control.key, text);

    for (const button of presets.children)
      button.setAttribute(
        "aria-current",
        String(button instanceof HTMLElement && button.dataset["value"] === text),
      );
  };

  for (const [name, curvePoints] of NAMED) {
    const button = el("button", "pop-preset");

    button.type = "button";
    button.dataset["value"] = name;
    button.setAttribute("aria-current", String(name === value));
    button.append(
      curveGlyph(curvePoints, 28, "glyph"),
      el("span", "", name.replace(/^ease\./, "")),
    );
    button.addEventListener("pointerenter", () => {
      points = curvePoints;
      draw();
      try_(name);
    });
    button.addEventListener("click", () => {
      chosen = name;
      closePicker(true);
    });
    presets.append(button);
  }

  for (const [i, handle] of handles.entries())
    handle.addEventListener("pointerdown", (down) => {
      down.preventDefault();
      handle.setPointerCapture(down.pointerId);
      const box = editor.getBoundingClientRect();
      const scale = size / box.width;

      const move = (event: PointerEvent) => {
        const x = Math.max(0, Math.min(1, ((event.clientX - box.left) * scale - pad) / span));

        const y = Math.max(
          -0.5,
          Math.min(1.5, 1 - ((event.clientY - box.top) * scale - pad) / span),
        );

        const next: [number, number, number, number] = [...points];

        next[i * 2] = Math.round(x * 100) / 100;
        next[i * 2 + 1] = Math.round(y * 100) / 100;
        points = next;
        draw();
        try_(bezierText(points));
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener(
        "pointerup",
        () => {
          handle.removeEventListener("pointermove", move);
          closePicker(true);
        },
        { once: true },
      );
    });

  draw();
  node.append(top, presets, editor, el("div", "pop-hint", "Drag a handle to shape the curve."));
  open(anchor, node, (kept) => {
    if (kept && chosen !== value) host.commit(control.key, chosen);
    else if (previewed) host.revert();
  });
};
