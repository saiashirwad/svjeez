import { loopLength, seek } from "svjeez/page";
import type { GroupedControl, Preview, StateView, Variant } from "../workspace.ts";
import { api, isError } from "./api.ts";
import type { ControlValue } from "./api.ts";
import type { Span } from "@svjeez/live";
import { renderControls, sweeps } from "./controls.ts";
import type { Host } from "./controls.ts";
import { aspectOf, byId, el, isNumber, isText, mount, scoped, shown } from "./dom.ts";
import { closePicker, pickColor, pickEase } from "./picker.ts";
import type { PickerHost } from "./picker.ts";
import { lightKeys, lightLine, renderSource, showLiteral, wireSource } from "./source.ts";
import type { CodeHost } from "./source.ts";
import { renderTimeline, showTime } from "./timeline.ts";
import type { TimelineHost } from "./timeline.ts";

/*
 * The page: the scene's file on the left, every literal in it a control; the picture, its timeline and its frames on
 * the right. A gesture previews while it lasts and becomes an edit to the file when it ends.
 */

const FRAMES = 6;

const title = byId("title");
const status = byId("status");
const statusText = byId("status-text");
const layout = byId("layout");
const scenesBox = byId("scenes");
const stage = byId("stage");
const art = byId("art");
const badge = byId("badge");
const toggle = byId("toggle");
const clock = byId("clock");
const clockTotal = byId("clock-total");
const loopNote = byId("loop-note");
const errorBox = byId("error");
const errorText = byId("error-text");
const warnings = byId("warnings");
const filmstrip = byId("filmstrip");
const timeline = byId("timeline");
const timelineNote = byId("timeline-note");
const source = byId("source");
const filename = byId("filename");
const codeNote = byId("code-note");
const reset = byId("reset");
const undoButton = byId("undo");
const redoButton = byId("redo");
const log = byId("log");
const controls = byId("controls");
const composedBox = byId("composed-box");
const inspector = byId("inspector");
const inspectTitle = byId("inspect-title");
const inspectControl = byId("inspect-control");
const inspectClose = byId("inspect-close");
const variantsTitle = byId("variants-title");
const variants = byId("variants");
const acrossBox = byId("across");
const statsText = byId("stats-text");
const download = byId("download");

const filterInput = document.querySelector<HTMLInputElement>("#filter");

if (!filterInput) throw new Error("The page has no #filter.");

const filter = filterInput;

let state: StateView | undefined;
let duration = 1;
let rate = 1;
let time = 0;
let playing = true;
let loop = true;
let last = performance.now();
let held = false;
let stale = false;
let epoch = 0;
let shownSource = "";
let selected: string | undefined;
let across = false;
let dragToPicture: number | undefined;
let gesture: number | undefined;

const STAGE_CSS =
  ":host { display: grid; justify-items: center; width: 100% } svg { display: block; max-width: 100%; max-height: min(44vh, 520px); width: auto; height: auto; border-radius: 4px; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.06), 0 2px 10px -2px rgb(0 0 0 / 0.12) }";

const FRAME_CSS =
  ":host { display: block; width: 100% } svg { display: block; width: 100%; height: 100% }";

const PLAY =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4c0 .4.4.6.7.4l6.6-4.2c.3-.2.3-.6 0-.8L3.7 1.4c-.3-.2-.7 0-.7.4z"/></svg>Play';

const PAUSE =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="1.5" width="2.5" height="9" rx="0.8"/><rect x="7" y="1.5" width="2.5" height="9" rx="0.8"/></svg>Pause';

let current: SVGSVGElement | null = null;

const showClock = () => {
  clock.textContent = time.toFixed(2) + "s";
  showTime(timeline, time, duration);

  for (const [i, frame] of [...filmstrip.children].entries())
    frame.classList.toggle("now", Math.abs(frameTime(i) - time) < duration / FRAMES / 2);
};

const frameTime = (i: number) => (loop ? (duration * i) / FRAMES : (duration * i) / (FRAMES - 1));

const play = () => {
  if (!loop && time >= duration) time = 0;
  playing = true;
  toggle.innerHTML = PAUSE;
  last = performance.now();

  if (!current) return;
  seek(time, current);

  for (const animation of current.getAnimations({ subtree: true })) animation.play();
  current.unpauseAnimations();
};

const pause = () => {
  playing = false;
  toggle.innerHTML = PLAY;

  if (current) seek(time, current);
};

