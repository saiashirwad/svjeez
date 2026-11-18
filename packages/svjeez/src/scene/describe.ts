import type { Seconds } from "../motion";
import type { Placed } from "./boxes";
import type { Animated, Paint, Scene, SceneNode, Vec } from "./ir";
import { isLane } from "./lane";
import {
  between,
  changesOf,
  entriesOf,
  framesOf,
  hiddenOf,
  inside,
  merged,
  ownHidden,
  paintName,
  seconds,
  shownOf,
  textOf,
  units,
  valuesOf,
  type Entry,
  type Stretch,
} from "./survey";

/**
 * What is on screen, in words, for an author who can't see it: each node that shows at a time, where, how and what
 * is moving it, and a line per node saying when it shows and what of it animates when. Plain data, and a short text
 * with repeated siblings folded together and defaults left out.
 */

/** One value partway through a change at a time, and the change's stretch. */
export interface Changing {
  readonly value: string;
  readonly from: Seconds;
  readonly to: Seconds;
}

export interface DescribedNode {
  readonly key: string;
  readonly kind: SceneNode["kind"];
  /** 0 for the root's children, 1 for theirs, and so on. */
  readonly depth: number;
  /** A shape's geometry kind: rect, ellipse, arc, line, polygon or path. */
  readonly geometry?: string;
  /** A text's first characters. */
  readonly text?: string;
  /** Left, top, width and height in the scene, rounded. */
  readonly box: readonly [x: number, y: number, width: number, height: number];
  /** How opaque, with every group around it, when not 1. */
  readonly opacity?: number;
  /** Degrees, with every group around it, when not 0. */
  readonly rotate?: number;
  /** Across and down, with every group around it, when not 1. */
  readonly scale?: Vec;
  /** A token's name, hex, or the kind of gradient. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly changing?: readonly Changing[];
}

export interface DescribedFrame {
  readonly t: Seconds;
  /** What shows, in paint order. */
  readonly nodes: readonly DescribedNode[];
}

/** One value's changes over the scene. */
export interface Animates {
  readonly value: string;
  readonly spans: readonly Stretch[];
  /** It repeats every this many seconds. */
  readonly every?: Seconds;
}

export interface NodeTimeline {
  readonly key: string;
  readonly kind: SceneNode["kind"];
  /** When it can be seen, by its layers and its groups'. */
  readonly shown: readonly Stretch[];
  readonly animates: readonly Animates[];
}

export interface Description {
  readonly frames: readonly DescribedFrame[];
  /** Each node that ever hides or animates. The rest show throughout and never change. */
  readonly timeline: readonly NodeTimeline[];
  /** The same, as text an agent reads: the timeline, then each frame. */
  readonly text: string;
}

const round = (n: number): number => Number(units(n));

const short = (text: string): string => (text.length > 40 ? `${text.slice(0, 39)}…` : text);

const paintAt = (paint: Animated<Paint>, t: Seconds): string => {
  const { from, to, amount } = between(paint, t);

  return amount >= 0.5 ? paintName(to) : paintName(from);
};

/** The changes of `node`'s own values in progress at `t`. */
const changingAt = (node: SceneNode, t: Seconds, duration: Seconds): Changing[] => {
  const out: Changing[] = [];

  for (const { name, value } of valuesOf(node)) {
    if (!isLane(value)) continue;
    // Keys a sampled motion was written as join into the one change they make.

    const span = merged(changesOf(value, duration)).find(
      ([a, b]) => b > a && t > a + 1e-6 && t < b - 1e-6,
    );

    if (span && !out.some((c) => c.value === name))
      out.push({ value: name, from: span[0], to: span[1] });
  }

  return out;
};

const nodeAt = (entry: Entry, placed: Placed, t: Seconds, duration: Seconds): DescribedNode => {
  const { node } = entry;
  const [a, b, c, d] = placed.matrix;
  const rotate = (Math.atan2(b, a) * 180) / Math.PI;
  const scale: Vec = [Math.hypot(a, b), Math.sign(a * d - b * c) * Math.hypot(c, d)];
  const changing = changingAt(node, t, duration);
  const { x, y, width, height } = placed.box;

  const fill =
    node.kind === "shape" && node.fill !== undefined
      ? paintAt(node.fill, t)
      : node.kind === "text"
        ? [
            ...new Set(node.lines.flatMap((line) => line.runs.map((run) => paintAt(run.fill, t)))),
          ].join("+")
        : undefined;

  const stroke =
    node.kind === "shape" && node.stroke
      ? `${paintAt(node.stroke.color, t)}/${units(Number(valueOf(node.stroke.width, t)))}`
      : undefined;

  return {
    key: node.key,
    kind: node.kind,
    depth: entry.depth - 1,
    ...(node.kind === "shape" && { geometry: atRest(node.geometry, t).kind }),
    ...(node.kind === "text" && { text: short(textOf(node)) }),
    box: [round(x), round(y), round(width), round(height)],
    ...(Math.abs(placed.opacity - 1) > 0.005 && { opacity: Number(placed.opacity.toFixed(2)) }),
    ...(Math.abs(rotate) > 0.5 && { rotate: Math.round(rotate) }),
    ...((Math.abs(scale[0] - 1) > 0.005 || Math.abs(scale[1] - 1) > 0.005) && {
      scale: [Number(scale[0].toFixed(2)), Number(scale[1].toFixed(2))],
    }),
    ...(fill !== undefined && fill !== "" && { fill }),
    ...(stroke !== undefined && { stroke }),
    ...(changing.length > 0 && { changing }),
  };
};

