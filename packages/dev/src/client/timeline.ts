import type { ControlValue } from "@svjeez/live";
import type { GroupedControl, LaneEase, LaneView } from "../workspace.ts";
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
  /** The pointer is over a move written with these signals, or over none: their literals light up. */
  readonly literals: (keys: readonly string[]) => void;
  /** A move's curve was clicked: open its picker at `anchor`. */
  readonly ease: (anchor: HTMLElement, control: GroupedControl) => void;
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

/** The controls of the scene drawn last, by key: a move finds its step, target and curve here. */
let controlsByKey = new Map<string, GroupedControl>();

/** The times the moves you can drag start and end at, for a dragged edge to snap to. */
let edges: readonly number[] = [];

/** A drag lands on multiples of this many seconds. */
const GRID = 0.05;

/** An edge pulls a dragged one from this many pixels away. */
const PULL = 6;

/** The shortest a move can be dragged to, with and without the grid. */
const SHORTEST = 0.05;

interface Bar {
  readonly at: number;
  readonly over: number;
  readonly ease?: LaneEase;
  readonly signal?: string;
  readonly start: number;
  /** The loop's length when the lane loops. */
  readonly period?: number;
  /** The property the lane moves, for the unit its target is shown in. */
  readonly lane: string;
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
          lane: lane.lane,
          ...(lane.period !== undefined && { period: lane.period }),
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

const round = (value: number): number => Number(value.toFixed(2));

/** The edge within `reach` seconds of `time`, the closest one, or none. */
const edgeNear = (time: number, reach: number): number | undefined => {
  let best: number | undefined;
  let gap = reach;

  for (const edge of edges) {
    const apart = Math.abs(edge - time);

    if (apart < gap) {
      gap = apart;
      best = edge;
    }
  }

  return best;
};

/** One line, across every row, where a dragged edge has snapped to. */
const guideAt = (track: HTMLElement, time: number | undefined, duration: number) => {
  const rows = track.closest<HTMLElement>(".rows");

  if (!rows) return;
  const guide = rows.querySelector<HTMLElement>(".guide") ?? rows.appendChild(el("i", "guide"));

  if (time === undefined) {
    guide.classList.remove("on");

    return;
  }

  const box = track.getBoundingClientRect();
  const at = box.left - rows.getBoundingClientRect().left + rows.scrollLeft;

  guide.style.left = at + (time / duration) * box.width + "px";
  guide.classList.add("on");
};

const tip = el("div", "bar-tip");

/** A small label beside the pointer while a bar is dragged. */
const showTip = (event: PointerEvent, text: string) => {
  tip.textContent = text;
  tip.style.left = event.clientX + 14 + "px";
  tip.style.top = event.clientY - 30 + "px";

  if (!tip.isConnected) document.body.append(tip);
  tip.classList.add("on");
};

const hideTip = () => tip.classList.remove("on");

/** What a bar writes: the signal behind it, and the literals of its step beside it. */
interface Move {
  readonly key: string;
  readonly control: GroupedControl | undefined;
  readonly target: GroupedControl | undefined;
  readonly ease: GroupedControl | undefined;
  /** A `rewind`: its length alone is written, not a start. */
  readonly rewind: boolean;
  /** A rewind that ends the loop: its start follows from its length. */
  readonly pinned: boolean;
}

const moveOf = (bar: Bar, key: string): Move => {
  const control = controlsByKey.get(key);
  const rewind = control?.kind === "number";

  return {
    key,
    control,
    target: controlsByKey.get(key + ".target"),
    ease: controlsByKey.get(key + ".ease"),
    rewind,
    pinned:
      rewind && bar.period !== undefined && Math.abs(bar.start + bar.over - bar.period) < 1e-3,
  };
};

type Grab = "move" | "start" | "end" | "none";

/**
 * A bar written with literals: drag it to move its start, its right edge to change how long it lasts, its left
 * edge to change its start with the end kept. Edges snap to the grid and to the edges of other moves, with a guide
 * line; Alt turns that off. The scene rebuilds as it moves; letting go keeps the edit. A click without a drag opens
 * the curve's picker when the move has a literal one, else goes to its start.
 */
const live = (
  bar: HTMLElement,
  from: Bar,
  move: Move,
  duration: number,
  host: TimelineHost,
  goal: HTMLElement | undefined,
) => {
  const { start, over } = from;
  const { rewind, pinned } = move;

  bar.classList.add("live");

  if (move.ease) bar.classList.add("curved");

  // A rewind that ends the loop can only change its length from the left; any other can from the right.
  if (!rewind || pinned) bar.append(el("span", "edge start"));

  if (!rewind || !pinned) bar.append(el("span", "edge end"));

  const keys = [move.key, ...[move.target, move.ease].flatMap((part) => (part ? [part.key] : []))];
  const line = move.control?.line;

  bar.addEventListener("pointerenter", () => {
    host.literals(keys);

    if (line !== undefined) host.line(line);
  });

  bar.addEventListener("pointerleave", () => {
    host.literals([]);
    host.line(Number(bar.closest<HTMLElement>(".row")?.dataset["line"]) || undefined);
  });

  bar.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    down.stopPropagation();
    bar.setPointerCapture(down.pointerId);
    const edge = down.target instanceof HTMLElement ? down.target.classList : undefined;

    const grab: Grab = edge?.contains("start")
      ? "start"
      : edge?.contains("end")
        ? "end"
        : rewind
          ? "none"
          : "move";

    const track = bar.parentElement ?? bar;
    const perSecond = (track.clientWidth || 1) / duration;
    let next = { start, over };
    let moved = false;

    if (grab !== "none") bar.classList.add(grab === "move" ? "moving" : "stretching");

    // Where a time lands: on a close edge, else on the grid, else as it is when Alt is held.
    const land = (time: number, free: boolean) => {
      const hit = free ? undefined : edgeNear(time, PULL / perSecond);

      if (hit !== undefined) return { time: hit, guide: hit };

      return { time: round(free ? time : Math.round(time / GRID) * GRID), guide: undefined };
    };

    const move_ = (event: PointerEvent) => {
      if (grab === "none") return;
      const by = (event.clientX - down.clientX) / perSecond;
      const free = event.altKey;
      const floor = free ? 0.01 : SHORTEST;
      let guide: number | undefined;

      if (!moved && Math.abs(event.clientX - down.clientX) > 2) {
        moved = true;
        host.dragging(true);
      }

      if (grab === "move") {
        const raw = start + by;
        const head = land(raw, free);
        const tail = land(raw + over, free);

        // The nearer of the two ends is the one that snaps.
        const useTail =
          tail.guide !== undefined &&
          (head.guide === undefined ||
            Math.abs(tail.time - raw - over) < Math.abs(head.time - raw));

        const at = useTail ? round(tail.time - over) : head.time;

        guide = useTail ? tail.guide : head.guide;
        next = { start: Math.max(0, at), over };
      } else if (grab === "start") {
        const end = start + over;
        const edge = land(Math.min(end - floor, Math.max(0, start + by)), free);

        guide = edge.guide;
        next = { start: edge.time, over: round(end - edge.time) };
      } else {
        const edge = land(Math.max(start + floor, start + over + by), free);

        guide = edge.guide;
        next = { start, over: round(edge.time - start) };
      }

      place(bar, next.start, next.over, duration);

      if (goal) placeGoal(goal, next.start, next.over, duration);
      guideAt(track, guide, duration);

      if (moved) {
        showTip(
          event,
          grab === "move"
            ? shown(next.start) + "s → " + shown(next.start + next.over) + "s"
            : shown(next.over) +
                "s long · " +
                shown(next.start) +
                "s → " +
                shown(next.start + next.over) +
                "s",
        );
        host.preview(move.key, rewind ? next.over : next);
      }
    };

    const done = (event: PointerEvent) => {
      bar.removeEventListener("pointermove", move_);
      bar.classList.remove("moving", "stretching");
      guideAt(track, undefined, duration);
      hideTip();

      if (!moved) {
        if (event.type === "pointerup")
          if (move.ease) host.ease(bar, move.ease);
          else host.jump(start);

        return;
      }

      host.dragging(false);
      host.commit(move.key, rewind ? next.over : next);
    };

    bar.addEventListener("pointermove", move_);
    bar.addEventListener("pointerup", done, { once: true });
    bar.addEventListener("pointercancel", done, { once: true });
  });
};

