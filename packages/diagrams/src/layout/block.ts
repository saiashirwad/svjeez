import { SceneError } from "svjeez/tools";
import { simplify, union, type Box, type Point, type Size } from "./box.ts";

/** A cell of the grid: a block with a size, a `space`, or a group holding cells of its own. */
export interface BlockCell {
  /** Blocks and groups need one; spaces do not. */
  readonly id?: string;
  /** Columns the cell takes up, 1 by default. */
  readonly span?: number;
  readonly space?: boolean;
  /** What a block needs. For a group, the least it needs: its title. */
  readonly size?: Size;
  /** Height a group keeps free above its grid for its title. */
  readonly head?: number;
  /** Columns of a group's grid; by default its cells share one row. */
  readonly columns?: number;
  readonly cells?: readonly BlockCell[];
}

export interface BlockInput {
  readonly cells: readonly BlockCell[];
  readonly columns?: number;
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly gap?: number;
}

export interface BlockLayout {
  readonly boxes: ReadonlyMap<string, Box>;
  readonly edges: readonly (readonly Point[])[];
  readonly bounds: Box;
}

interface Slot {
  readonly cell: BlockCell;
  readonly kids: Slot[];
  readonly group: boolean;
  span: number;
  col: number;
  row: number;
  cols: number;
  heights: number[];
  w: number;
  h: number;
  x: number;
  y: number;
}

const MAX_SPAN = 1000;
const BEND = 24;

const slotOf = (cell: BlockCell): Slot => ({
  cell,
  kids: (cell.cells ?? []).map(slotOf),
  group: cell.cells !== undefined,
  span: Math.max(1, Math.min(MAX_SPAN, Math.floor(cell.span ?? 1))),
  col: 0,
  row: 0,
  cols: 0,
  heights: [],
  w: cell.size?.w ?? 0,
  h: cell.size?.h ?? 0,
  x: 0,
  y: 0,
});

const measure = (slot: Slot, gap: number, inset: number): void => {
  for (const kid of slot.kids) if (kid.group) measure(kid, gap, gap);
  const columns = slot.cell.columns ?? -1;
  const tallest = Math.max(0, ...slot.kids.filter((k) => !k.group).map((k) => k.h));
  let [position, cols, cw] = [0, 0, 0];
  const heights: number[] = [];

  for (const kid of slot.kids) {
    const px = columns > 0 ? position % columns : position;
    kid.row = columns > 0 ? Math.floor(position / columns) : 0;
    kid.col = px;

    if (columns > 0) kid.span = Math.min(kid.span, columns - px);
    position += kid.span;
    cols = Math.max(cols, px + kid.span);
    heights[kid.row] = Math.max(heights[kid.row] ?? 0, kid.group ? kid.h : tallest);

    if (!kid.cell.space) cw = Math.max(cw, (kid.w - gap * (kid.span - 1)) / kid.span);
  }

  slot.cols = cols;
  slot.heights = heights;
  const head = slot.cell.head ?? 0;
  const rows = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * gap;
  slot.w = Math.max(slot.w, cols * cw + Math.max(0, cols - 1) * gap + 2 * inset);
  slot.h = Math.max(slot.h, rows + 2 * inset + head);
};

const arrange = (slot: Slot, gap: number, inset: number): void => {
  const { cols, heights } = slot;

  if (cols === 0) return;
  const cw = (slot.w - 2 * inset - (cols - 1) * gap) / cols;
  const needed = heights.reduce((sum, h) => sum + h, 0);
  const room = slot.h - 2 * inset - (slot.cell.head ?? 0) - (heights.length - 1) * gap;
  const scale = needed > 0 ? room / needed : 0;
  const tops: number[] = [];
  let y = slot.y + inset + (slot.cell.head ?? 0);

  for (const h of heights) {
    tops.push(y);
    y += h * scale + gap;
  }

  for (const kid of slot.kids) {
    kid.x = slot.x + inset + kid.col * (cw + gap);
    kid.y = tops[kid.row]!;
    kid.w = cw * kid.span + gap * (kid.span - 1);
    kid.h = heights[kid.row]! * scale;

    if (kid.group) arrange(kid, gap, gap);
  }
};

const walk = (slot: Slot, visit: (slot: Slot) => void): void => {
  for (const kid of slot.kids) {
    visit(kid);
    walk(kid, visit);
  }
};

class Heap {
  readonly #items: [number, number][] = [];
  get size(): number {
    return this.#items.length;
  }
  push(cost: number, state: number): void {
    const a = this.#items;
    a.push([cost, state]);

    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;

      if (this.#less(a[p]!, a[i]!)) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.#items;
    const top = a[0]!;
    const last = a.pop()!;

    if (a.length > 0) {
      a[0] = last;

      for (let i = 0; ;) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let m = i;

        if (l < a.length && this.#less(a[l]!, a[m]!)) m = l;

        if (r < a.length && this.#less(a[r]!, a[m]!)) m = r;

        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }

    return top;
  }
  #less(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  }
}

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const lines = (values: readonly number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1]! > 0.01);
};

const crosses = (box: Box, a: Point, b: Point): boolean => {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];

  return (
    x1 > box.x + 0.5 && x0 < box.x + box.w - 0.5 && y1 > box.y + 0.5 && y0 < box.y + box.h - 0.5
  );
};

