import type { ControlValue, Span } from "@svjeez/live";
import type { GroupedControl, Mark } from "../workspace.ts";
import { hideCard, showCard } from "./card.ts";
import type { CardHost } from "./card.ts";
import { bezierOf, curveGlyph } from "./ease.ts";
import { tokenize } from "./highlight.ts";
import { el, escapeHtml, isBoolean, isNumber, isText } from "./dom.ts";

/*
 * The scene's file as the control surface: every literal a signal is written with can be turned where it stands.
 * Drag a number sideways, click a color's swatch, click an ease's curve, click a boolean, drag a point's crosshair.
 * The literal changes in place while the picture follows; letting go writes it to the file. A name the file reads a
 * value through (a constant, a field, a theme color) turns that value where it is defined, even in another file.
 * Named values are always marked; the many literals nothing names show only on the line under the pointer, or all
 * at once while ⌥ is held.
 */

export interface CodeHost {
  readonly preview: (key: string, value: ControlValue) => void;
  readonly commit: (key: string, value: ControlValue) => void;
  readonly dragging: (on: boolean) => void;
  /** A literal was clicked without dragging: show it in the inspector. */
  readonly select: (control: GroupedControl, at: HTMLElement) => void;
  /** Open the picker for a color or an ease, under `at`. */
  readonly pick: (control: GroupedControl, at: HTMLElement) => void;
  /** The pointer is over a literal, or left it. */
  readonly hover: (control: GroupedControl | undefined) => void;
  /** Turn a literal into a constant of this name. */
  readonly extract: (key: string, name: string) => void;
}

/** One literal in the file and the control that turns it, when the scene has one. */
interface Literal extends Omit<Mark, "use"> {
  readonly control?: GroupedControl;
  /** Which of its control's sites this is: 0, or 1 for a span's length or a point's y. */
  readonly site: number;
  /** A read of the control's name, not where its value is written. */
  readonly use: boolean;
}

const literalsOf = (marks: readonly Mark[], controls: readonly GroupedControl[]): Literal[] => {
  const byKey = new Map(
    controls.flatMap((control) =>
      control.group === "derived" ? [] : [[control.key, control] as const],
    ),
  );

  return [...marks]
    .sort((a, b) => a.from - b.from || b.to - a.to)
    .map((mark) => {
      const control = byKey.get(mark.key);

      const site = mark.use
        ? 0
        : (control?.sites.findIndex((each) => each.from === mark.from) ?? 0);

      return {
        ...mark,
        site: Math.max(0, site),
        use: mark.use === true,
        ...(control && { control }),
      };
    });
};

/** HTML for `text` from `from` to `to`, its tokens colored. */
const painted = (
  text: string,
  tokens: readonly { from: number; to: number; tone: string }[],
  from: number,
  to: number,
) => {
  let html = "";
  let at = from;

  for (const token of tokens) {
    if (token.to <= from) continue;

    if (token.from >= to) break;
    const start = Math.max(from, token.from);
    const end = Math.min(to, token.to);

    html +=
      escapeHtml(text.slice(at, start)) +
      '<span class="' +
      token.tone +
      '">' +
      escapeHtml(text.slice(start, end)) +
      "</span>";
    at = end;
  }

  return html + escapeHtml(text.slice(at, to));
};

/** Splits HTML made of flat spans at its newlines, closing every open span at the end of a line and reopening it on the next. */
const linesOf = (html: string): string[] => {
  const lines: string[] = [];
  const open: string[] = [];
  let line = "";

  for (const part of html.split(/(<[^>]+>|\n)/)) {
    if (part === "\n") {
      lines.push(line + "</span>".repeat(open.length));
      line = open.join("");
    } else {
      if (part.startsWith("</")) open.pop();
      else if (part.startsWith("<")) open.push(part);
      line += part;
    }
  }

  lines.push(line);

  return lines;
};

/** What a literal turns as: a point's numbers are numbers, and a name that reads a span or a text turns nothing. */
const kindOf = (control: GroupedControl | undefined, use: boolean): string => {
  if (!control) return "fixed";

  if (control.kind === "vec") return use ? "fixed" : "number";

  if (use && (control.kind === "span" || control.kind === "text")) return "fixed";

  return control.kind;
};

