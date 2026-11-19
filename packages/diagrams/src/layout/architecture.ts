import { SceneError } from "svjeez/tools";

export type Side = "L" | "R" | "T" | "B";

export interface ArchitectureInput {
  readonly nodes: readonly { readonly id: string; readonly in?: string }[];
  readonly groups: readonly { readonly id: string; readonly in?: string }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly fromSide: Side;
    readonly toSide: Side;
  }[];
}

export interface Cell {
  readonly col: number;
  readonly row: number;
}

export interface CellBlock extends Cell {
  readonly cols: number;
  readonly rows: number;
}

export interface ArchitectureLayout {
  readonly nodes: ReadonlyMap<string, Cell>;
  readonly groups: ReadonlyMap<string, CellBlock>;
  readonly cols: number;
  readonly rows: number;
}

interface Item {
  readonly id: string;
  readonly parent: string | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
  placed: boolean;
}

interface Link {
  readonly a: string;
  readonly b: string;
  readonly sa: Side;
  readonly sb: Side;
}

const STEP: Readonly<Record<Side, readonly [number, number]>> = {
  L: [-1, 0],
  R: [1, 0],
  T: [0, -1],
  B: [0, 1],
};

const overlaps = (a: Item, x: number, y: number, w: number, h: number): boolean =>
  a.x < x + w && x < a.x + a.w && a.y < y + h && y < a.y + a.h;

/**
 * Puts every service and junction in a grid cell so that an edge leaving side `R` of one reaches the
 * cell to its right, and so on. A group is a block of cells that holds only its own members.
 */
