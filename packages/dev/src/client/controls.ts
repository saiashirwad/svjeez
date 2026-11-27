import type { ControlValue, Span } from "@svjeez/live";
import type { GroupedControl } from "../workspace.ts";
import { el, shown } from "./dom.ts";

/** What a control asks of the page: show a value while dragging, keep one on release, and show where it lives. */
export interface Host {
  readonly preview: (key: string, value: ControlValue) => void;
  readonly commit: (key: string, value: ControlValue) => void;
  readonly focus: (control: GroupedControl, asked: boolean) => void;
  readonly dragging: (on: boolean) => void;
}

const EASES = ["ease.linear", "ease.in", "ease.out", "ease.inOut", "ease.pop"];

const TITLES: Readonly<Record<GroupedControl["group"], string>> = {
  derived: "Composed",
  const: "Constants",
  param: "Params",
  span: "Spans",
  prop: "Props",
};

const isNumber = (value: ControlValue): value is number => typeof value === "number";

const isString = (value: ControlValue): value is string => typeof value === "string";

const isBoolean = (value: ControlValue): value is boolean => typeof value === "boolean";

const isSpanValue = (value: ControlValue): value is Span =>
  typeof value === "object" && "start" in value;

const isPoint = (value: ControlValue): value is readonly [number, number] => Array.isArray(value);

const snap = (value: number, step: number): number => {
  const places = Math.max(0, Math.ceil(-Math.log10(step)));

  return Number((Math.round(value / step) * step).toFixed(places));
};

interface Scrub {
  readonly label: HTMLElement;
  readonly start: () => number;
  /** The value per pixel dragged. */
  readonly rate: number;
  readonly step: number;
  readonly clamp: (value: number) => number;
  readonly onValue: (value: number) => void;
  readonly onDone: (value: number) => void;
}

/**
 * Drag a label sideways to scrub its number, the way Inventing on Principle does: a pixel is a step of the range's
 * 240th part, Alt drags ten times finer and Shift ten times coarser.
 */
const scrubbable = (scrub: Scrub, host: Host) => {
  scrub.label.classList.add("scrub");
  scrub.label.title = "Drag sideways to scrub. Alt is finer, Shift is coarser.";

  scrub.label.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    scrub.label.setPointerCapture(down.pointerId);
    const from = scrub.start();
    let value = from;

    host.dragging(true);

    const move = (event: PointerEvent) => {
      const factor = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
      const step = event.altKey ? scrub.step / 10 : scrub.step;

      value = scrub.clamp(snap(from + (event.clientX - down.clientX) * scrub.rate * factor, step));
      scrub.onValue(value);
    };

    const up = () => {
      scrub.label.removeEventListener("pointermove", move);
      host.dragging(false);

      if (value !== from) scrub.onDone(value);
    };

    scrub.label.addEventListener("pointermove", move);
    scrub.label.addEventListener("pointerup", up, { once: true });
    scrub.label.addEventListener("pointercancel", up, { once: true });
  });
};

interface Field {
  readonly row: HTMLElement;
  readonly set: (value: number) => void;
}

/** A number as a label to scrub, a box to type in and a meter for where it sits in its range. */
const numberField = (
  label: string,
  value: number,
  range: { readonly min: number; readonly max: number; readonly step: number },
  strict: boolean,
  host: Host,
  onValue: (value: number) => void,
  onDone: (value: number) => void,
): Field => {
  const row = el("div", "control");
  const name = el("span", "label", label);
  const box = el("div", "value");
  const input = el("input");
  const meter = el("div", "meter");
  const fill = el("i");
  let current = value;

  input.type = "number";
  input.step = String(range.step);
  input.value = shown(value);
  meter.append(fill);
  box.append(input);
  row.append(name, box, meter);

  const set = (next: number) => {
    current = next;
    input.value = shown(next);
    fill.style.width =
      Math.max(0, Math.min(1, (next - range.min) / (range.max - range.min || 1))) * 100 + "%";
  };

  set(value);
  const clamp = (n: number) => (strict ? Math.min(range.max, Math.max(range.min, n)) : n);

  scrubbable(
    {
      label: name,
      start: () => current,
      rate: (range.max - range.min) / 240,
      step: range.step,
      clamp,
      onValue: (next) => {
        set(next);
        onValue(next);
      },
      onDone,
    },
    host,
  );

  input.addEventListener("change", () => {
    const next = Number(input.value);

    if (Number.isFinite(next)) onDone(clamp(next));
  });

  return { row, set };
};