const literalHtml = (
  text: string,
  tokens: readonly { from: number; to: number; tone: string }[],
  literal: Literal,
): string => {
  const { control, use } = literal;
  const inside = painted(text, tokens, literal.from, literal.to);
  const kind = kindOf(control, use);

  const attrs =
    ' data-key="' +
    escapeHtml(literal.key).replaceAll('"', "&quot;") +
    '" data-site="' +
    literal.site +
    '" data-kind="' +
    kind +
    '" data-prom="' +
    (control?.prominence ?? "named") +
    '"';

  return '<span class="' + (use ? "lit use" : "lit") + '"' + attrs + ">" + inside + "</span>";
};

/** The file, a row per line with its number, and every literal a control turns wrapped so it can be turned. */
export const renderSource = (
  container: HTMLElement,
  text: string,
  marks: readonly Mark[],
  controls: readonly GroupedControl[],
): void => {
  const tokens = tokenize(text);
  const literals = literalsOf(marks, controls);
  let html = "";
  let at = 0;

  for (const literal of literals) {
    if (literal.from < at || text.slice(literal.from, literal.to).includes("\n")) continue;
    html += painted(text, tokens, at, literal.from) + literalHtml(text, tokens, literal);
    at = literal.to;
  }

  html += painted(text, tokens, at, text.length);
  const lines = linesOf(html);
  const width = String(lines.length).length;

  container.style.setProperty("--digits", String(Math.max(2, width)));
  container.innerHTML =
    '<div class="lines">' +
    lines
      .map(
        (line, i) =>
          '<div class="ln" data-n="' +
          (i + 1) +
          '"><span class="no">' +
          (i + 1) +
          '</span><span class="tx">' +
          (line || " ") +
          "</span></div>",
      )
      .join("") +
    "</div>";

  const byKey = new Map<string, GroupedControl>();
  const index = new Map<string, HTMLElement[]>();

  for (const literal of literals) if (literal.control) byKey.set(literal.key, literal.control);

  for (const node of container.querySelectorAll<HTMLElement>(".lit")) {
    const key = node.dataset["key"] ?? "";
    const control = byKey.get(key);
    const list = index.get(key);

    if (list) list.push(node);
    else index.set(key, [node]);

    if (control) decorate(node, control);
  }

  shown.set(container, { index, text, hot: [] });
};

/** What a rendered pane knows about itself: its literals by key, its text, and the ones lit now. */
interface Shown {
  readonly index: Map<string, HTMLElement[]>;
  readonly text: string;
  hot: HTMLElement[];
}

const shown = new WeakMap<HTMLElement, Shown>();

const isUse = (node: HTMLElement) => node.classList.contains("use");

const SWATCH_TITLE = "Pick a color";
const CURVE_TITLE = "Pick a curve";
const CROSS_TITLE = "Drag: across moves x, up and down moves y";

const SVG = "http://www.w3.org/2000/svg";

/** A crosshair: four ticks round a dot. */
const crossGlyph = (): SVGSVGElement => {
  const svg = document.createElementNS(SVG, "svg");
  const path = document.createElementNS(SVG, "path");

  svg.setAttribute("viewBox", "0 0 10 10");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("class", "glyph");
  path.setAttribute("d", "M5 .8V3M5 7V9.2M.8 5H3M7 5H9.2M5 5h0");
  svg.append(path);

  return svg;
};

/** Adds a color's swatch, an ease's curve or a point's crosshair in front of its literal. */
const decorate = (node: HTMLElement, control: GroupedControl) => {
  const deep = control.prominence === "deep" ? " deep" : "";
  const use = isUse(node);

  if (control.kind === "color" && isText(control.value)) {
    const swatch = el("button", "swatch" + deep);

    swatch.type = "button";
    swatch.style.setProperty("--c", control.value);
    swatch.title = SWATCH_TITLE;
    swatch.setAttribute("aria-label", SWATCH_TITLE + " for " + control.label);
    node.before(swatch);
  }

  if (control.kind === "ease" && isText(control.value)) {
    const curve = bezierOf(control.value);
    const button = el("button", "curve" + deep);

    button.type = "button";
    button.title = CURVE_TITLE;
    button.setAttribute("aria-label", CURVE_TITLE + " for " + control.label);

    if (curve) button.append(curveGlyph(curve, 14, "glyph"));
    node.before(button);
  }

  if (control.kind === "vec" && node.dataset["site"] === "0") {
    const cross = el("button", "cross" + deep);

    cross.type = "button";
    cross.title = CROSS_TITLE;
    cross.setAttribute("aria-label", "Move " + control.label);
    cross.append(crossGlyph());
    node.before(cross);
  }

  if (use || deep) return;

  node.title =
    control.kind === "number" || control.kind === "span" || control.kind === "vec"
      ? control.label + " · drag sideways · ⌥ finer · ⇧ coarser"
      : control.kind === "boolean"
        ? control.label + " · click to flip"
        : control.label;
};

