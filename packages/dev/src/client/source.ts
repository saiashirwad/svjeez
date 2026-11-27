import type { ControlValue, Span } from "@svjeez/live";
import type { GroupedControl, Mark } from "../workspace.ts";
import { bezierOf, curveGlyph } from "./ease.ts";
import { tokenize } from "./highlight.ts";
import { el, escapeHtml, isBoolean, isNumber, isText } from "./dom.ts";

/*
 * The scene's file as the control surface: every literal a signal is written with can be turned where it stands.
 * Drag a number sideways, click a color's swatch, click an ease's curve, click a boolean. The literal changes in
 * place while the picture follows; letting go writes it to the file.
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
}

/** One literal in the file and the control that turns it, when the scene has one. */
interface Literal extends Mark {
  readonly control?: GroupedControl;
  /** Which of its control's sites this is: 0, or 1 for a span's length. */
  readonly site: number;
}

const literalsOf = (marks: readonly Mark[], controls: readonly GroupedControl[]): Literal[] => {
  const byKey = new Map(
    controls.flatMap((control) =>
      control.group === "derived" ? [] : [[control.key, control] as const],
    ),
  );

  return [...marks]
    .sort((a, b) => a.from - b.from)
    .map((mark) => {
      const control = byKey.get(mark.key);
      const site = control?.sites.findIndex((each) => each.from === mark.from) ?? 0;

      return { ...mark, site: Math.max(0, site), ...(control && { control }) };
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

const literalHtml = (
  text: string,
  tokens: readonly { from: number; to: number; tone: string }[],
  literal: Literal,
): string => {
  const { control } = literal;
  const inside = painted(text, tokens, literal.from, literal.to);
  const kind = control?.kind ?? "fixed";

  const attrs =
    ' data-key="' +
    escapeHtml(literal.key).replaceAll('"', "&quot;") +
    '" data-site="' +
    literal.site +
    '" data-kind="' +
    kind +
    '"';

  return '<span class="lit"' + attrs + ">" + inside + "</span>";
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

  for (const literal of literals) if (literal.control) byKey.set(literal.key, literal.control);

  for (const node of container.querySelectorAll<HTMLElement>(".lit")) {
    const control = byKey.get(node.dataset["key"] ?? "");

    if (control) decorate(node, control);
  }
};

const SWATCH_TITLE = "Pick a color";
const CURVE_TITLE = "Pick a curve";

/** Adds a color's swatch or an ease's curve in front of its literal. */
const decorate = (node: HTMLElement, control: GroupedControl) => {
  if (control.kind === "color" && isText(control.value)) {
    const swatch = el("button", "swatch");

    swatch.type = "button";
    swatch.style.setProperty("--c", control.value);
    swatch.title = SWATCH_TITLE;
    swatch.setAttribute("aria-label", SWATCH_TITLE + " for " + control.label);
    node.before(swatch);
  }

  if (control.kind === "ease" && isText(control.value)) {
    const curve = bezierOf(control.value);
    const button = el("button", "curve");

    button.type = "button";
    button.title = CURVE_TITLE;
    button.setAttribute("aria-label", CURVE_TITLE + " for " + control.label);

    if (curve) button.append(curveGlyph(curve, 14, "glyph"));
    node.before(button);
  }

  node.title =
    control.kind === "number" || control.kind === "span"
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

/** The number at one site of a control: the value, or a span's start or length. */
const numberAt = (control: GroupedControl, site: number): number | undefined => {
  const { value } = control;

  if (isNumber(value)) return value;

  if (isSpan(value)) return site === 1 ? value.over : value.start;

  return undefined;
};

const withNumber = (control: GroupedControl, site: number, next: number): ControlValue => {
  const { value } = control;

  if (isSpan(value)) return site === 1 ? { ...value, over: next } : { ...value, start: next };

  return next;
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

/** Wires the pane once; every render after reuses it, finding its control by the literal's key. */
export const wireSource = (
  container: HTMLElement,
  controlOf: (key: string) => GroupedControl | undefined,
  host: CodeHost,
): void => {
  const target = (event: Event) => {
    const node = event.target instanceof Element ? event.target : null;
    const lit = node?.closest<HTMLElement>(".lit");
    const extra = node?.closest<HTMLElement>(".swatch, .curve");

    const owner =
      lit ?? (extra?.nextElementSibling instanceof HTMLElement ? extra.nextElementSibling : null);

    const control = owner ? controlOf(owner.dataset["key"] ?? "") : undefined;

    return owner && control ? { lit: owner, control, extra } : undefined;
  };

  container.addEventListener("pointerover", (event) => {
    const found = target(event);

    host.hover(found?.control);
  });

  container.addEventListener("pointerleave", () => host.hover(undefined));

  container.addEventListener("click", (event) => {
    const found = target(event);

    if (!found) return;
    const { control, lit, extra } = found;

    if (extra || control.kind === "color" || control.kind === "ease") {
      host.pick(control, extra ?? lit);

      return;
    }

    if (control.kind === "boolean" && isBoolean(control.value)) {
      setText(lit, String(!control.value));
      host.commit(control.key, !control.value);

      return;
    }

    if (control.kind === "text") host.select(control, lit);
  });

  container.addEventListener("pointerdown", (down) => {
    const found = target(down);

    if (!found || found.extra || down.button !== 0) return;
    const { lit, control } = found;
    const site = Number(lit.dataset["site"] ?? 0);
    const from = numberAt(control, site);

    if (from === undefined) return;
    down.preventDefault();
    lit.setPointerCapture(down.pointerId);
    const range = control.range ?? { min: 0, max: Math.max(1, Math.abs(from) * 2), step: 0.01 };
    const step = control.kind === "span" ? 0.01 : range.step;
    const rate = Math.max(step / 4, (range.max - range.min) / 240);
    const was = lit.textContent ?? String(from);
    const strict = control.origin === "param";
    let value = from;
    let moved = false;

    const show = () =>
      showHud(
        lit,
        control.label + (control.kind === "span" ? (site === 1 ? " · length" : " · start") : ""),
        lit.textContent ?? "",
        control.kind === "span" ? undefined : (value - range.min) / (range.max - range.min || 1),
      );

    const move = (event: PointerEvent) => {
      const dx = event.clientX - down.clientX;

      if (!moved && Math.abs(dx) < 3) return;

      if (!moved) {
        moved = true;
        host.dragging(true);
        container.classList.add("scrubbing");
        lit.classList.add("dragging");
      }

      const factor = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
      const fine = event.altKey ? step / 10 : step;
      let next = snap(from + dx * rate * factor, fine);

      if (strict) next = Math.min(range.max, Math.max(range.min, next));

      if (control.kind === "span") next = Math.max(site === 1 ? 0.01 : 0, next);

      if (next === value) return;
      value = next;
      setText(lit, written(value, was, fine));
      show();
      host.preview(control.key, withNumber(control, site, value));
    };

    const up = () => {
      lit.removeEventListener("pointermove", move);
      hideHud();

      if (!moved) {
        host.select(control, lit);

        return;
      }

      container.classList.remove("scrubbing");
      lit.classList.remove("dragging");
      host.dragging(false);

      if (value !== from) host.commit(control.key, withNumber(control, site, value));
    };

    lit.addEventListener("pointermove", move);
    lit.addEventListener("pointerup", up, { once: true });
    lit.addEventListener("pointercancel", up, { once: true });
  });
};

/** Writes a literal's text in place, keeping its color and the quotes it was written with. */
const setText = (lit: HTMLElement, text: string) => {
  const tone = lit.childElementCount === 1 ? lit.firstElementChild : null;
  const node = tone ?? lit;
  const was = node.textContent ?? "";
  const quote = /^["'`]/.exec(was)?.[0];

  node.textContent = quote && !text.startsWith(quote) ? quote + text + quote : text;
};

/** Sets what a literal shows while a picker previews a value, and its swatch or curve with it. */
export const showLiteral = (container: HTMLElement, key: string, text: string): void => {
  for (const lit of container.querySelectorAll<HTMLElement>(
    '.lit[data-key="' + CSS.escape(key) + '"]',
  )) {
    setText(lit, text);
    const before = lit.previousElementSibling;

    if (before instanceof HTMLElement && before.classList.contains("swatch"))
      before.style.setProperty("--c", text);

    if (before instanceof HTMLElement && before.classList.contains("curve")) {
      const curve = bezierOf(text);

      if (curve) before.replaceChildren(curveGlyph(curve, 14, "glyph"));
    }
  }
};

/** Scrolls the pane, and only the pane, so `node` sits in view. */
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

/** Lights the literals of these signals, and their lines. */
export const lightKeys = (
  container: HTMLElement,
  keys: readonly string[],
  scroll: boolean,
): void => {
  let first: HTMLElement | undefined;

  for (const lit of container.querySelectorAll<HTMLElement>(".lit")) {
    const on = keys.includes(lit.dataset["key"] ?? "");

    lit.classList.toggle("hot", on);
    first = first ?? (on ? lit : undefined);
  }

  for (const row of container.querySelectorAll<HTMLElement>(".ln.lit-line"))
    row.classList.remove("lit-line");

  for (const lit of container.querySelectorAll<HTMLElement>(".lit.hot"))
    lit.closest(".ln")?.classList.add("lit-line");

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