const numberControl = (control: GroupedControl, value: number, host: Host): HTMLElement => {
  const range = control.range ?? { min: 0, max: Math.max(1, Math.abs(value) * 2), step: 0.01 };

  return numberField(
    control.label,
    value,
    range,
    control.origin === "param",
    host,
    (next) => host.preview(control.key, next),
    (next) => host.commit(control.key, next),
  ).row;
};

/** A span on one row: drag its name to move it, drag the arrow to stretch it, or type either number. */
const spanControl = (control: GroupedControl, value: Span, host: Host): HTMLElement => {
  const row = el("div", "control");
  const name = el("span", "label", control.label);
  const box = el("div", "value");
  const start = el("input");
  const stretch = el("span", "label", "↔");
  const over = el("input");
  const max = control.range?.max ?? Math.max(1, (value.start + value.over) * 2);
  let span = value;

  for (const [input, part] of [
    [start, "start"],
    [over, "over"],
  ] as const) {
    input.type = "number";
    input.step = "0.01";
    input.value = shown(value[part]);
    input.title = part;
    input.addEventListener("change", () => {
      const next = Number(input.value);

      if (Number.isFinite(next)) host.commit(control.key, { ...span, [part]: next });
    });
  }

  const drag = (label: HTMLElement, part: "start" | "over") =>
    scrubbable(
      {
        label,
        start: () => span[part],
        rate: max / 240,
        step: 0.01,
        clamp: (n) => Math.max(part === "over" ? 0.01 : 0, n),
        onValue: (next) => {
          span = { ...span, [part]: next };
          (part === "start" ? start : over).value = shown(next);
          host.preview(control.key, span);
        },
        onDone: () => host.commit(control.key, span),
      },
      host,
    );

  drag(name, "start");
  drag(stretch, "over");
  box.append(start, stretch, over);
  row.append(name, box);

  return row;
};

const colorControl = (
  control: GroupedControl,
  value: string,
  palette: readonly string[],
  host: Host,
): HTMLElement => {
  const row = el("div", "control");
  const box = el("div", "value");
  const picker = el("input");
  const hex = el("span", "dim", value);
  const picks = el("div", "picks");

  const long = /^#[0-9a-f]{3}$/i.test(value)
    ? "#" +
      value
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    : value.slice(0, 7);

  picker.type = "color";
  picker.value = long.toLowerCase();
  picker.title = "Pick a color";
  picker.addEventListener("input", () => {
    hex.textContent = picker.value;
    host.preview(control.key, picker.value);
  });
  picker.addEventListener("change", () => host.commit(control.key, picker.value));

  for (const color of palette) {
    if (color.toLowerCase() === value.toLowerCase()) continue;
    const swatch = el("button", "swatch");

    swatch.style.background = color;
    swatch.title = "Use " + color;
    swatch.addEventListener("mouseenter", () => host.preview(control.key, color));
    swatch.addEventListener("click", () => host.commit(control.key, color));
    picks.append(swatch);
  }

  box.append(hex, picker);
  row.append(el("span", "label", control.label), box);

  if (picks.childElementCount > 0) row.append(picks);

  return row;
};

const selectControl = (
  control: GroupedControl,
  value: string,
  options: readonly string[],
  host: Host,
): HTMLElement => {
  const row = el("div", "control");
  const select = el("select");

  for (const option of options.includes(value) ? options : [value, ...options]) {
    const item = el("option", "", option.replace(/^ease\./, ""));

    item.value = option;
    item.selected = option === value;
    select.append(item);
  }

  select.addEventListener("change", () => host.commit(control.key, select.value));
  row.append(el("span", "label", control.label), select);

  return row;
};

const booleanControl = (control: GroupedControl, value: boolean, host: Host): HTMLElement => {
  const row = el("div", "control");
  const box = el("input");

  box.type = "checkbox";
  box.checked = value;
  box.addEventListener("change", () => host.commit(control.key, box.checked));
  row.append(el("span", "label", control.label), box);

  return row;
};

const textControl = (control: GroupedControl, value: string, host: Host): HTMLElement => {
  const row = el("div", "control");
  const input = el("input");

  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => host.preview(control.key, input.value));
  input.addEventListener("change", () => host.commit(control.key, input.value));
  row.append(el("span", "label", control.label), input);

  return row;
};

