import type { ControlValue } from "@svjeez/live";
import type { LaneEase, LaneView } from "../workspace.ts";
import { curvePath } from "./ease.ts";
import { el, shown } from "./dom.ts";
import { groupLanes } from "./lanes.ts";
import type { LaneGroup, Row } from "./lanes.ts";

export interface TimelineHost {
  readonly jump: (time: number) => void;
  readonly preview: (key: string, value: ControlValue) => void;
  readonly commit: (key: string, value: ControlValue) => void;
  /** The pointer is over a lane written on this line, or over none. */
  readonly line: (line: number | undefined) => void;
  readonly dragging: (on: boolean) => void;
}

/** A looping lane is drawn this many times at most across the scene's time. */
const CYCLES = 24;

/** A group bigger than this starts folded. */
const FOLD = 4;

/** Rows past this many say little more and slow the page; the rest are counted, not drawn. */
const ROWS = 240;

/** Bars one folded group draws at most: the distinct moves of its lanes. */
const BARS = 160;

const SVG = "http://www.w3.org/2000/svg";

/** A bar narrower than this, in pixels, is too small to show its curve. */
const CURVE_WIDTH = 24;

/** How wide a second is in the timeline drawn last. */
let pixelsPerSecond = 40;

/** Groups the person opened or closed, by id, kept across rebuilds. */
const toggled = new Map<string, boolean>();

interface Bar {
  readonly at: number;
  readonly over: number;
  readonly ease?: LaneEase;
  readonly signal?: string;
  readonly start: number;
}

const barsOf = (lanes: readonly LaneView[], duration: number): Bar[] => {
  const seen = new Set<string>();
  const bars: Bar[] = [];

  for (const lane of lanes) {
    const cycles = lane.period ? Math.min(CYCLES, Math.ceil(duration / lane.period - 1e-6)) : 1;

    for (let i = 0; i < cycles; i++)
      for (const span of lane.spans) {
        const at = span.start + i * (lane.period ?? 0);

        const id =
          at.toFixed(3) + ":" + span.over.toFixed(3) + ":" + JSON.stringify(span.ease ?? "");

        if (at >= duration - 1e-6 || seen.has(id)) continue;
        seen.add(id);
        bars.push({
          at,
          over: span.over,
          start: span.start,
          ...(span.ease && { ease: span.ease }),
          ...(span.signal !== undefined && i === 0 && { signal: span.signal }),
        });
      }
  }

  return bars;
};

const easeName = (ease: LaneEase | undefined): string => {
  if (!ease) return "";

  switch (ease.kind) {
    case "linear":
      return "linear";
    case "steps":
      return ease.count === 1 ? "hold" : "steps(" + ease.count + ")";
    case "bezier":
      return "bezier(" + ease.points.map(shown).join(", ") + ")";
  }
};

/** The curve a bar moves along, drawn across it. */
const curveIn = (ease: LaneEase) => {
  const svg = document.createElementNS(SVG, "svg");
  const path = document.createElementNS(SVG, "path");

  svg.setAttribute("viewBox", "0 -12 100 124");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", curvePath(ease, 100, 100));
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);

  return svg;
};

const place = (bar: HTMLElement, at: number, over: number, duration: number) => {
  bar.style.left = Math.min(99.6, (at / duration) * 100) + "%";
  bar.style.width = (Math.max(0, Math.min(over, duration - at)) / duration) * 100 + "%";
};

/**
 * A bar written with a literal span: drag it to move the span, drag its right edge to change how long it lasts.
 * The scene rebuilds as it moves; letting go keeps the edit, and a click without a drag goes to its start.
 */
const live = (
  bar: HTMLElement,
  key: string,
  start: number,
  over: number,
  duration: number,
  host: TimelineHost,
) => {
  bar.classList.add("live");
  bar.append(el("span", "grip"));

  bar.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    down.stopPropagation();
    bar.setPointerCapture(down.pointerId);
    const box = bar.getBoundingClientRect();
    const track = bar.parentElement?.clientWidth ?? 1;
    const stretch = down.clientX > box.right - 8;
    const perSecond = track / duration;
    let next = { start, over };
    let moved = false;

    bar.classList.add(stretch ? "stretching" : "moving");

    const move = (event: PointerEvent) => {
      const by = Math.round(((event.clientX - down.clientX) / perSecond) * 100) / 100;

      if (!moved && Math.abs(event.clientX - down.clientX) > 2) {
        moved = true;
        host.dragging(true);
      }

      next = stretch
        ? { start, over: Math.max(0.01, Number((over + by).toFixed(2))) }
        : { start: Math.max(0, Number((start + by).toFixed(2))), over };
      place(bar, next.start, next.over, duration);
      bar.dataset["tip"] = shown(next.start) + "s → " + shown(next.start + next.over) + "s";

      if (moved) host.preview(key, next);
    };

    bar.addEventListener("pointermove", move);
    bar.addEventListener(
      "pointerup",
      () => {
        bar.removeEventListener("pointermove", move);
        bar.classList.remove("moving", "stretching");
        delete bar.dataset["tip"];

        if (!moved) {
          host.jump(start);

          return;
        }

        host.dragging(false);
        host.commit(key, next);
      },
      { once: true },
    );
  });
};

/** A track with this many bars or more is a texture, not a curve to read: it draws them plain. */
const CROWD = 24;