const jump = (at: number) => {
  time = Math.max(0, Math.min(at, duration));
  pause();
  showClock();

  if (!across) seekStrip(variants, time);
};

const tick = (now: number) => {
  if (playing) {
    const next = time + ((now - last) * rate) / 1000;

    time = loop ? next % duration : Math.min(duration, next);

    if (!loop && time === duration) pause();
    showClock();
  }

  last = now;
  requestAnimationFrame(tick);
};

toggle.addEventListener("click", () => (playing ? pause() : play()));

/** Puts an SVG on the stage at the current time, playing or paused as before. */
const showSvg = (svg: string) => {
  current = mount(art, svg, STAGE_CSS);
  rate = Number(current?.getAttribute("data-playback-rate")) || 1;

  if (playing) play();
  else pause();
};

/** A small copy of an SVG, frozen at `at`. Its ids are its own, so it cannot borrow another copy's paint. */
const still = (svg: string, prefix: string, at: number, label: string, onClick: () => void) => {
  const frame = el("button", "frame");
  const holder = el("div");

  frame.type = "button";
  mount(holder, scoped(svg, prefix), FRAME_CSS);
  frame.style.setProperty("--aspect", String(aspectOf(svg)));
  frame.append(holder, el("span", "", label));
  frame.addEventListener("click", onClick);
  frame.dataset["at"] = String(at);

  return frame;
};

const seekStrip = (strip: HTMLElement, at?: number) => {
  for (const frame of strip.querySelectorAll<HTMLElement>(".frame")) {
    const svg = frame.firstElementChild?.shadowRoot?.querySelector("svg");

    if (svg) seek(at ?? Number(frame.dataset["at"]), svg);
  }
};

/** Six moments of the scene side by side: the whole of its time at once. Click one to go there. */
const showFrames = (svg: string) => {
  filmstrip.replaceChildren(
    ...Array.from({ length: FRAMES }, (_, i) => {
      const at = frameTime(i);

      return still(svg, "f" + i + "-", at, at.toFixed(2) + "s", () => jump(at));
    }),
  );
  seekStrip(filmstrip);
};

const showLog = (view: StateView) => {
  const list = el("ol");
  const head = el("div", "panel-head");
  const count = view.log.at;

  undoButton.toggleAttribute("disabled", view.log.at === 0);
  redoButton.toggleAttribute("disabled", view.log.at === view.log.labels.length);
  reset.toggleAttribute("disabled", view.log.at === 0);
  head.append(
    el("h2", "", "History"),
    el("span", "note", count === 0 ? "" : count + (count === 1 ? " edit" : " edits") + " written"),
  );

  view.log.labels.forEach((label, i) => {
    list.append(el("li", i >= view.log.at ? "undone" : i === view.log.at - 1 ? "last" : "", label));
  });

  log.replaceChildren(
    head,
    view.log.labels.length > 0
      ? list
      : el(
          "p",
          "empty",
          "Each change you let go of is written to the file and listed here. ⌘Z undoes it.",
        ),
  );
};

/** "escapement" for escapement/index.tsx; "fields" in field-site/scenes for field-site/scenes/fields.tsx. */
interface SceneName {
  readonly name: string;
  /** The directories above it, when there are any. */
  readonly where: string;
}

const sceneName = (scene: string): SceneName => {
  const parts = scene.split("/");
  const file = parts.pop() ?? scene;
  const stem = file.replace(/\.[^.]+$/, "");

  if (stem === "index" && parts.length > 0) {
    const name = parts.pop() ?? stem;

    return { name, where: parts.join("/") };
  }

  return { name: stem, where: parts.join("/") };
};

let cursor = 0;

const showPicker = (view: StateView) => {
  layout.classList.toggle("single", view.mode !== "project");

  if (view.mode !== "project") return;
  const words = filter.value.trim().toLowerCase();
  const scenes = view.scenes.filter((scene) => scene.toLowerCase().includes(words));

  cursor = Math.min(cursor, Math.max(0, scenes.length - 1));
  scenesBox.replaceChildren(
    ...scenes.map((scene, i) => {
      const { name, where } = sceneName(scene);
      const button = el("button", "scene" + (words !== "" && i === cursor ? " cursor" : ""));

      button.type = "button";
      button.title = scene;
      button.dataset["scene"] = scene;
      button.setAttribute("role", "option");
      button.setAttribute("aria-current", String(scene === view.file));
      button.append(el("span", "name", name), el("span", "where", where));
      button.addEventListener("click", () => void openScene(scene));

      return button;
    }),
  );

  if (scenes.length === 0) scenesBox.append(el("p", "scenes-empty", "No scene matches."));
};

