import type { ControlValue, Span } from "@svjeez/live";
import type { GroupedControl } from "../workspace.ts";
import { el, isNumber, isText, shown } from "./dom.ts";

/*
 * The card that opens over a literal in the code: for a use of a named constant, what it is and where it is defined;
 * for a literal nothing names, a button to name it. Naming asks for the name in the card itself.
 */

export interface CardHost {
  /** Scroll to where a control is defined, in this file. */
  readonly jump: (key: string) => void;
  /** Turn the literal into a constant of this name. */
  readonly name: (key: string, name: string) => void;
  /** Whether the file already uses this identifier. */
  readonly taken: (name: string) => boolean;
  /** Whether the control is defined in this file, so the card can jump to it. */
  readonly local: (key: string) => boolean;
}

const card = el("div", "tip");
let timer: number | undefined;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A constant's name for a signal's label: UPPER_SNAKE, and one the file does not use yet. */
export const suggestName = (label: string, taken: (name: string) => boolean): string => {
  const words = label
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .slice(-3);

  const base = (words.join("_").toUpperCase() || "VALUE").slice(0, 24);
  const name = /^\d/.test(base) ? "_" + base : base;
  let next = name;

  for (let n = 2; taken(next); n++) next = name + "_" + n;

  return next;
};

const isSpan = (value: ControlValue): value is Span =>
  typeof value === "object" && "start" in value;

const describe = (control: GroupedControl): string => {
  const { value } = control;

  if (isNumber(value)) return shown(value);

  if (isText(value)) return value.replace(/^ease\./, "");

  if (Array.isArray(value)) return value.map(shown).join(", ");

  if (isSpan(value)) return shown(value.start) + "s +" + shown(value.over) + "s";

  return String(value);
};

const place = (at: HTMLElement) => {
  const box = at.getBoundingClientRect();
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const left = Math.max(8, Math.min(box.left - 6, window.innerWidth - width - 8));
  const below = box.bottom + 6;
  const top = below + height > window.innerHeight - 8 ? box.top - height - 6 : below;

  card.style.left = left + "px";
  card.style.top = Math.max(8, top) + "px";
};

const close = () => {
  card.classList.remove("on");

  if (document.activeElement instanceof HTMLElement && card.contains(document.activeElement))
    document.activeElement.blur();
};

/** Closes the card, after a moment unless told to be quick, so the pointer can cross the gap to it. */
export const hideCard = (soon = false): void => {
  window.clearTimeout(timer);

  if (soon) close();
  else timer = window.setTimeout(close, 160);
};

const head = (control: GroupedControl, title: string) => {
  const row = el("div", "tip-head");

  if (control.kind === "color" && isText(control.value)) {
    const dot = el("i", "swatch");

    dot.style.setProperty("--c", control.value);
    row.append(dot);
  }

  row.append(el("span", "tip-title", title), el("span", "tip-value", describe(control)));

  return row;
};

const ask = (control: GroupedControl, at: HTMLElement, host: CardHost) => {
  const input = el("input", "tip-input");
  const hint = el("span", "tip-hint", "↵ to name it · esc");
  const meta = el("div", "tip-meta");

  input.spellcheck = false;
  input.autocomplete = "off";
  input.value = suggestName(control.label, host.taken);
  input.setAttribute("aria-label", "Name for " + control.label);
  meta.append(hint);

  const check = () => {
    const name = input.value;
    const bad = !IDENTIFIER.test(name) ? "Not a name" : host.taken(name) ? "Already used" : "";

    input.classList.toggle("bad", bad !== "");
    hint.textContent = bad || "↵ to name it · esc";
    hint.classList.toggle("bad", bad !== "");

    return bad === "";
  };

  input.addEventListener("input", check);
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();

    if (event.key === "Escape") hideCard(true);
    else if (event.key === "Enter" && check()) {
      hideCard(true);
      host.name(control.key, input.value);
    }
  });
  card.replaceChildren(head(control, "Name this value"), input, meta);
  place(at);
  input.focus();
  input.select();
};

/** Opens the card over a literal: for a use of a constant, or for a bare one; asking goes straight to naming it. */
export const showCard = (
  control: GroupedControl,
  use: boolean,
  at: HTMLElement,
  host: CardHost,
  asking: boolean,
): void => {
  window.clearTimeout(timer);

  if (!card.isConnected) {
    card.addEventListener("pointerenter", () => window.clearTimeout(timer));
    card.addEventListener("pointerleave", () => {
      if (!card.contains(document.activeElement)) hideCard();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!(event.target instanceof Element && event.target.closest(".tip"))) hideCard(true);
    });
    document.body.append(card);
  }

  card.classList.remove("on");

  if (asking) {
    card.classList.add("on");
    ask(control, at, host);

    return;
  }

  const meta = el("div", "tip-meta");

  if (use) {
    const file = control.sites[0]?.file.split("/").pop() ?? "";
    const where = file + (control.line === undefined ? "" : ":" + control.line);
    const uses = control.uses?.length ?? 0;
    const link = el("button", "tip-link", where);

    link.type = "button";
    link.disabled = !host.local(control.key);
    link.title = link.disabled ? "Defined in another file" : "Show where it is defined";
    link.addEventListener("click", () => {
      hideCard(true);
      host.jump(control.key);
    });
    meta.append(
      link,
      el("span", "tip-dim", "used in " + uses + (uses === 1 ? " place" : " places")),
    );
  } else {
    const name = el("button", "tip-name", "⤴ name it");

    name.type = "button";
    name.addEventListener("click", () => ask(control, at, host));
    meta.append(el("span", "tip-dim", "unnamed " + control.kind), name);
  }

  card.replaceChildren(head(control, control.label), meta);
  card.classList.add("on");
  place(at);
};