const track = (bars: readonly Bar[], duration: number, host: TimelineHost, title: string) => {
  const holder = el("div", "track" + (bars.length >= CROWD ? " crowded" : ""));

  for (const each of bars.slice(0, BARS)) {
    const bar = el("div", "bar");

    place(bar, each.at, each.over, duration);
    bar.title =
      title +
      " · " +
      shown(each.at) +
      "s → " +
      shown(each.at + each.over) +
      "s" +
      (each.ease ? " · " + easeName(each.ease) : "");

    if (each.ease && bars.length < CROWD && each.over * pixelsPerSecond >= CURVE_WIDTH)
      bar.append(curveIn(each.ease));

    if (each.signal !== undefined) live(bar, each.signal, each.start, each.over, duration, host);
    holder.append(bar);
  }

  return holder;
};

const chevron = () => {
  const svg = document.createElementNS(SVG, "svg");
  const path = document.createElementNS(SVG, "path");

  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "chev");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", "M6 4l4 4-4 4");
  svg.append(path);

  return svg;
};

const rowOf = (
  name: string,
  prop: string,
  bars: HTMLElement,
  line: number | undefined,
  host: TimelineHost,
  className: string,
) => {
  const row = el("div", "row " + className);
  const label = el("div", "lane-label");

  label.append(el("span", "name", name), el("span", "prop", prop));
  label.title = name + " · " + prop + (line === undefined ? "" : " · line " + line);
  row.append(label, bars);
  row.addEventListener("pointerenter", () => host.line(line));

  return row;
};

const isOpen = (group: LaneGroup, total: number): boolean =>
  toggled.get(group.id) ?? (group.rows.length <= FOLD && total <= 60);

/** A tick every so many seconds that the ruler gets five to twelve of them. */
const tickOf = (duration: number, width: number): number => {
  const most = Math.max(2, Math.floor(width / 56));

  return (
    [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60].find((step) => duration / step <= most) ?? 120
  );
};

/** The ruler: seconds along the top, and a playhead you can drag. */
const ruler = (duration: number, width: number, host: TimelineHost) => {
  const head = el("div", "ruler");
  const scale = el("div", "scale");
  const step = tickOf(duration, width);

  for (let t = 0; t <= duration + 1e-6; t += step) {
    const tick = el("span", "tick", shown(t) + "s");

    tick.style.left = (t / duration) * 100 + "%";
    scale.append(tick);
  }

  scale.append(el("i", "knob"));
  head.append(el("div", "corner"), scale);

  scale.addEventListener("pointerdown", (down) => {
    scale.setPointerCapture(down.pointerId);

    const at = (event: PointerEvent) => {
      const box = scale.getBoundingClientRect();

      host.jump(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * duration);
    };

    at(down);
    scale.addEventListener("pointermove", at);
    scale.addEventListener("pointerup", () => scale.removeEventListener("pointermove", at), {
      once: true,
    });
  });

  return { head, step };
};

/** One row per lane, its moves as bars with their curves, folded by group when a line writes many. */
export const renderTimeline = (
  container: HTMLElement,
  lanes: readonly LaneView[],
  source: string,
  duration: number,
  host: TimelineHost,
): void => {
  container.replaceChildren();

  if (lanes.length === 0) {
    container.append(el("p", "empty", "Nothing moves in this scene."));

    return;
  }

  const groups = groupLanes(lanes, source);
  const label = Number.parseFloat(getComputedStyle(container).getPropertyValue("--label")) || 172;
  const width = Math.max(120, container.clientWidth - label - 16);
  const { head, step } = ruler(duration, width, host);

  pixelsPerSecond = width / duration;
  const body = el("div", "rows");
  let drawn = 0;

  container.style.setProperty("--grid", String((step / duration) * 100) + "%");
  body.addEventListener("pointerleave", () => host.line(undefined));

  for (const group of groups) {
    if (drawn >= ROWS) break;

    if (group.rows.length === 1) {
      const [only] = group.rows;

      if (only)
        body.append(
          rowOf(
            only.name,
            only.lane.lane,
            track(barsOf([only.lane], duration), duration, host, only.name),
            only.lane.line,
            host,
            "",
          ),
        );
      drawn++;
      continue;
    }

    const open = isOpen(group, lanes.length);

    const header = rowOf(
      group.name,
      group.props.join(", "),
      track(
        barsOf(
          group.rows.map((row) => row.lane),
          duration,
        ),
        duration,
        host,
        group.name,
      ),
      group.line,
      host,
      "group" + (open ? " open" : ""),
    );

    const toggle = el("button", "fold");
    const label = header.querySelector(".lane-label");

    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", (open ? "Fold " : "Unfold ") + group.name);
    toggle.append(chevron());
    label?.prepend(toggle);
    label?.querySelector(".name")?.after(el("span", "count", String(group.rows.length)));
    toggle.addEventListener("click", () => {
      toggled.set(group.id, !open);
      renderTimeline(container, lanes, source, duration, host);
    });
    body.append(header);
    drawn++;

    if (!open) continue;

    for (const [index, row] of group.rows.slice(0, Math.max(0, ROWS - drawn)).entries()) {
      body.append(child(row, index, group, duration, host));
      drawn++;
    }
  }

  if (drawn >= ROWS)
    body.append(el("p", "more", "The first " + drawn + " rows. Fold a group to see the rest."));

  container.append(head, body);
};

/** A lane inside an open group: its own name when it has one the group does not, else its number in the group. */
const child = (row: Row, index: number, group: LaneGroup, duration: number, host: TimelineHost) =>
  rowOf(
    row.name === group.name ? String(index + 1) : row.name,
    row.lane.lane,
    track(barsOf([row.lane], duration), duration, host, row.name),
    row.lane.line,
    host,
    "child",
  );

/** Moves the playhead to `time`. */
export const showTime = (container: HTMLElement, time: number, duration: number): void => {
  container.style.setProperty("--t", String(time / duration));
};