filter.addEventListener("input", () => {
  cursor = 0;

  if (state) showPicker(state);
});

filter.addEventListener("keydown", (event) => {
  const listed = [...scenesBox.querySelectorAll<HTMLElement>(".scene")];

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    cursor = Math.max(
      0,
      Math.min(listed.length - 1, cursor + (event.key === "ArrowDown" ? 1 : -1)),
    );

    for (const [i, button] of listed.entries()) button.classList.toggle("cursor", i === cursor);
    listed[cursor]?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter") {
    const scene = listed[cursor]?.dataset["scene"];

    if (scene) void openScene(scene);
    filter.blur();
  } else if (event.key === "Escape") {
    filter.value = "";
    filter.blur();

    if (state) showPicker(state);
  }
});

/** An error as the server said it, with the project's own path left off the files it names. */
const showError = (message: string | undefined) => {
  const root = state?.root;

  errorBox.hidden = message === undefined;
  errorText.textContent = root && message ? message.replaceAll(root + "/", "") : (message ?? "");
};

const setStatus = (text: string, tone: "" | "busy" | "failed") => {
  statusText.textContent = text;
  status.className = "status " + tone;
};

const bytes = (n: number): string => (n < 1000 ? n + " B" : (n / 1024).toFixed(2) + " KB");

const gzipped = async (text: string): Promise<number> => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(stream).arrayBuffer()).byteLength;
};

/** The numbers under the timeline: how big the picture is, how fast it builds, how fast a drag shows. */
const showStats = async (view: StateView) => {
  if (view.svg === undefined) {
    statsText.textContent = "";
    download.hidden = true;

    return;
  }

  const svg = view.svg;
  const zipped = await gzipped(svg);

  if (state !== view) return;

  const parts = [
    [bytes(zipped), "gzip"],
    [bytes(new Blob([svg]).size), "raw"],
    ...(view.ms === undefined ? [] : [[view.ms + " ms", "to compile"]]),
    ...(dragToPicture === undefined
      ? []
      : [[Math.round(dragToPicture) + " ms", "drag to picture"]]),
    [String(view.log.at), view.log.at === 1 ? "edit written" : "edits written"],
  ];

  statsText.replaceChildren(
    ...parts.flatMap(([value = "", what = ""], i) => {
      const item = el("span");

      item.append(el("b", "", value), " " + what);

      return i === 0 ? [item] : [el("span", "sep", "·"), item];
    }),
  );
  download.hidden = false;
  download.setAttribute("download", (view.name ?? "scene").replace(/\.[^.]+$/, "") + ".svg");
};

/** The signals a person can turn in the code, for the note in the window's title bar. */
const inCode = (view: StateView) => {
  const keys = new Set(view.marks.map((mark) => mark.key));

  return view.controls.filter((control) => control.group !== "derived" && keys.has(control.key))
    .length;
};

