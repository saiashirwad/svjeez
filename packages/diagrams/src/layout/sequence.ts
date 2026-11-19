import { SceneError } from "svjeez/tools";
import { indexing, union, type Box, type Point, type Size } from "./box.ts";

export type SequenceRow =
  | {
      readonly kind: "message";
      readonly from: string;
      readonly to: string;
      readonly label: Size;
      /** Starts an activation bar on `to` at this message. */
      readonly activate?: boolean;
      /** Ends the innermost activation bar on `from` at this message. */
      readonly deactivate?: boolean;
    }
  | {
      readonly kind: "note";
      readonly actor: string;
      /** A second actor makes the note span from `actor` to `to`. */
      readonly to?: string;
      readonly side?: "over" | "left" | "right";
      readonly size: Size;
    }
  | { readonly kind: "activate"; readonly actor: string }
  | { readonly kind: "deactivate"; readonly actor: string }
  /** Opens a frame; without a `tab` it is a plain background (a `rect`). */
  | { readonly kind: "open"; readonly tab?: Size; readonly label?: Size }
  | { readonly kind: "divider"; readonly label?: Size }
  | { readonly kind: "close" };

interface SequenceInput {
  readonly actors: readonly ({ readonly id: string } & Size)[];
  readonly rows: readonly SequenceRow[];
  readonly title?: Size;
  /** Consecutive actors drawn inside one labelled box. */
  readonly boxes?: readonly { readonly actors: readonly string[]; readonly label?: Size }[];
  readonly actorGap?: number;
  readonly rowGap?: number;
}

export interface SequenceFrame {
  readonly box: Box;
  readonly tab: Box | undefined;
  readonly label: Box | undefined;
  readonly dividers: readonly {
    readonly y: number;
    readonly label: Box | undefined;
    readonly at: number;
  }[];
  /** How many messages and notes come before the frame opens. */
  readonly at: number;
}

export interface SequenceBar {
  readonly actor: string;
  readonly box: Box;
  /** How many messages and notes are placed once the bar starts. */
  readonly at: number;
  /** The same count once it ends. */
  readonly until: number;
}

export interface SequenceLayout {
  readonly heads: ReadonlyMap<string, Box>;
  readonly lifelines: ReadonlyMap<string, readonly [Point, Point]>;
  /** One per message and note, in order. */
  readonly rows: readonly { readonly points: readonly Point[]; readonly box: Box }[];
  readonly frames: readonly SequenceFrame[];
  readonly bars: readonly SequenceBar[];
  readonly boxes: readonly { readonly box: Box; readonly label: Box | undefined }[];
  readonly title: Box | undefined;
  readonly bounds: Box;
}

const LOOP = { w: 28, h: 18 };
const PAD = 16;
const FRAME = 10;
const BAR = { w: 8, step: 4 };
const NOTE_GAP = 10;

const tabbed = (tab: Size | undefined, label: Size | undefined): number =>
  tab ? tab.w + (label ? 8 + label.w : 0) : 0;