/** Lays cells out on a grid, then routes each edge along the gutters between the blocks. */
export function block(input: BlockInput): BlockLayout {
  const gap = input.gap ?? 24;
  const root = slotOf({ columns: input.columns, cells: input.cells });

  const ids = new Set<string>();
  const leaves: Slot[] = [];
  const all: Slot[] = [];

  walk(root, (slot) => {
    const id = slot.cell.id;

    if (slot.cell.space) return;

    if (id === undefined || id === "")
      throw new SceneError("block() cells need an id unless they are spaces.");

    if (ids.has(id)) throw new SceneError(`block() has two cells named ${JSON.stringify(id)}.`);
    ids.add(id);
    all.push(slot);

    if (!slot.group) leaves.push(slot);
  });

  measure(root, gap, 0);
  arrange(root, gap, 0);

  const boxOf = (s: Slot): Box => ({ x: s.x, y: s.y, w: s.w, h: s.h });
  const boxes = new Map(all.map((s) => [s.cell.id!, boxOf(s)] as const));
  const obstacles = leaves.map(boxOf);
  const pad = gap / 2;
  const xs = lines(all.flatMap((s) => [s.x + s.w / 2, s.x - pad, s.x + s.w + pad]));
  const ys = lines(all.flatMap((s) => [s.y + s.h / 2, s.y - pad, s.y + s.h + pad]));

  const at = (values: number[], v: number): number =>
    values.findIndex((x) => Math.abs(x - v) < 0.02);

  const used = new Set<string>();
  const blocked = new Map<string, boolean>();

  const free = (a: Point, b: Point): boolean => {
    const key = `${a.x},${a.y},${b.x},${b.y}`;
    let known = blocked.get(key);

    if (known === undefined) {
      known = obstacles.some((o) => crosses(o, a, b));
      blocked.set(key, known);
    }

    return !known;
  };

  const route = (from: string, to: string): Point[] => {
    const [a, b] = [boxes.get(from), boxes.get(to)];

    if (!a || !b)
      throw new SceneError(
        `block() edge ${JSON.stringify(`${from}->${to}`)} names an unknown block.`,
      );

    if (from === to) throw new SceneError(`block() edge "${from}" leads back to itself.`);

    const sides = (r: Box) => [
      { out: { x: r.x + r.w / 2, y: r.y }, dir: 0 },
      { out: { x: r.x + r.w, y: r.y + r.h / 2 }, dir: 1 },
      { out: { x: r.x + r.w / 2, y: r.y + r.h }, dir: 2 },
      { out: { x: r.x, y: r.y + r.h / 2 }, dir: 3 },
    ];

    const node = (p: Point, dir: number): number => {
      const [dx, dy] = DIRS[dir]!;

      return at(ys, p.y + dy * pad) * xs.length + at(xs, p.x + dx * pad);
    };

    const cost = new Map<number, number>();
    const via = new Map<number, number>();
    const heap = new Heap();
    const starts = new Map<number, Point>();

    for (const s of sides(a)) {
      const state = node(s.out, s.dir) * 4 + s.dir;

      if (cost.has(state)) continue;
      cost.set(state, pad);
      starts.set(state, s.out);
      heap.push(pad, state);
    }

    const ends = new Map(sides(b).map((s) => [node(s.out, s.dir), s] as const));
    let best: { total: number; state: number; end: Point } | undefined;

    while (heap.size > 0) {
      const [c, state] = heap.pop();

      if (c > (cost.get(state) ?? Infinity)) continue;
      const [n, dir] = [Math.floor(state / 4), state % 4];
      const [ix, iy] = [n % xs.length, Math.floor(n / xs.length)];
      const target = ends.get(n);

      if (target) {
        const total = c + pad + (dir === (target.dir + 2) % 4 ? 0 : BEND);

        if (!best || total < best.total) best = { total, state, end: target.out };
      }

      if (best && c >= best.total) break;

      for (let d = 0; d < 4; d++) {
        const [nx, ny] = [ix + DIRS[d]![0], iy + DIRS[d]![1]];

        if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;

        const [p, q] = [
          { x: xs[ix]!, y: ys[iy]! },
          { x: xs[nx]!, y: ys[ny]! },
        ];

        if (!free(p, q)) continue;
        const key = `${Math.min(p.x, q.x)},${Math.min(p.y, q.y)},${d % 2}`;
        const step = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
        const next = c + step + (d === dir ? 0 : BEND) + (used.has(key) ? gap : 0);
        const s = (ny * xs.length + nx) * 4 + d;

        if (next < (cost.get(s) ?? Infinity)) {
          cost.set(s, next);
          via.set(s, state);
          heap.push(next, s);
        }
      }
    }

    if (!best)
      throw new SceneError(
        `block() cannot route an edge from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`,
        "Leave a space between the blocks, so the line has a way through.",
      );

    const path: Point[] = [best.end];

    for (let s: number | undefined = best.state; s !== undefined; s = via.get(s)) {
      const n = Math.floor(s / 4);
      path.unshift({ x: xs[n % xs.length]!, y: ys[Math.floor(n / xs.length)]! });

      if (!via.has(s)) path.unshift(starts.get(s)!);
    }

    for (let i = 1; i < path.length; i++) {
      const [p, q] = [path[i - 1]!, path[i]!];
      used.add(`${Math.min(p.x, q.x)},${Math.min(p.y, q.y)},${p.x === q.x ? 0 : 1}`);
    }

    return simplify(path);
  };

  const edges = input.edges.map((e) => route(e.from, e.to));

  const bounds = union([
    ...boxes.values(),
    ...edges.flatMap((e) => e.map((p) => ({ ...p, w: 0, h: 0 }))),
  ]);

  return { boxes, edges, bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h } };
}