/** The unit a lane's target is shown in. */
const unitOf = (lane: string): string => (lane === "rotate" ? "°" : "");

const placeGoal = (goal: HTMLElement, at: number, over: number, duration: number) => {
  const end = Math.min(duration, at + over);

  goal.classList.toggle("before", end / duration > 0.88);
  goal.style.left = ((goal.classList.contains("before") ? at : end) / duration) * 100 + "%";
};

/** The most a pixel of dragging changes a target: its range over this many pixels. */
const SPAN = 240;

/** Where a step goes, at the end of its bar: a number you can drag sideways, or a color's swatch. */
const goalOf = (target: GroupedControl, unit: string, host: TimelineHost): HTMLElement => {
  const node = el("span", "goal");

  if (target.kind === "color") {
    node.classList.add("swatch");
    node.style.setProperty("--c", String(target.value));
    node.title = "Goes to " + String(target.value);

    return node;
  }

  const from = Number(target.value);

  const { min, max, step } = target.range ?? {
    min: 0,
    max: Math.max(1, Math.abs(from) * 2),
    step: 0.01,
  };

  const places = Math.max(0, Math.ceil(-Math.log10(step)));
  const text = (value: number) => shown(value) + unit;

  node.textContent = text(from);
  node.title = "Goes to " + shown(from) + unit + ". Drag sideways to change it, Alt is finer.";
  node.classList.add("scrub");

  node.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    down.stopPropagation();
    node.setPointerCapture(down.pointerId);
    let value = from;
    let moved = false;

    node.classList.add("scrubbing");

    const move = (event: PointerEvent) => {
      if (!moved && Math.abs(event.clientX - down.clientX) > 2) {
        moved = true;
        host.dragging(true);
      }

      if (!moved) return;
      const factor = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
      const fine = event.altKey ? step / 10 : step;
      const raw = from + ((event.clientX - down.clientX) * (max - min) * factor) / SPAN;

      value = Number((Math.round(raw / fine) * fine).toFixed(event.altKey ? places + 1 : places));
      node.textContent = text(value);
      host.preview(target.key, value);
    };

    const up = () => {
      node.removeEventListener("pointermove", move);
      node.classList.remove("scrubbing");

      if (!moved) return;
      host.dragging(false);
      host.commit(target.key, value);
    };

    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up, { once: true });
    node.addEventListener("pointercancel", up, { once: true });
  });

  return node;
};