/** Two numbers as one point: drag in the pad, x across and y down, over both ranges. */
const padControl = (
  control: GroupedControl,
  value: readonly [number, number],
  host: Host,
): HTMLElement => {
  const row = el("div", "control");
  const area = el("div", "pad");
  const dot = el("i");
  const readout = el("span", "dim");
  const x = control.x?.range ?? { min: 0, max: Math.max(1, value[0] * 2), step: 1 };
  const y = control.y?.range ?? { min: 0, max: Math.max(1, value[1] * 2), step: 1 };
  let point = value;

  const place = (next: readonly [number, number]) => {
    dot.style.left = ((next[0] - x.min) / (x.max - x.min || 1)) * 100 + "%";
    dot.style.top = ((next[1] - y.min) / (y.max - y.min || 1)) * 100 + "%";
    readout.textContent = shown(next[0]) + ", " + shown(next[1]);
  };

  place(value);
  area.append(dot);

  area.addEventListener("pointerdown", (down) => {
    area.setPointerCapture(down.pointerId);
    host.dragging(true);

    const at = (event: PointerEvent): readonly [number, number] => {
      const box = area.getBoundingClientRect();
      const u = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      const v = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));

      return [snap(x.min + u * (x.max - x.min), x.step), snap(y.min + v * (y.max - y.min), y.step)];
    };

    const move = (event: PointerEvent) => {
      point = at(event);
      place(point);
      host.preview(control.key, point);
    };

    move(down);
    area.addEventListener("pointermove", move);
    area.addEventListener(
      "pointerup",
      () => {
        area.removeEventListener("pointermove", move);
        host.dragging(false);
        host.commit(control.key, point);
      },
      { once: true },
    );
  });

  row.append(el("span", "label", control.label), readout, area);

  return row;
};

const controlOf = (
  control: GroupedControl,
  palette: readonly string[],
  host: Host,
): HTMLElement => {
  const { value } = control;

  if (control.kind === "pad" && isPoint(value)) return padControl(control, value, host);

  if (control.kind === "span" && isSpanValue(value)) return spanControl(control, value, host);

  if (isNumber(value)) return numberControl(control, value, host);

  if (isBoolean(value)) return booleanControl(control, value, host);

  if (!isString(value))
    return el("div", "control dim", control.label + ": " + JSON.stringify(value));

  if (control.kind === "color") return colorControl(control, value, palette, host);

  if (control.kind === "ease") return selectControl(control, value, EASES, host);

  if (control.options) return selectControl(control, value, control.options, host);

  return textControl(control, value, host);
};

/** Variants make sense for a control whose range a few values can stand for. */
export const sweeps = (control: GroupedControl): boolean =>
  control.kind !== "text" || control.options !== undefined;

/** The controls, grouped: composed ones first, then constants, params, spans and props. */
export const renderControls = (
  container: HTMLElement,
  controls: readonly GroupedControl[],
  host: Host,
): void => {
  const palette = [
    ...new Set(
      controls.flatMap((control) =>
        control.kind === "color" && isString(control.value) ? [control.value] : [],
      ),
    ),
  ];

  const groups = new Map<GroupedControl["group"], HTMLElement>();

  container.replaceChildren();

  if (controls.length === 0) {
    container.append(
      el("p", "empty", "No literal constants, params, spans or props to turn in this scene."),
    );

    return;
  }

  for (const control of controls) {
    let group = groups.get(control.group);

    if (!group) {
      group = el("section", "group");
      group.append(el("h2", "", TITLES[control.group]));
      groups.set(control.group, group);
      container.append(group);
    }

    const node = controlOf(control, palette, host);
    const line = control.line === undefined ? "" : " · line " + control.line;

    node.dataset["key"] = control.key;
    node.title =
      control.key + line + (control.from.length > 1 ? " · " + control.from.join(", ") : "");
    node.addEventListener("mouseenter", () => host.focus(control, false));
    node.addEventListener("focusin", () => host.focus(control, false));

    if (sweeps(control)) {
      const ask = el("button", "ghost", "Variants");

      ask.type = "button";
      ask.title = "Show the scene at five values across this control's range";
      ask.addEventListener("click", () => host.focus(control, true));
      node.querySelector(".value")?.append(ask);
    }

    group.append(node);
  }
};