const decimalsOf = (text: string): number => {
  const dot = text.indexOf(".");

  return dot === -1 ? 0 : text.length - dot - 1;
};

const snap = (value: number, step: number): number => {
  const places = Math.max(0, Math.ceil(-Math.log10(step)));

  return Number((Math.round(value / step) * step).toFixed(places));
};

/** A number written as finely as its step, or as finely as it was written, whichever is finer. */
const written = (value: number, was: string, step: number): string =>
  value.toFixed(Math.min(6, Math.max(decimalsOf(was), decimalsOf(String(step)))));

const isSpan = (value: ControlValue): value is Span =>
  typeof value === "object" && "start" in value;

/** The number at one site of a control: the value, a span's start or length, or a point's x or y. */
const numberAt = (control: GroupedControl, site: number): number | undefined => {
  const { value } = control;

  if (isNumber(value)) return value;

  if (isSpan(value)) return site === 1 ? value.over : value.start;

  if (Array.isArray(value)) return value[site === 1 ? 1 : 0];

  return undefined;
};

const withNumber = (value: ControlValue, site: number, next: number): ControlValue => {
  if (isSpan(value)) return site === 1 ? { ...value, over: next } : { ...value, start: next };

  if (Array.isArray(value)) return site === 1 ? [value[0] ?? 0, next] : [next, value[1] ?? 0];

  return next;
};

/** One number a drag turns: where it started, how fast the pointer moves it, and which way. */
interface Axis {
  readonly site: number;
  readonly from: number;
  readonly was: string;
  readonly step: number;
  readonly rate: number;
  readonly min: number;
  readonly max: number;
  readonly vertical: boolean;
  value: number;
  text: string;
}

const axisOf = (control: GroupedControl, site: number, vertical: boolean): Axis | undefined => {
  const from = numberAt(control, site);

  if (from === undefined) return undefined;
  const was = control.sites[site]?.text ?? String(from);
  const point = control.kind === "vec";
  const guess = { min: 0, max: Math.max(point ? 10 : 1, Math.abs(from) * 2), step: 0.01 };
  const range = control.range ?? guess;
  const step = control.kind === "span" ? 0.01 : point ? 10 ** -decimalsOf(was) : range.step;

  const rate = point
    ? Math.max(step / 4, guess.max / 500)
    : Math.max(step / 4, (range.max - range.min) / 240);

  return {
    site,
    from,
    was,
    step,
    rate,
    min: range.min,
    max: range.max,
    vertical,
    value: from,
    text: was,
  };
};

/** The floating readout over a literal while it is dragged: its name, its value and where it sits in its range. */
const hud = el("div", "hud");
const hudName = el("span", "hud-name");
const hudValue = el("span", "hud-value");
const hudTrack = el("span", "hud-track");
const hudFill = el("i");

hudTrack.append(hudFill);

hud.append(hudName, hudValue, hudTrack);

const showHud = (node: HTMLElement, name: string, value: string, fraction: number | undefined) => {
  if (!hud.isConnected) document.body.append(hud);
  const box = node.getBoundingClientRect();

  hudName.textContent = name;
  hudValue.textContent = value;
  hudTrack.hidden = fraction === undefined;
  hudFill.style.width = Math.max(0, Math.min(1, fraction ?? 0)) * 100 + "%";
  hud.style.left = box.left + box.width / 2 + "px";
  hud.style.top = box.top - 8 + "px";
  hud.classList.add("on");
};

const hideHud = () => hud.classList.remove("on");