export function sequence(input: SequenceInput): SequenceLayout {
  const { actorGap = 32, rowGap = 14, actors } = input;

  const { unique, at } = indexing(
    actors.map((a) => a.id),
    (id) => `sequence() has no actor ${JSON.stringify(id)}.`,
  );

  if (!unique || actors.length === 0)
    throw new SceneError("sequence() needs actors with unique ids.");
  const gaps = actors.slice(1).map((a, i) => actors[i]!.w / 2 + a.w / 2 + actorGap);

  const need = (from: number, to: number, length: number) => {
    const have = gaps.slice(from, to).reduce((a, b) => a + b, 0);

    if (have < length) for (let k = from; k < to; k++) gaps[k]! += (length - have) / (to - from);
  };

  const demands: { from: number; to: number; length: number }[] = [];
  const nest: { lo: number; hi: number; header: number }[] = [];

  const touch = (...indexes: number[]) => {
    const top = nest.at(-1);

    if (top)
      for (const i of indexes) {
        top.lo = Math.min(top.lo, i);
        top.hi = Math.max(top.hi, i);
      }
  };

  for (const row of input.rows) {
    if (row.kind === "open")
      nest.push({ lo: Infinity, hi: -Infinity, header: tabbed(row.tab, row.label) });
    else if (row.kind === "close") {
      const frame = nest.pop();

      if (!frame) throw new SceneError("sequence() closes a block that was never opened.");

      if (frame.lo <= frame.hi) {
        if (frame.lo < frame.hi)
          demands.push({ from: frame.lo, to: frame.hi, length: frame.header - 2 * FRAME });
        else demands.push({ from: frame.lo, to: frame.lo + 1, length: frame.header });
        touch(frame.lo, frame.hi);
      }
    } else if (row.kind === "note") {
      const [i, j] = [at(row.actor), row.to === undefined ? undefined : at(row.to)];
      touch(i, j ?? i);

      if (j !== undefined)
        demands.push({
          from: Math.min(i, j),
          to: Math.max(i, j),
          length: row.size.w - 2 * PAD,
        });
      else if (row.side === "left")
        demands.push({ from: i - 1, to: i, length: row.size.w + 2 * NOTE_GAP });
      else if (row.side === "right")
        demands.push({ from: i, to: i + 1, length: row.size.w + 2 * NOTE_GAP });
      else
        demands.push(
          { from: i - 1, to: i, length: row.size.w / 2 + PAD },
          { from: i, to: i + 1, length: row.size.w / 2 + PAD },
        );
    } else if (row.kind === "message") {
      const [a, b] = [at(row.from), at(row.to)];
      touch(a, b);

      demands.push(
        a === b
          ? { from: a, to: a + 1, length: LOOP.w + 8 + row.label.w + PAD }
          : { from: Math.min(a, b), to: Math.max(a, b), length: row.label.w + 2 * PAD },
      );
    } else if (row.kind !== "divider") {
      at(row.actor);
    }
  }

  if (nest.length > 0) throw new SceneError("sequence() has a block that is never closed.");

  for (const { from, to, length } of demands.sort((p, q) => p.to - p.from - (q.to - q.from)))
    if (from >= 0 && to <= gaps.length) need(from, to, length);

  const centers = actors.map(
    (_, i) => actors[0]!.w / 2 + gaps.slice(0, i).reduce((s, g) => s + g, 0),
  );

  const tall = Math.max(...actors.map((a) => a.h));
  const top = input.title ? input.title.h + 14 : 0;
  const boxed = input.boxes ?? [];
  const caption = Math.max(0, ...boxed.map((b) => (b.label ? b.label.h + 6 : 0)));
  const base = top + (boxed.length > 0 ? caption + 6 : 0);

  const heads = new Map(
    actors.map((a, i) => [
      a.id,
      { x: centers[i]! - a.w / 2, y: base + (tall - a.h) / 2, w: a.w, h: a.h },
    ]),
  );

  let cursor = base + tall + 24;

  const bars: {
    actor: string;
    level: number;
    y: number;
    end: number | undefined;
    at: number;
    until: number;
  }[] = [];

  const stacks = new Map<string, typeof bars>(actors.map((a) => [a.id, []]));

  const start = (actor: string, y: number, count: number) => {
    const stack = stacks.get(actor)!;
    const bar = { actor, level: stack.length, y, end: undefined, at: count, until: Infinity };
    stack.push(bar);
    bars.push(bar);
  };

  const stop = (actor: string, y: number, count: number) => {
    const bar = stacks.get(actor)!.pop();

    if (!bar)
      throw new SceneError(
        `sequence() deactivates ${JSON.stringify(actor)}, which has no activation.`,
        "Activate it first, with an activate item or an activate message.",
      );
    bar.end = y;
    bar.until = count;
  };

  const edge = (actor: string, direction: number): number => {
    const level = stacks.get(actor)!.length;
    const x = centers[at(actor)]!;

    return level === 0 ? x : x + (level - 1) * BAR.step + (direction * BAR.w) / 2;
  };

  interface Open {
    lo: number;
    hi: number;
    top: number;
    tab: Size | undefined;
    label: Size | undefined;
    index: number;
    at: number;
    dividers: { y: number; label: Size | undefined; at: number }[];
  }

  const open: Open[] = [];
  const frames: SequenceFrame[] = [];
  const rows: { points: Point[]; box: Box }[] = [];

  const reach = (lo: number, hi: number) => {
    const frame = open.at(-1);

    if (frame) {
      frame.lo = Math.min(frame.lo, lo);
      frame.hi = Math.max(frame.hi, hi);
    }
  };

  const place = (row: { points: Point[]; box: Box }) => {
    rows.push(row);
    reach(row.box.x, row.box.x + row.box.w);

    for (const p of row.points) reach(p.x, p.x);
  };

  for (const row of input.rows) {
    if (row.kind === "open") {
      open.push({
        lo: Infinity,
        hi: -Infinity,
        top: cursor,
        tab: row.tab,
        label: row.label,
        index: frames.length,
        at: rows.length,
        dividers: [],
      });
      frames.push({
        box: { x: 0, y: 0, w: 0, h: 0 },
        tab: undefined,
        label: undefined,
        dividers: [],
        at: rows.length,
      });
      cursor += row.tab ? Math.max(row.tab.h, row.label?.h ?? 0) + 6 : 6;
      continue;
    }

    if (row.kind === "divider") {
      const y = cursor - 4;
      open.at(-1)!.dividers.push({ y, label: row.label, at: rows.length });
      cursor = row.label ? y + 3 + row.label.h + 6 : y + 10;
      continue;
    }

    if (row.kind === "close") {
      const f = open.pop()!;
      const bottom = cursor - 4;
      cursor = bottom + rowGap;
      const width = tabbed(f.tab, f.label);
      const left = (f.lo <= f.hi ? f.lo : centers[0]!) - FRAME;
      const right = Math.max((f.lo <= f.hi ? f.hi : centers[0]!) + FRAME, left + width);
      const box = { x: left, y: f.top, w: right - left, h: bottom - f.top };

      frames[f.index] = {
        box,
        tab: f.tab && { x: left, y: f.top, ...f.tab },
        label: f.label &&
          f.tab && {
            x: left + f.tab.w + 8,
            y: f.top + (f.tab.h - f.label.h) / 2,
            ...f.label,
          },
        dividers: f.dividers.map((d) => ({
          y: d.y,
          at: d.at,
          label: d.label && { x: left + 10, y: d.y + 3, ...d.label },
        })),
        at: f.at,
      };
      reach(box.x, box.x + box.w);
      continue;
    }

    if (row.kind === "activate") {
      start(row.actor, cursor - rowGap / 2, rows.length);
      continue;
    }

    if (row.kind === "deactivate") {
      stop(row.actor, cursor - rowGap / 2, rows.length);
      continue;
    }

    if (row.kind === "note") {
      const [a, b] = [centers[at(row.actor)]!, centers[at(row.to ?? row.actor)]!];
      const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
      let box: Box;

      if (row.to !== undefined) {
        const w = Math.max(row.size.w, hi - lo + 2 * PAD);
        box = { x: (lo + hi) / 2 - w / 2, y: cursor, w, h: row.size.h };
      } else if (row.side === "left")
        box = { x: a - NOTE_GAP - row.size.w, y: cursor, ...row.size };
      else if (row.side === "right") box = { x: a + NOTE_GAP, y: cursor, ...row.size };
      else box = { x: a - row.size.w / 2, y: cursor, ...row.size };

      cursor += row.size.h + rowGap;
      place({ points: [{ x: box.x + box.w / 2, y: box.y + box.h / 2 }], box });
      continue;
    }

    const [a, b] = [centers[at(row.from)]!, centers[at(row.to)]!];

    if (a === b) {
      const y = cursor + 4;
      const low = y + LOOP.h;
      const left = edge(row.from, 1);
      cursor = low + rowGap;

      if (row.deactivate) stop(row.from, low, rows.length + 1);

      if (row.activate) start(row.to, low, rows.length + 1);
      const right = edge(row.from, 1);
      const out = Math.max(left, right) + LOOP.w;

      place({
        points: [
          { x: left, y },
          { x: out, y },
          { x: out, y: low },
          { x: right, y: low },
        ],
        box: { x: out + 8, y: y + LOOP.h / 2 - row.label.h / 2, ...row.label },
      });
      continue;
    }

    const y = cursor + row.label.h + 4;
    cursor = y + rowGap;
    const direction = b > a ? 1 : -1;
    const from = edge(row.from, direction);

    if (row.deactivate) stop(row.from, y, rows.length + 1);

    if (row.activate) start(row.to, y, rows.length + 1);
    const to = edge(row.to, -direction);

    place({
      points: [
        { x: from, y },
        { x: to, y },
      ],
      box: { x: (a + b) / 2 - row.label.w / 2, y: cursor - rowGap - 4 - row.label.h, ...row.label },
    });
  }

  const bottom = cursor + 8;

  const lifelines = new Map(
    actors.map((a, i) => [
      a.id,
      [
        { x: centers[i]!, y: heads.get(a.id)!.y + a.h },
        { x: centers[i]!, y: bottom },
      ] as const,
    ]),
  );

  const grouped = boxed.map((g) => {
    const members = g.actors.map((id) => {
      at(id);

      return heads.get(id)!;
    });

    const [left, right] = [
      Math.min(...members.map((m) => m.x)) - 8,
      Math.max(...members.map((m) => m.x + m.w)) + 8,
    ];

    const w = Math.max(right - left, g.label ? g.label.w + 16 : 0);
    const x = (left + right) / 2 - w / 2;
    const box = { x, y: top, w, h: bottom + 6 - top };

    return {
      box,
      label: g.label && { x: x + (w - g.label.w) / 2, y: top + 4, ...g.label },
    };
  });

  const placedBars = bars
    .map((b) => ({
      actor: b.actor,
      at: b.at,
      until: Math.min(b.until, rows.length),
      level: b.level,
      box: {
        x: centers[at(b.actor)]! + b.level * BAR.step - BAR.w / 2,
        y: b.y,
        w: BAR.w,
        h: Math.max((b.end ?? cursor) - b.y, 2),
      },
    }))
    .sort((p, q) => p.level - q.level)
    .map((b) => ({ actor: b.actor, box: b.box, at: b.at, until: b.until }));

  const content = union([
    ...heads.values(),
    ...rows.map((r) => r.box),
    ...frames.map((f) => f.box),
    ...grouped.map((g) => g.box),
    { x: 0, y: 0, w: 0, h: bottom },
    ...rows.flatMap((r) => r.points.map((p) => ({ ...p, w: 0, h: 0 }))),
  ]);

  const heading = input.title && {
    x: content.x + content.w / 2 - input.title.w / 2,
    y: 0,
    ...input.title,
  };

  return {
    heads,
    lifelines,
    rows,
    frames,
    bars: placedBars,
    boxes: grouped,
    title: heading,
    bounds: heading ? union([content, heading]) : content,
  };
}