/** Where the moves you can drag start and end, and the scene's own ends. */
const edgesOf = (lanes: readonly LaneView[], duration: number): number[] => [
  ...new Set([
    0,
    duration,
    ...lanes.flatMap((lane) =>
      lane.spans.flatMap((span) =>
        span.signal === undefined ? [] : [round(span.start), round(span.start + span.over)],
      ),
    ),
  ]),
];

/** A track with this many bars or more is a texture, not a curve to read: it draws them plain. */
const CROWD = 24;

/** A track with more bars than this has no room to write where each one goes. */
const GOALS = 8;

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

    if (each.signal === undefined) {
      holder.append(bar);
      continue;
    }

    const move = moveOf(each, each.signal);

    const goal =
      move.target && bars.length <= GOALS
        ? goalOf(move.target, unitOf(each.lane), host)
        : undefined;

    live(bar, each, move, duration, host, goal);
    holder.append(bar);

    if (goal) {
      placeGoal(goal, each.at, each.over, duration);
      holder.append(goal);
    }
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

  if (line !== undefined) row.dataset["line"] = String(line);

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
  controls: readonly GroupedControl[],
  host: TimelineHost,
): void => {
  container.replaceChildren();
  controlsByKey = new Map(controls.map((control) => [control.key, control]));
  edges = edgesOf(lanes, duration);

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
      renderTimeline(container, lanes, source, duration, controls, host);
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