/** Draws a whole state: stage, frames, lanes, source, controls and edits. */
const render = (view: StateView) => {
  const first = state === undefined || state.file !== view.file;

  state = view;
  epoch++;
  stale = false;
  stage.classList.remove("preview");
  badge.classList.remove("on");

  const { name, where } = sceneName(view.file ?? "");

  title.replaceChildren(
    view.file ? name : view.mode === "project" ? (view.root.split("/").pop() ?? "") + "/" : "",
  );

  if (where && view.mode === "project") title.append(el("span", "dir", "  " + where));
  document.title = (view.file ? name : "svjeez") + " · svjeez dev";

  if (view.error !== undefined) setStatus("Build failed", "failed");
  else if (view.ms !== undefined) setStatus("Built in " + view.ms + " ms", "");
  else setStatus(view.mode === "project" ? view.scenes.length + " scenes" : "", "");

  showPicker(view);
  showError([view.error, view.controlsError].filter(Boolean).join("\n\n") || undefined);
  stage.classList.toggle("stale", view.error !== undefined);
  warnings.replaceChildren(...view.warnings.map((warning) => el("li", "", warning)));
  filename.replaceChildren();

  if (view.file) {
    const dirs = view.file.slice(0, view.file.length - (view.name ?? "").length);

    if (view.mode === "project" && dirs) filename.append(el("span", "dir", dirs));
    filename.append(view.name ?? "");
  }

  const count = inCode(view);

  codeNote.textContent = view.file
    ? count === 0
      ? "nothing to turn"
      : count + (count === 1 ? " value to turn" : " values to turn")
    : "";

  if (view.svg !== undefined) {
    duration = view.duration || 0;
    showSvg(view.svg);
    duration = duration || (current ? loopLength(current) : 0) || 1;
    loop = view.loop ?? true;
    time = loop ? time % duration : Math.min(time, duration);

    if (first) time = 0;
    showFrames(view.svg);
  } else {
    if (art.shadowRoot) art.shadowRoot.innerHTML = "";
    current = null;
    filmstrip.replaceChildren();
  }

  document.body.classList.toggle("no-scene", !view.file);
  stage.querySelector(".stage-empty")?.remove();

  if (!view.file) {
    const empty = el("div", "stage-empty");

    empty.append(
      el("b", "", "Pick a scene"),
      el(
        "span",
        "",
        view.scenes.length +
          " scenes under " +
          (view.root.split("/").pop() ?? "") +
          "/. ⌘K finds one.",
      ),
    );
    stage.append(empty);
  }

  clockTotal.textContent = "/ " + duration.toFixed(2) + "s";
  loopNote.textContent = view.file
    ? (loop ? "loops every " : "plays once, ") + shown(duration) + "s"
    : "";

  const live = view.lanes.filter((lane) =>
    lane.spans.some((span) => span.signal !== undefined),
  ).length;

  timelineNote.textContent = view.lanes.length
    ? view.lanes.length +
      (view.lanes.length === 1 ? " lane" : " lanes") +
      (live ? " · " + live + " you can drag" : "")
    : "";
  renderTimeline(timeline, view.lanes, view.source ?? "", duration, timelineHost);

  const text = view.source ?? "";
  const shownKey = (view.file ?? "") + "|" + text;

  if (shownKey !== shownSource) {
    closePicker(true);
    renderSource(source, text, view.marks, view.controls);
    shownSource = shownKey;

    if (first) source.scrollTop = 0;
  }

  if (!held) {
    const derived = view.controls.filter((control) => control.group === "derived");

    composedBox.hidden = derived.length === 0;

    if (derived.length > 0) renderControls(controls, derived, host);
  }

  if (first) closeInspector();
  else if (selected !== undefined && !held) {
    const control = view.controls.find((each) => each.key === selected);

    if (control) showInspector(control, false);
    else closeInspector();
  }

  showLog(view);
  showClock();
  void showStats(view);
};

const load = async () => {
  const reply = await api.state();

  if (isError(reply)) return showError(reply.failure);

  if (held) {
    pending = true;

    return;
  }

  render(reply);
};

let pending = false;

const answer = (reply: StateView | { readonly failure: string }) => {
  if (isError(reply)) {
    showError(reply.failure);
    setStatus("Failed", "failed");

    return;
  }

  render(reply);
};

const openScene = async (file: string) => {
  history.replaceState(null, "", "?scene=" + encodeURIComponent(file));
  setStatus("Building " + sceneName(file).name + "…", "busy");

  for (const button of scenesBox.querySelectorAll<HTMLElement>(".scene"))
    button.setAttribute("aria-current", String(button.dataset["scene"] === file));
  answer(await api.open(file));
};

const step = async (which: "undo" | "redo") => {
  closePicker();
  answer(await (which === "undo" ? api.undo() : api.redo()));
};

/** Undoes every edit kept since the scene opened. */
const resetAll = async () => {
  while (state && state.log.at > 0) {
    const before = state.log.at;

    await step("undo");

    if (state.log.at >= before) break;
  }
};

undoButton.addEventListener("click", () => void step("undo"));

redoButton.addEventListener("click", () => void step("redo"));

reset.addEventListener("click", () => void resetAll());

/** At most one preview in flight; while one builds, only the newest value waits to go next. */
let inflight = false;
let queued: { readonly key: string; readonly value: ControlValue } | undefined;