/** Writes a literal's text in place, keeping its color and the quotes it was written with. */
const setText = (lit: HTMLElement, text: string) => {
  const tone = lit.childElementCount === 1 ? lit.firstElementChild : null;
  const node = tone ?? lit;
  const was = node.textContent ?? "";
  const quote = /^["'`]/.exec(was)?.[0];

  node.textContent = quote && !text.startsWith(quote) ? quote + text + quote : text;
};

/** Shows a value where it is written: every literal of the key at that site, never a name that reads it. */
const paint = (container: HTMLElement, key: string, site: number, text: string) => {
  for (const node of shown.get(container)?.index.get(key) ?? [])
    if (!isUse(node) && node.dataset["site"] === String(site)) setText(node, text);
};

/** Wires the pane once; every render after reuses it, finding its control by the literal's key. */
export const wireSource = (
  container: HTMLElement,
  controlOf: (key: string) => GroupedControl | undefined,
  host: CodeHost,
): void => {
  const nodesOf = (key: string) => shown.get(container)?.index.get(key) ?? [];

  const cardHost: CardHost = {
    jump: (key) => {
      const def = nodesOf(key).find((node) => !isUse(node));

      if (def) flash(container, def);
    },
    name: host.extract,
    taken: (name) =>
      new RegExp("\\b" + name.replaceAll("$", "\\$") + "\\b").test(
        shown.get(container)?.text ?? "",
      ),
    local: (key) => nodesOf(key).some((node) => !isUse(node)),
  };

  const target = (event: Event) => {
    const node = event.target instanceof Element ? event.target : null;
    const lit = node?.closest<HTMLElement>(".lit");
    const extra = node?.closest<HTMLElement>(".swatch, .curve, .cross");

    const owner =
      lit ?? (extra?.nextElementSibling instanceof HTMLElement ? extra.nextElementSibling : null);

    const control = owner ? controlOf(owner.dataset["key"] ?? "") : undefined;

    return owner && control ? { lit: owner, control, extra, use: isUse(owner) } : undefined;
  };

  let over: HTMLElement | undefined;
  let dwell: number | undefined;

  const stop = () => {
    window.clearTimeout(dwell);
    hideCard(true);
  };

  container.addEventListener("pointerover", (event) => {
    if (container.classList.contains("scrubbing")) return;
    const found = target(event);

    if (found?.lit === over) return;
    over = found?.lit;
    host.hover(found?.control);
    window.clearTimeout(dwell);

    if (!found || !(found.use || found.control.prominence === "deep")) {
      hideCard();

      return;
    }

    dwell = window.setTimeout(
      () => showCard(found.control, found.use, found.lit, cardHost, false),
      found.use ? 280 : 650,
    );
  });

  container.addEventListener("pointerleave", () => {
    over = undefined;
    window.clearTimeout(dwell);
    hideCard();
    host.hover(undefined);
  });

  container.addEventListener("scroll", stop, { passive: true });

  container.addEventListener("contextmenu", (event) => {
    const found = target(event);

    if (!found || found.control.prominence !== "deep") return;
    event.preventDefault();
    window.clearTimeout(dwell);
    showCard(found.control, false, found.lit, cardHost, true);
  });

  const peek = (event: KeyboardEvent) => container.classList.toggle("reveal", event.altKey);

  window.addEventListener("keydown", peek);
  window.addEventListener("keyup", peek);
  window.addEventListener("blur", () => container.classList.remove("reveal"));

  container.addEventListener("click", (event) => {
    const found = target(event);

    if (!found) return;
    const { control, lit, extra } = found;

    if (extra?.classList.contains("cross")) return;

    if (extra || control.kind === "color" || control.kind === "ease") {
      host.pick(control, extra ?? lit);

      return;
    }

    if (control.kind === "boolean" && isBoolean(control.value)) {
      paint(container, control.key, 0, String(!control.value));
      host.commit(control.key, !control.value);

      return;
    }

    if (control.kind === "text") host.select(control, lit);
  });

  container.addEventListener("pointerdown", (down) => {
    const found = target(down);

    if (!found || down.button !== 0) return;
    const { lit, control, extra, use } = found;
    const cross = extra?.classList.contains("cross") === true;

    if (extra && !cross) return;
    window.clearTimeout(dwell);
    hideCard(true);
    const site = Number(lit.dataset["site"] ?? 0);

    const axes = cross
      ? [axisOf(control, 0, false), axisOf(control, 1, true)]
      : use && control.kind !== "number"
        ? []
        : [axisOf(control, site, false)];

    if (axes.length === 0 || axes.some((axis) => !axis)) return;
    const turning = axes.flatMap((axis) => (axis ? [axis] : []));
    const grab = extra ?? lit;
    const only = turning.length === 1 ? turning[0] : undefined;
    const echoes = nodesOf(control.key).filter((node) => node !== lit);
    let moved = false;
    let changed = false;
    let value: ControlValue = control.value;

    down.preventDefault();
    grab.setPointerCapture(down.pointerId);

    const name =
      control.label +
      (control.kind === "span"
        ? site === 1
          ? " · length"
          : " · start"
        : control.kind === "vec" && !cross
          ? site === 1
            ? " · y"
            : " · x"
          : "");

    const show = () =>
      showHud(
        grab,
        name,
        turning.map((axis) => axis.text).join(", "),
        only && control.kind !== "span" && control.kind !== "vec"
          ? (only.value - only.min) / (only.max - only.min || 1)
          : undefined,
      );

    const move = (event: PointerEvent) => {
      const dx = event.clientX - down.clientX;
      const dy = event.clientY - down.clientY;

      if (!moved && Math.hypot(cross ? dx : dx, cross ? dy : 0) < 3) return;

      if (!moved) {
        moved = true;
        host.dragging(true);
        container.classList.add("scrubbing");
        container.dataset["scrub"] = cross ? "xy" : "x";
        grab.classList.add("dragging");

        for (const node of echoes) node.classList.add("echo");
      }

      const factor = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
      let next = value;
      let any = false;

      for (const axis of turning) {
        const fine = event.altKey ? axis.step / 10 : axis.step;
        let to = snap(axis.from + (axis.vertical ? dy : dx) * axis.rate * factor, fine);

        if (control.origin === "param") to = Math.min(axis.max, Math.max(axis.min, to));

        if (control.kind === "span") to = Math.max(axis.site === 1 ? 0.01 : 0, to);

        if (to === axis.value) continue;
        axis.value = to;
        axis.text = written(to, axis.was, fine);
        paint(container, control.key, axis.site, axis.text);
        any = true;
      }

      if (!any) return;
      changed = true;

      for (const axis of turning) next = withNumber(next, axis.site, axis.value);
      value = next;
      show();
      host.preview(control.key, value);
    };

    const up = () => {
      grab.removeEventListener("pointermove", move);
      hideHud();

      if (!moved) {
        host.select(control, lit);

        return;
      }

      container.classList.remove("scrubbing");
      delete container.dataset["scrub"];
      grab.classList.remove("dragging");

      for (const node of echoes) node.classList.remove("echo");
      host.dragging(false);

      if (changed) host.commit(control.key, value);
    };

    grab.addEventListener("pointermove", move);
    grab.addEventListener("pointerup", up, { once: true });
    grab.addEventListener("pointercancel", up, { once: true });
  });
};

/** Sets what a literal shows while a picker previews a value, and its swatch or curve with it. */
export const showLiteral = (container: HTMLElement, key: string, text: string): void => {
  for (const lit of shown.get(container)?.index.get(key) ?? []) {
    if (!isUse(lit)) setText(lit, text);
    const before = lit.previousElementSibling;

    if (before instanceof HTMLElement && before.classList.contains("swatch"))
      before.style.setProperty("--c", text);

    if (before instanceof HTMLElement && before.classList.contains("curve")) {
      const curve = bezierOf(text);

      if (curve) before.replaceChildren(curveGlyph(curve, 14, "glyph"));
    }
  }
};

/** Scrolls the pane, and only the pane, so the node sits in view. */
const reveal = (container: HTMLElement, node: HTMLElement, center: boolean) => {
  const top = node.offsetTop;
  const margin = 48;

  if (
    top < container.scrollTop + margin ||
    top > container.scrollTop + container.clientHeight - margin
  )
    container.scrollTo({
      top: center ? top - container.clientHeight / 2 : top - margin,
      behavior: "smooth",
    });
};

/** Scrolls to a literal and pulses it once. */
const flash = (container: HTMLElement, node: HTMLElement) => {
  const row = node.closest<HTMLElement>(".ln");

  if (row) reveal(container, row, true);
  node.classList.remove("flash");
  void node.offsetWidth;
  node.classList.add("flash");
  node.addEventListener("animationend", () => node.classList.remove("flash"), { once: true });
};

/** Lights the literals of these signals, and their lines. */
export const lightKeys = (
  container: HTMLElement,
  keys: readonly string[],
  scroll: boolean,
): void => {
  const here = shown.get(container);

  if (!here) return;

  for (const node of here.hot) {
    node.classList.remove("hot");
    node.closest(".ln")?.classList.remove("lit-line");
  }

  here.hot = keys.flatMap((key) => here.index.get(key) ?? []);

  for (const node of here.hot) {
    node.classList.add("hot");
    node.closest(".ln")?.classList.add("lit-line");
  }

  const first = here.hot.find((node) => !isUse(node)) ?? here.hot[0];
  const row = first?.closest<HTMLElement>(".ln");

  if (row && scroll) reveal(container, row, true);
};

/** Lights one line, a lane's, and scrolls to it. */
export const lightLine = (container: HTMLElement, line: number | undefined): void => {
  for (const row of container.querySelectorAll<HTMLElement>(".ln.hot")) row.classList.remove("hot");

  if (line === undefined) return;
  const row = container.querySelector<HTMLElement>('.ln[data-n="' + line + '"]');

  if (!row) return;
  row.classList.add("hot");
  reveal(container, row, true);
};