const atRest = <T>(value: Animated<T>, t: Seconds): T => {
  const { from, to, amount } = between(value, t);

  return amount >= 0.5 ? to : from;
};

const valueOf = (value: Animated<number>, t: Seconds): number => {
  const { from, to, amount } = between(value, t);

  return from + (to - from) * amount;
};

const timelineOf = (entry: Entry, duration: Seconds): NodeTimeline | undefined => {
  const hidden = hiddenOf(entry, duration);
  const animates: Animates[] = [];

  for (const { name, value } of valuesOf(entry.node)) {
    if (!isLane(value)) continue;

    const spans = merged(
      value.period === undefined
        ? changesOf(value, duration)
        : changesOf({ ...value, period: undefined }, value.period),
    );

    if (spans.length === 0) continue;
    const known = animates.find((a) => a.value === name);

    if (known) continue;
    animates.push({
      value: name,
      spans,
      ...(value.period !== undefined && { every: value.period }),
    });
  }

  // What its groups show and hide is said on their lines.
  if (ownHidden(entry.node, duration).length === 0 && animates.length === 0) return undefined;

  return { key: entry.node.key, kind: entry.node.kind, shown: shownOf(hidden, duration), animates };
};

/**
 * What `scene` shows at each of `times` (scene seconds), and when each of its nodes shows and moves. Pure and
 * deterministic: the same scene and times give the same description.
 */
export const describe = (scene: Scene, times: readonly Seconds[]): Description => {
  for (const t of times)
    if (!(Number.isFinite(t) && t >= 0))
      throw new Error(`describe() takes times in seconds from 0, got ${t}.`);
  const { duration } = scene;
  const entries = entriesOf(scene).slice(1);
  const hidden = new Map(entries.map((entry) => [entry.node.key, hiddenOf(entry, duration)]));
  const placedAt = framesOf(scene, times);

  const frames = times.map((t, i): DescribedFrame => {
    const frame = placedAt[i]!;

    const shows = (entry: Entry): boolean => {
      const at = frame.get(entry.node.key);

      return at !== undefined && at.opacity > 0.005 && !inside(hidden.get(entry.node.key) ?? [], t);
    };

    // A group is listed only while something in it shows.
    const visible = entries.filter((entry) =>
      entry.node.kind === "group"
        ? entries.some(
            (inner) =>
              inner.node.kind !== "group" && inner.ancestors.includes(entry.node) && shows(inner),
          )
        : shows(entry),
    );

    return {
      t,
      nodes: visible.map((entry) => nodeAt(entry, frame.get(entry.node.key)!, t, duration)),
    };
  });

  const timeline = entries.flatMap((entry) => {
    const line = timelineOf(entry, duration);

    return line ? [line] : [];
  });

  return { frames, timeline, text: textFor(scene, entries, frames, timeline) };
};

// ---------------------------------------------------------------------------------------------------------------
// The text form

const span = ([a, b]: Stretch, duration: Seconds): string =>
  a === b ? `at ${seconds(a)}` : `${seconds(a)}–${b >= duration - 1e-6 ? "end" : seconds(b)}`;

const timelineText = (line: NodeTimeline, duration: Seconds): string => {
  const shown =
    line.shown.length === 0
      ? "never shown"
      : line.shown.length === 1 && line.shown[0]![0] <= 1e-6 && line.shown[0]![1] >= duration - 1e-6
        ? "shown throughout"
        : `shown ${line.shown.map((s) => span(s, duration)).join(", ")}`;

  // Values that change over the same spans read as one.
  const together = new Map<string, string[]>();

  for (const a of line.animates) {
    const when =
      a.every === undefined
        ? a.spans.map((s) => span(s, duration)).join(", ")
        : `every ${seconds(a.every)}`;

    together.set(when, [...(together.get(when) ?? []), a.value]);
  }

  return [shown, ...[...together].map(([when, names]) => `${names.join(", ")} ${when}`)].join("; ");
};

/** The last part of `key` below `parent`'s. */
const relative = (key: string, parent: string | undefined): string =>
  parent !== undefined && key.startsWith(`${parent}/`) ? key.slice(parent.length + 1) : key;

/** Keys written together: `a/{0,1,2}` when they share all but their last part. */
const keysText = (keys: readonly string[]): string => {
  if (keys.length === 1) return keys[0]!;
  const parts = keys.map((key) => key.split("/"));
  const head = parts[0]!.slice(0, -1).join("/");

  if (parts.every((p) => p.slice(0, -1).join("/") === head))
    return `${head === "" ? "" : `${head}/`}{${parts.map((p) => p.at(-1)).join(",")}}`;

  return `{${keys.join(",")}}`;
};