export function architecture(input: ArchitectureInput): ArchitectureLayout {
  const items = new Map<string, Item>();
  const kids = new Map<string | undefined, string[]>();
  const isGroup = new Set(input.groups.map((g) => g.id));

  for (const entry of [...input.groups, ...input.nodes]) {
    if (items.has(entry.id))
      throw new SceneError(`architecture() has two cells named ${JSON.stringify(entry.id)}.`);

    if (entry.in !== undefined && !isGroup.has(entry.in))
      throw new SceneError(
        `architecture() puts ${JSON.stringify(entry.id)} in ${JSON.stringify(entry.in)}, which is not a group.`,
      );

    if (entry.in === entry.id)
      throw new SceneError(`architecture() puts ${JSON.stringify(entry.id)} in itself.`);
    items.set(entry.id, { id: entry.id, parent: entry.in, x: 0, y: 0, w: 1, h: 1, placed: false });
    kids.set(entry.in, [...(kids.get(entry.in) ?? []), entry.id]);
  }

  const chain = (id: string): string[] => {
    const up = [id];

    for (let at = items.get(id)!.parent; at !== undefined; at = items.get(at)!.parent) {
      if (up.includes(at))
        throw new SceneError(`architecture() groups nest in a loop through ${JSON.stringify(at)}.`);
      up.push(at);
    }

    return up;
  };

  const depth = new Map(input.groups.map((g) => [g.id, chain(g.id).length] as const));

  const links = new Map<string | undefined, (Link & { ia: string; ib: string })[]>();

  for (const e of input.edges) {
    for (const id of [e.from, e.to])
      if (!items.has(id) || isGroup.has(id))
        throw new SceneError(
          `architecture() edge names ${JSON.stringify(id)}, which is not a service or junction.`,
        );
    const [up, other] = [chain(e.from), chain(e.to)];
    const common = up.slice(1).find((id) => other.includes(id));
    const ia = up[common === undefined ? up.length - 1 : up.indexOf(common) - 1]!;
    const ib = other[common === undefined ? other.length - 1 : other.indexOf(common) - 1]!;

    if (ia === ib) continue;
    const link = { a: e.from, b: e.to, sa: e.fromSide, sb: e.toSide, ia, ib };
    links.set(common, [...(links.get(common) ?? []), link]);
  }

  const offset = (node: string, within: string | undefined): readonly [number, number] => {
    let [x, y] = [0, 0];

    for (let item = items.get(node)!; item.id !== within;) {
      x += item.x;
      y += item.y;

      if (item.parent === undefined) break;
      item = items.get(item.parent)!;
    }

    return [x, y];
  };

  const root = { w: 0, h: 0 };

  const arrange = (container: string | undefined): void => {
    const members = (kids.get(container) ?? []).map((id) => items.get(id)!);
    const own = links.get(container) ?? [];
    const ordered = [...own.filter((k) => k.sa !== k.sb), ...own.filter((k) => k.sa === k.sb)];
    const parts: Item[][] = [];

    for (const start of members) {
      if (start.placed) continue;
      const part = [start];
      parts.push(part);
      [start.x, start.y, start.placed] = [0, 0, true];

      for (let i = 0; i < part.length; i++) {
        const from = part[i]!;

        for (const link of ordered) {
          const forward = link.ia === from.id;

          if (!forward && link.ib !== from.id) continue;
          const to = items.get(forward ? link.ib : link.ia)!;

          if (to.placed) continue;
          const [mine, theirs] = forward ? [link.a, link.b] : [link.b, link.a];
          const [sp, sq] = forward ? [link.sa, link.sb] : [link.sb, link.sa];
          const [pax, pay] = offset(mine, from.id);
          const [pbx, pby] = offset(theirs, to.id);
          const [dx, dy] = STEP[sp];
          const [ex, ey] = STEP[sq];
          const facing = dx + ex === 0 && dy + ey === 0;
          const [sx, sy] = sp === sq ? [dx === 0 ? 1 : 0, dx === 0 ? 0 : 1] : [dx, dy];
          const [shiftX, shiftY] = facing || sp === sq ? [0, 0] : [-ex, -ey];
          let bx: number;
          let by: number;

          if (sx !== 0) {
            bx = sx > 0 ? from.x + from.w : from.x - to.w;
            by = from.y + pay + shiftY - pby;
          } else {
            by = sy > 0 ? from.y + from.h : from.y - to.h;
            bx = from.x + pax + shiftX - pbx;
          }

          const taken = (x: number, y: number): boolean =>
            part.some((other) => overlaps(other, x, y, to.w, to.h));

          if (facing) {
            const [px, py] = [sx === 0 ? 1 : 0, sx === 0 ? 0 : 1];
            let k = 0;

            while (taken(bx + px * k, by + py * k)) k = k > 0 ? -k : 1 - k;
            [bx, by] = [bx + px * k, by + py * k];
          } else {
            while (taken(bx, by)) [bx, by] = [bx + sx, by + sy];
          }

          [to.x, to.y, to.placed] = [bx, by, true];
          part.push(to);
        }
      }
    }

    const boxes = parts.map((part) => {
      const x0 = Math.min(...part.map((p) => p.x));
      const y0 = Math.min(...part.map((p) => p.y));

      return {
        part,
        x0,
        y0,
        w: Math.max(...part.map((p) => p.x + p.w)) - x0,
        h: Math.max(...part.map((p) => p.y + p.h)) - y0,
      };
    });

    const area = boxes.reduce((sum, b) => sum + b.w * b.h, 0);
    const limit = Math.max(0, ...boxes.map((b) => b.w), Math.ceil(Math.sqrt(area * 2)));
    let [cx, cy, shelf, width] = [0, 0, 0, 0];

    for (const b of boxes) {
      if (cx > 0 && cx + b.w > limit) [cx, cy, shelf] = [0, cy + shelf, 0];

      for (const p of b.part) [p.x, p.y] = [p.x + cx - b.x0, p.y + cy - b.y0];
      cx += b.w;
      shelf = Math.max(shelf, b.h);
      width = Math.max(width, cx);
    }

    if (container !== undefined) {
      const group = items.get(container)!;
      [group.w, group.h] = [Math.max(1, width), Math.max(1, cy + shelf)];
    } else [root.w, root.h] = [width, cy + shelf];
  };

  const order = [...input.groups].sort((a, b) => depth.get(b.id)! - depth.get(a.id)!);

  for (const g of order) arrange(g.id);
  arrange(undefined);

  return {
    nodes: new Map(
      input.nodes.map((n) => {
        const [col, row] = offset(n.id, undefined);

        return [n.id, { col, row }] as const;
      }),
    ),
    groups: new Map(
      input.groups.map((g) => {
        const [col, row] = offset(g.id, undefined);
        const item = items.get(g.id)!;

        return [g.id, { col, row, cols: item.w, rows: item.h }] as const;
      }),
    ),
    cols: root.w,
    rows: root.h,
  };
}
