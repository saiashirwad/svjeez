import { union, type Box, type Point, type Size } from "./box";

export interface LanesInput {
  readonly lanes: readonly { readonly id: string; readonly label: Size }[];
  readonly spans: readonly { readonly lane: string; readonly from: number; readonly to: number }[];
  readonly events: readonly { readonly lane: string; readonly at: number; readonly label?: Size }[];
  readonly links: readonly { readonly from: string; readonly to: string; readonly at: number }[];
  /** Pixels per second. */
  readonly scale: number;
  readonly rowHeight?: number;
  readonly bar?: number;
}

export interface LanesLayout {
  /** Each lane's whole row, label column included. */
  readonly rows: ReadonlyMap<string, Box>;
  readonly labels: ReadonlyMap<string, Point>;
  /** The time area: x(0) to x(end), every row. */
  readonly track: Box;
  readonly end: number;
  x(t: number): number;
  readonly spans: readonly Box[];
  readonly events: readonly { readonly at: Point; readonly label?: Box }[];
  readonly links: readonly (readonly [Point, Point])[];
  readonly ticks: readonly { readonly t: number; readonly x: number }[];
  readonly bounds: Box;
}

const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** One row per lane under a label column, time along x from 0 to the last moment. */
export function lanes(input: LanesInput): LanesLayout {
  const { scale, rowHeight = 56, bar = 18 } = input;
  if (!(scale > 0)) throw new Error(`lanes() needs a positive scale, got ${scale}.`);
  const index = new Map(input.lanes.map((l, i) => [l.id, i]));
  if (index.size !== input.lanes.length || index.size === 0) throw new Error("lanes() needs lanes with unique ids.");
  const row = (id: string): number => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`lanes() has no lane ${JSON.stringify(id)}.`);
    return i;
  };
  const times = [...input.spans.flatMap((s) => [s.from, s.to]), ...input.events.map((e) => e.at), ...input.links.map((l) => l.at)];
  if (times.some((t) => !(t >= 0 && Number.isFinite(t))) || input.spans.some((s) => !(s.to > s.from))) throw new Error("lanes() times must be finite and non-negative, and each span must end after it starts.");
  const end = Math.max(1, ...times);
  const column = Math.max(...input.lanes.map((l) => l.label.w)) + 24;
  const x = (t: number) => column + t * scale;
  const mid = (i: number) => i * rowHeight + rowHeight / 2;
  const rows = new Map(input.lanes.map((l, i) => [l.id, { x: 0, y: i * rowHeight, w: x(end) + 16, h: rowHeight }]));
  const labels = new Map(input.lanes.map((l, i) => [l.id, { x: 0, y: mid(i) }]));
  const spans = input.spans.map((s) => ({ x: x(s.from), y: mid(row(s.lane)) - bar / 2, w: (s.to - s.from) * scale, h: bar }));
  const events = input.events.map((e) => {
    const at = { x: x(e.at), y: mid(row(e.lane)) };
    return { at, label: e.label && { x: at.x - e.label.w / 2, y: at.y - bar / 2 - 6 - e.label.h, ...e.label } };
  });
  const links = input.links.map((l): readonly [Point, Point] => {
    const [a, b] = [row(l.from), row(l.to)];
    const dir = Math.sign(b - a);
    return [{ x: x(l.at), y: mid(a) + (dir * bar) / 2 }, { x: x(l.at), y: mid(b) - (dir * bar) / 2 }];
  });
  const step = NICE.find((s) => s * scale >= 56) ?? NICE.at(-1)!;
  const ticks = Array.from({ length: Math.floor(end / step + 1e-9) + 1 }, (_, k) => ({ t: k * step, x: x(k * step) }));
  const height = input.lanes.length * rowHeight;
  return {
    rows,
    labels,
    track: { x: x(0), y: 0, w: end * scale, h: height },
    end,
    x,
    spans,
    events,
    links,
    ticks,
    bounds: union([...rows.values(), ...events.flatMap((e) => (e.label ? [e.label] : [])), { x: 0, y: height, w: 0, h: 24 }]),
  };
}