/** A node's line, without its key and its place. */
const look = (node: DescribedNode, around: DescribedNode | undefined): string =>
  [
    `${node.geometry ? `${node.kind} ${node.geometry}` : node.kind} ${node.box[2]}×${node.box[3]} × `,
    (node.opacity ?? 1) !== (around?.opacity ?? 1) && `opacity ${node.opacity ?? 1}`,
    node.rotate !== around?.rotate && `rotate ${node.rotate ?? 0}°`,
    node.scale !== undefined &&
      node.scale.join() !== around?.scale?.join() &&
      `scale ${node.scale[0] === node.scale[1] ? node.scale[0] : node.scale.join(",")}`,
    node.fill !== undefined && `fill ${node.fill}`,
    node.stroke !== undefined && `stroke ${node.stroke}`,
    node.text !== undefined && JSON.stringify(node.text),
    node.changing &&
      `~ ${node.changing.map((c) => `${c.value} ${seconds(c.from)}–${seconds(c.to)}`).join(", ")}`,
  ]
    .filter((part) => part !== false && part !== undefined)
    .join(" ");

/**
 * A group is written out only when it says something its children don't: it is named rather than numbered, or it
 * moves, turns, scales, fades, clips or masks what it holds.
 */
const worthALine = (node: SceneNode): boolean =>
  node.kind !== "group" ||
  !/^\d+$/.test(node.key.split("/").at(-1)!) ||
  node.layers.length > 0 ||
  isLane(node.at) ||
  node.clip !== undefined ||
  node.mask !== undefined ||
  node.effects.length > 0;

/** A look with where it is put after its size. */
const place = (look: string, at: string): string => {
  const [kind, ...rest] = look.split(" × ");

  return [kind, `at ${at}`, rest.join(" × ").trim()].filter((part) => part !== "").join(" ");
};

const frameText = (frame: DescribedFrame, byKey: ReadonlyMap<string, Entry>): string[] => {
  const lines: { indent: number; parent: string; key: string; look: string; at: string }[] = [];
  const described = new Map(frame.nodes.map((node) => [node.key, node]));

  for (const node of frame.nodes) {
    const entry = byKey.get(node.key)!;

    if (!worthALine(entry.node)) continue;
    const parents = entry.ancestors.slice(1).filter(worthALine);
    const parent = parents.at(-1)?.key ?? "";

    lines.push({
      indent: parents.length,
      parent,
      key: relative(node.key, parent || undefined),
      // Opacity, rotation and scale are said where they change: a group's carry to what it holds.
      look: look(node, described.get(parent)),
      at: `${node.box[0]},${node.box[1]}`,
    });
  }

  // Siblings that look the same apart from where they are fold into one line.
  const out: string[] = [];

  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    let j = i + 1;

    while (
      j < lines.length &&
      lines[j]!.parent === line.parent &&
      lines[j]!.indent === line.indent &&
      lines[j]!.look === line.look &&
      !line.look.startsWith("group")
    )
      j++;
    const run = lines.slice(i, j);
    const pad = "  ".repeat(line.indent + 1);

    out.push(
      run.length === 1
        ? `${pad}${line.key} ${place(line.look, line.at)}`
        : `${pad}${keysText(run.map((r) => r.key))} ×${run.length} ${place(line.look, run.map((r) => r.at).join("; "))}`,
    );
    i = j;
  }

  return out;
};

const textFor = (
  scene: Scene,
  entries: readonly Entry[],
  frames: readonly DescribedFrame[],
  timeline: readonly NodeTimeline[],
): string => {
  const { duration } = scene;
  const byKey = new Map(entries.map((entry) => [entry.node.key, entry]));
  const [width, height] = scene.size;
  const lines = [`scene ${width}×${height}, ${seconds(duration)}${scene.loop ? ", loops" : ""}`];

  // Siblings with the same timeline fold into one line too.
  const said: { keys: string[]; text: string }[] = [];

  for (const line of timeline) {
    const text = timelineText(line, duration);
    const last = said.at(-1);
    const parent = (key: string) => key.split("/").slice(0, -1).join("/");

    if (last && last.text === text && parent(last.keys[0]!) === parent(line.key))
      last.keys.push(line.key);
    else said.push({ keys: [line.key], text });
  }

  const listed = new Set(timeline.map((line) => line.key));

  const still = entries.filter(
    (entry) => entry.node.kind !== "group" && !listed.has(entry.node.key),
  ).length;

  lines.push("timeline:");

  for (const { keys, text } of said) lines.push(`  ${keysText(keys)}: ${text}`);

  lines.push(
    `  the ${still} other shapes, texts and images show when their groups do and never change`,
  );

  for (const frame of frames) lines.push(`at ${seconds(frame.t)}:`, ...frameText(frame, byKey));

  return lines.join("\n");
};