const showPreview = (preview: Preview) => {
  stale = true;
  stage.classList.add("preview");
  badge.textContent = "Preview · " + preview.ms + " ms";
  badge.classList.add("on");
  showSvg(preview.svg);
  showFrames(preview.svg);

  if (gesture !== undefined) {
    dragToPicture = performance.now() - gesture;
    gesture = undefined;
  }

  if (state && !held)
    renderTimeline(
      timeline,
      preview.lanes,
      state.source ?? "",
      preview.duration ?? duration,
      timelineHost,
    );
};

const pump = async () => {
  const next = queued;

  queued = undefined;

  if (!next || inflight) return;
  inflight = true;
  const mine = epoch;

  setStatus("Previewing…", "busy");
  const reply = await api.preview(next.key, next.value);

  inflight = false;

  if (mine === epoch) {
    if (isError(reply)) {
      setStatus("Preview failed", "failed");
      stage.classList.add("stale");
      showError(reply.failure);
    } else if (!("stale" in reply)) {
      showError(undefined);
      stage.classList.remove("stale");
      setStatus("Preview in " + reply.ms + " ms", "");
      showPreview(reply);
    }
  }

  if (queued) void pump();
};

const preview = (key: string, value: ControlValue) => {
  gesture = gesture ?? performance.now();
  queued = { key, value };
  void pump();
};

const commit = async (key: string, value: ControlValue) => {
  queued = undefined;
  gesture = undefined;
  epoch++;
  setStatus("Writing…", "busy");
  answer(await api.commit(key, value));
};

let variantsAsked = 0;

let shownVariants:
  | { readonly control: GroupedControl; readonly list: readonly Variant[] }
  | undefined;

/** Five copies of the scene across one control's range, at the playhead: pick the one that looks right. */
const showVariants = async (control: GroupedControl) => {
  const mine = ++variantsAsked;

  variantsTitle.textContent = "Building variants of " + control.label + "…";
  variants.replaceChildren();
  shownVariants = undefined;
  const reply = await api.variants(control.key);

  if (mine !== variantsAsked) return;

  if (isError(reply)) {
    variantsTitle.textContent = reply.failure;

    return;
  }

  shownVariants = { control, list: reply.variants };
  drawVariants();
};

/**
 * The variants at the playhead, one row; or, across time, a row per value and a column per moment: the control's
 * whole range against the scene's whole time.
 */
const drawVariants = () => {
  if (!shownVariants) return;
  const { control, list } = shownVariants;
  const keep = (value: ControlValue) => () => void commit(control.key, value);

  variantsTitle.textContent = across
    ? "Across its range and the scene's time · click one to keep it"
    : "Across its range at " + time.toFixed(2) + "s · click one to keep it";
  variants.className = across ? "rows-grid" : "strip";

  if (!across) {
    variants.replaceChildren(
      ...list.map((variant, i) =>
        variant.svg === undefined
          ? el("div", "frame dim", variant.error ?? "")
          : still(variant.svg, "v" + i + "-", time, labelOf(variant.value), keep(variant.value)),
      ),
    );
    seekStrip(variants, time);

    return;
  }

  const times = el("div", "variant-row times");

  times.append(
    el("span"),
    ...Array.from({ length: FRAMES }, (_, j) => el("span", "", frameTime(j).toFixed(2) + "s")),
  );
  variants.replaceChildren(
    times,
    ...list.map((variant, i) => {
      const row = el("div", "variant-row");
      const { svg } = variant;

      row.append(el("span", "", labelOf(variant.value)));

      if (svg === undefined) row.append(el("span", "dim", variant.error ?? ""));
      else
        for (let j = 0; j < FRAMES; j++)
          row.append(still(svg, "v" + i + "t" + j + "-", frameTime(j), "", keep(variant.value)));

      return row;
    }),
  );
  seekStrip(variants);
};

for (const button of acrossBox.querySelectorAll<HTMLElement>("button"))
  button.addEventListener("click", () => {
    across = button.dataset["across"] === "true";

    for (const each of acrossBox.querySelectorAll<HTMLElement>("button"))
      each.setAttribute("aria-pressed", String(each === button));
    drawVariants();
  });

const isPoint = (value: ControlValue): value is readonly [number, number] => Array.isArray(value);

const isSpanValue = (value: ControlValue): value is Span =>
  typeof value === "object" && "start" in value;

const labelOf = (value: ControlValue): string => {
  if (isPoint(value)) return value.map(shown).join(", ");

  if (isSpanValue(value)) return shown(value.start) + "s +" + shown(value.over) + "s";

  return isNumber(value) ? shown(value) : String(value).replace(/^ease\./, "");
};

/** The inspector: one control, the way the panel draws it, and its variants. */
const showInspector = (control: GroupedControl, ask: boolean) => {
  const changed = selected !== control.key;

  selected = control.key;
  inspector.hidden = false;
  inspectTitle.replaceChildren(
    el("h2", "", "Selected"),
    el(
      "span",
      "",
      control.line === undefined ? control.kind : control.kind + " · line " + control.line,
    ),
  );
  renderControls(inspectControl, [control], { ...host, focus: () => {} });

  for (const button of inspectControl.querySelectorAll(".ghost")) button.remove();
  acrossBox.hidden = !sweeps(control);

  if (!sweeps(control)) {
    variantsTitle.textContent = "";
    variants.replaceChildren();

    return;
  }

  if (!changed && !ask) return;

  if (ask || (state?.ms ?? 0) < 1500) {
    void showVariants(control);

    return;
  }

  const more = el("button", "ghost", "Show variants");

  variantsAsked++;
  variantsTitle.textContent =
    "This scene takes " + state?.ms + " ms to build, so variants wait to be asked for.";
  more.type = "button";
  more.addEventListener("click", () => void showVariants(control));
  variants.className = "strip";
  variants.replaceChildren(more);
};

const closeInspector = () => {
  selected = undefined;
  inspector.hidden = true;
  variantsAsked++;
  shownVariants = undefined;
};

inspectClose.addEventListener("click", closeInspector);

const dragging = (on: boolean) => {
  held = on;

  if (!on && pending) {
    pending = false;
    void load();
  }
};

const host: Host = {
  preview,
  commit: (key, value) => void commit(key, value),
  dragging,
  focus: (control, asked) => {
    lightKeys(source, control.from, true);

    if (asked) showInspector(control, true);
  },
};

const pickerHost: PickerHost = {
  preview,
  commit: (key, value) => void commit(key, value),
  revert: () => {
    epoch++;
    queued = undefined;
    shownSource = "";

    if (state) render(state);
  },
  show: (key, text) => showLiteral(source, key, text),
};

const palette = () => [
  ...new Set(
    state?.controls.flatMap((control) =>
      control.kind === "color" && isText(control.value) ? [control.value] : [],
    ) ?? [],
  ),
];

const codeHost: CodeHost = {
  preview,
  commit: (key, value) => void commit(key, value),
  dragging,
  select: (control) => showInspector(control, false),
  pick: (control, at) => {
    if (control.kind === "color") pickColor(at, control, palette(), pickerHost);
    else if (control.kind === "ease") pickEase(at, control, pickerHost);
  },
  hover: (control) => lightKeys(source, control ? [control.key] : [], false),
};

wireSource(
  source,
  (key) => state?.controls.find((control) => control.key === key && control.group !== "derived"),
  codeHost,
);

const timelineHost: TimelineHost = {
  jump,
  preview,
  commit: (key, value) => void commit(key, value),
  line: (line) => lightLine(source, line),
  dragging,
};

const typing = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement;

document.addEventListener("keydown", (event) => {
  const command = event.metaKey || event.ctrlKey;

  if (command && event.key.toLowerCase() === "k") {
    event.preventDefault();
    filter.focus();
    filter.select();

    return;
  }

  if (typing(event.target)) return;

  if (event.key === " " && !command) {
    event.preventDefault();

    if (playing) pause();
    else play();

    return;
  }

  if (!command || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  void step(event.shiftKey ? "redo" : "undo");
});

const events = new EventSource("/api/events");

events.addEventListener("message", (message: MessageEvent<string>) => {
  const event: { readonly type: string; readonly version?: number } = JSON.parse(message.data);

  if (event.type === "scenes" || (event.version ?? 0) > (state?.version ?? 0)) void load();
});

const boot = async () => {
  toggle.innerHTML = PAUSE;
  const reply = await api.state();

  if (isError(reply)) return showError(reply.failure);
  const wanted = new URLSearchParams(location.search).get("scene");

  render(reply);

  if (reply.mode === "project" && wanted !== null && wanted !== reply.file) await openScene(wanted);
};

void boot();

requestAnimationFrame(tick);

/** Exposed for scripts that drive the page, as the checks do. */
Object.assign(window, {
  svjeezDev: { jump, preview, commit, state: () => state, stale: () => stale },
});
