import { around, flip, simplify, union, type Box, type Direction, type Point, type Size } from "./box";

export interface LayeredInput {
  /** In order; the order seeds the left-to-right order within ranks. */
  readonly nodes: readonly ({ readonly id: string } & Size)[];
  readonly edges: readonly { readonly from: string; readonly to: string; readonly label?: Size }[];
  /** A node belongs to at most one group. The label sits inside the box, top-left. */
  readonly groups?: readonly { readonly id: string; readonly members: readonly string[]; readonly label: Size }[];
  readonly direction?: Direction;
  readonly rankGap?: number;
  readonly nodeGap?: number;
  readonly groupPad?: number;
}

export interface LayeredEdge {
  readonly from: string;
  readonly to: string;
  /** Orthogonal, from the border of `from` to the border of `to`. */
  readonly points: readonly Point[];
  readonly label?: Box;
}

export interface Layered {
  readonly nodes: ReadonlyMap<string, Box>;
  readonly rank: ReadonlyMap<string, number>;
  /** Same order as the input edges. */
  readonly edges: readonly LayeredEdge[];
  readonly groups: ReadonlyMap<string, Box>;
  readonly bounds: Box;
}

interface Vertex {
  /** Index of the input node; undefined for a dummy on a long edge. */
  readonly node?: number;
  readonly rank: number;
  readonly w: number;
  readonly h: number;
  readonly group: number;
  readonly up: number[];
  readonly down: number[];
  /** Segment ids, parallel to `up` and `down`. */
  readonly ins: number[];
  readonly outs: number[];
  /** Room on the right for a self loop and its label. */
  loop: number;
}

const LOOP = 20;
const PORT = 12;
const LABEL_GAP = 6;

/**
 * Sugiyama-lite in TB space; LR is the same layout transposed. DFS back edges are reversed, ranks are longest
 * paths, a long edge gets a dummy vertex in every rank it crosses, barycenter sweeps order each rank with groups
 * kept contiguous, then x positions relax toward neighbours under separation constraints.
 */
export function layered(input: LayeredInput): Layered {
  const { direction = "TB", rankGap = 48, nodeGap = 36, groupPad = 12 } = input;
  const lr = direction === "LR";
  const index = new Map(input.nodes.map((n, i) => [n.id, i]));
  if (index.size !== input.nodes.length) throw new Error("layered() node ids must be unique.");
  const at = (id: string): number => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`layered() has no node ${JSON.stringify(id)}.`);
    return i;
  };
  const size = (s: Size): Size => (lr ? { w: s.h, h: s.w } : s);
  const groups = (input.groups ?? []).map((g) => ({ id: g.id, members: g.members.map(at), label: size(g.label) }));
  const groupOf = input.nodes.map(() => -1);
  groups.forEach((g, gi) => {
    if (g.members.length === 0) throw new Error(`Group ${JSON.stringify(g.id)} has no members.`);
    for (const m of g.members) {
      if (groupOf[m] !== -1) throw new Error(`Node ${JSON.stringify(input.nodes[m]!.id)} is in two groups.`);
      groupOf[m] = gi;
    }
  });

  const edges = input.edges.map((e, i) => ({ i, u: at(e.from), v: at(e.to), label: e.label && size(e.label) }));
  const proper = edges.filter((e) => e.u !== e.v);
  const reversed = backEdges(input.nodes.length, proper);
  const directed = proper.map((e) => (reversed.has(e.i) ? { ...e, u: e.v, v: e.u } : e));

  const rank = longestPath(input.nodes.length, directed);
  const vertices: Vertex[] = input.nodes.map((n, i) => ({ node: i, rank: rank[i]!, ...size(n), group: groupOf[i]!, up: [], down: [], ins: [], outs: [], loop: 0 }));
  for (const e of edges) if (e.u === e.v) vertices[e.u]!.loop = Math.max(vertices[e.u]!.loop, LOOP + 4 + (e.label ? LABEL_GAP + e.label.w : 0));
  const chains = new Map<number, number[]>();
  let segments = 0;
  for (const e of directed) {
    const chain = [e.u];
    const shared = groupOf[e.u] === groupOf[e.v] ? groupOf[e.u]! : -1;
    for (let r = rank[e.u]! + 1; r < rank[e.v]!; r++) chain.push(vertices.push({ rank: r, w: 0, h: 0, group: shared, up: [], down: [], ins: [], outs: [], loop: 0 }) - 1);
    chain.push(e.v);
    chain.slice(1).forEach((v, k) => {
      const segment = segments++;
      vertices[chain[k]!]!.down.push(v);
      vertices[chain[k]!]!.outs.push(segment);
      vertices[v]!.up.push(chain[k]!);
      vertices[v]!.ins.push(segment);
    });
    chains.set(e.i, chain);
  }

  const { layers, key, groupKey } = order(vertices, Math.max(0, ...rank) + 1, groups.length);
  const xs = place(vertices, layers, key, groupKey, { nodeGap, groupPad, labels: groups.map((g) => g.label), lr });

  const thick = layers.map((layer) => Math.max(0, ...layer.map((v) => vertices[v]!.h)));
  const padTop = groups.map((g) => groupPad + (lr ? 0 : g.label.h + 4));
  const gaps = thick.slice(1).map((_, r) => {
    const below = groups.reduce((m, _, g) => (xs.span[g]![1] === r ? Math.max(m, groupPad) : m), 0);
    const above = groups.reduce((m, _, g) => (xs.span[g]![0] === r + 1 ? Math.max(m, padTop[g]!) : m), 0);
    const labels = directed.reduce((m, e) => (e.label && rank[e.v] === r + 1 ? Math.max(m, 2 * (e.label.h + 8)) : m), 0);
    return Math.max(rankGap, below + above + 16, labels);
  });
  const top: number[] = [];
  thick.forEach((_, r) => top.push(r === 0 ? 0 : top[r - 1]! + thick[r - 1]! + gaps[r - 1]!));

  const box = (v: number): Box => {
    const { w, h, rank: r } = vertices[v]!;
    return { x: xs.center[v]! - w / 2, y: top[r]! + (thick[r]! - h) / 2, w, h };
  };
  /** Each segment's x on one side of `v`, ordered by where its other end sits so they do not cross. */
  const ports = (v: number, others: readonly number[], ids: readonly number[]): Map<number, number> => {
    const sorted = others.map((o, k) => ({ o, id: ids[k]! })).sort((a, b) => xs.center[a.o]! - xs.center[b.o]! || a.id - b.id);
    const step = Math.min(PORT, vertices[v]!.w / (sorted.length + 1));
    return new Map(sorted.map(({ id }, k) => [id, xs.center[v]! + (k - (sorted.length - 1) / 2) * step]));
  };
  const outPorts = vertices.map((v, i) => ports(i, v.down, v.outs));
  const inPorts = vertices.map((v, i) => ports(i, v.up, v.ins));

  const laid = edges.map(({ i, u, v, label }): LayeredEdge => {
    const { from, to } = input.edges[i]!;
    if (u === v) {
      const b = box(u);
      const [y1, y2, x] = [b.y + b.h * 0.3, b.y + b.h * 0.7, b.x + b.w];
      const points = [{ x, y: y1 }, { x: x + LOOP, y: y1 }, { x: x + LOOP, y: y2 }, { x, y: y2 }];
      return transpose({ from, to, points, label: label && { x: x + LOOP + LABEL_GAP, y: (y1 + y2) / 2 - label.h / 2, ...label } }, lr);
    }
    const chain = chains.get(i)!;
    const points: Point[] = [];
    let labelBox: Box | undefined;
    chain.slice(1).forEach((b, k) => {
      const a = chain[k]!;
      const segment = vertices[a]!.outs[vertices[a]!.down.indexOf(b)]!;
      const [xa, xb] = [outPorts[a]!.get(segment)!, inPorts[b]!.get(segment)!];
      const r = vertices[a]!.rank;
      const mid = top[r]! + thick[r]! + gaps[r]! / 2;
      const exit = vertices[a]!.node === undefined ? top[r]! + thick[r]! : box(a).y + box(a).h;
      const entry = vertices[b]!.node === undefined ? top[r + 1]! : box(b).y;
      points.push({ x: xa, y: exit }, { x: xa, y: mid }, { x: xb, y: mid }, { x: xb, y: entry });
      if (k === chain.length - 2 && label) {
        const left = xb < xs.center[b]!;
        labelBox = { x: left ? xb - LABEL_GAP - label.w : xb + LABEL_GAP, y: mid + (entry - mid - label.h) / 2, ...label };
      }
    });
    const route = simplify(points);
    return transpose({ from, to, points: reversed.has(i) ? route.reverse() : route, label: labelBox }, lr);
  });

  const nodes = new Map(input.nodes.map((n, i) => [n.id, lr ? flip(box(i)) : box(i)]));
  const groupBoxes = new Map(
    groups.map((g, gi) => {
      const [r0, r1] = xs.span[gi]!;
      const y = top[r0]! - padTop[gi]!;
      const b = { x: xs.group[gi]! - xs.width[gi]! / 2, y, w: xs.width[gi]!, h: top[r1]! + thick[r1]! + groupPad - y };
      return [g.id, lr ? flip(b) : b];
    }),
  );
  const bounds = union([...nodes.values(), ...groupBoxes.values(), ...laid.flatMap((e) => [around(e.points), ...(e.label ? [e.label] : [])])]);
  return { nodes, rank: new Map(input.nodes.map((n, i) => [n.id, rank[i]!])), edges: laid, groups: groupBoxes, bounds };
}

const transpose = (edge: LayeredEdge, lr: boolean): LayeredEdge => (lr ? { ...edge, points: edge.points.map(flip), label: edge.label && flip(edge.label) } : edge);

/** Edges that close a cycle in a DFS from each node in input order. */
const backEdges = (count: number, edges: readonly { i: number; u: number; v: number }[]): Set<number> => {
  const out = Array.from({ length: count }, (): { i: number; v: number }[] => []);
  for (const e of edges) out[e.u]!.push(e);
  const state = new Uint8Array(count);
  const back = new Set<number>();
  for (let root = 0; root < count; root++) {
    if (state[root]) continue;
    const stack: [number, number][] = [[root, 0]];
    state[root] = 1;
    while (stack.length > 0) {
      const frame = stack.at(-1)!;
      const e = out[frame[0]]![frame[1]++];
      if (!e) {
        state[frame[0]] = 2;
        stack.pop();
      } else if (state[e.v] === 1) back.add(e.i);
      else if (state[e.v] === 0) {
        state[e.v] = 1;
        stack.push([e.v, 0]);
      }
    }
  }
  return back;
};

const longestPath = (count: number, edges: readonly { u: number; v: number }[]): number[] => {
  const rank = new Array<number>(count).fill(0);
  const indegree = new Array<number>(count).fill(0);
  for (const e of edges) indegree[e.v]!++;
  const queue = rank.flatMap((_, i) => (indegree[i] === 0 ? [i] : []));
  for (let k = 0; k < queue.length; k++) {
    const u = queue[k]!;
    for (const e of edges) {
      if (e.u !== u) continue;
      rank[e.v] = Math.max(rank[e.v]!, rank[u]! + 1);
      if (--indegree[e.v]! === 0) queue.push(e.v);
    }
  }
  return rank;
};

const mean = (values: readonly number[]): number | undefined => (values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length);

/**
 * Barycenter sweeps down and up, a group's members sorted together so they stay contiguous. The final key
 * gives each group one value in every rank, so groups keep the same left-to-right order throughout.
 */
const order = (vertices: readonly Vertex[], ranks: number, groups: number) => {
  const layers = Array.from({ length: ranks }, (): number[] => []);
  vertices.forEach((v, i) => layers[v.rank]!.push(i));
  const pos = new Float64Array(vertices.length);
  const index = () => layers.forEach((layer) => layer.forEach((v, k) => (pos[v] = (k + 0.5) / layer.length)));
  const sortLayer = (layer: number[], key: (v: number) => number, bary: (v: number) => number) =>
    layer.sort((a, b) => key(a) - key(b) || vertices[a]!.group - vertices[b]!.group || bary(a) - bary(b));
  index();
  for (let sweep = 0; sweep < 8; sweep++) {
    const down = sweep % 2 === 0;
    for (let k = 1; k < ranks; k++) {
      const layer = layers[down ? k : ranks - 1 - k]!;
      const bary = new Map(layer.map((v) => [v, mean((down ? vertices[v]!.up : vertices[v]!.down).map((n) => pos[n]!)) ?? pos[v]!]));
      const groupBary = new Map<number, number>();
      for (let g = 0; g < groups; g++) {
        const m = mean(layer.flatMap((v) => (vertices[v]!.group === g ? [bary.get(v)!] : [])));
        if (m !== undefined) groupBary.set(g, m);
      }
      const b = (v: number) => bary.get(v)!;
      sortLayer(layer, (v) => (vertices[v]!.group >= 0 ? groupBary.get(vertices[v]!.group)! : b(v)), b);
      index();
    }
  }
  const settled = Float64Array.from(pos);
  const groupKey = Array.from({ length: groups }, (_, g) => mean(vertices.flatMap((v, i) => (v.group === g ? [settled[i]!] : []))) ?? 0);
  const key = (v: number) => (vertices[v]!.group >= 0 ? groupKey[vertices[v]!.group]! : settled[v]!);
  for (const layer of layers) sortLayer(layer, key, (v) => settled[v]!);
  return { layers, key, groupKey };
};

interface Item {
  readonly kind: "v" | "g";
  readonly id: number;
  /** Extent left and right of its x. */
  readonly l: number;
  readonly r: number;
  readonly gap: number;
  readonly key: number;
}

/**
 * Each rank is a row of items: an ungrouped vertex, or a group column with its members packed and centered inside.
 * A group keeps one column through every rank it spans, so no other vertex can sit inside its box.
 * Items start packed left, then each moves toward the mean of its neighbours, clamped between the items beside it.
 */
const place = (
  vertices: readonly Vertex[],
  layers: readonly number[][],
  key: (v: number) => number,
  groupKey: readonly number[],
  o: { readonly nodeGap: number; readonly groupPad: number; readonly labels: readonly Size[]; readonly lr: boolean },
) => {
  const groups = groupKey.length;
  const gapOf = (v: number) => (vertices[v]!.node === undefined ? o.nodeGap / 2 : o.nodeGap);
  const pads = o.labels.map((label) => ({ left: o.groupPad + (o.lr ? label.w + 4 : 0), right: o.groupPad, min: o.lr ? 0 : label.w + 2 * o.groupPad }));
  const members = (layer: readonly number[], g: number) => layer.filter((v) => vertices[v]!.group === g);
  const inner = (layer: readonly number[], g: number) =>
    members(layer, g).reduce((w, v, k, all) => w + vertices[v]!.w + vertices[v]!.loop + (k > 0 ? Math.max(gapOf(v), gapOf(all[k - 1]!)) : 0), 0);
  const width = Array.from({ length: groups }, (_, g) => Math.max(pads[g]!.min, Math.max(...layers.map((layer) => inner(layer, g))) + pads[g]!.left + pads[g]!.right));
  const span = Array.from({ length: groups }, (_, g) => {
    const rs = vertices.flatMap((v) => (v.group === g ? [v.rank] : []));
    return [Math.min(...rs), Math.max(...rs)] as const;
  });

  const rows: Item[][] = layers.map((layer, r) => {
    const items = layer.flatMap((v): Item[] => {
      const { w, loop, group } = vertices[v]!;
      return group < 0 ? [{ kind: "v", id: v, l: w / 2, r: w / 2 + loop, gap: gapOf(v), key: key(v) }] : [];
    });
    for (let g = 0; g < groups; g++) if (r >= span[g]![0] && r <= span[g]![1]) items.push({ kind: "g", id: g, l: width[g]! / 2, r: width[g]! / 2, gap: o.nodeGap, key: groupKey[g]! });
    return items.sort((a, b) => a.key - b.key || (a.kind === b.kind ? 0 : a.kind === "v" ? -1 : 1));
  });

  const vx = new Array<number>(vertices.length).fill(0);
  const gx = new Array<number>(groups).fill(0);
  const get = (it: Item) => (it.kind === "v" ? vx[it.id]! : gx[it.id]!);
  const set = (it: Item, value: number) => (it.kind === "v" ? (vx[it.id] = value) : (gx[it.id] = value));
  const sep = (a: Item, b: Item) => a.r + b.l + Math.max(a.gap, b.gap);
  for (let changed = true; changed; ) {
    changed = false;
    for (const row of rows) {
      row.forEach((it, k) => {
        const need = k === 0 ? it.l : get(row[k - 1]!) + sep(row[k - 1]!, it);
        if (get(it) < need - 1e-9) {
          set(it, need);
          changed = true;
        }
      });
    }
  }

  const offset = new Array<number>(vertices.length).fill(0);
  for (const layer of layers) {
    for (let g = 0; g < groups; g++) {
      let cursor = -inner(layer, g) / 2 + (pads[g]!.left - pads[g]!.right) / 2;
      members(layer, g).forEach((v, k, all) => {
        if (k > 0) cursor += Math.max(gapOf(v), gapOf(all[k - 1]!));
        offset[v] = cursor + vertices[v]!.w / 2;
        cursor += vertices[v]!.w + vertices[v]!.loop;
      });
    }
  }
  const center = (v: number) => (vertices[v]!.group < 0 ? vx[v]! : gx[vertices[v]!.group]! + offset[v]!);
  const neighbours = (v: number) => [...vertices[v]!.up, ...vertices[v]!.down];

  const occurrences = new Map<string, { row: Item[]; k: number }[]>();
  for (const row of rows) row.forEach((it, k) => occurrences.set(`${it.kind}${it.id}`, [...(occurrences.get(`${it.kind}${it.id}`) ?? []), { row, k }]));
  const items = [...occurrences.values()].map((list) => list[0]!.row[list[0]!.k]!);
  for (let sweep = 0; sweep < 60; sweep++) {
    for (const it of sweep % 2 ? [...items].reverse() : items) {
      const pulls =
        it.kind === "v"
          ? neighbours(it.id).map(center)
          : vertices.flatMap((v, i) => (v.group === it.id ? neighbours(i).filter((n) => vertices[n]!.group !== it.id).map((n) => gx[it.id]! + center(n) - center(i)) : []));
      const want = mean(pulls);
      if (want === undefined) continue;
      let [lo, hi] = [-Infinity, Infinity];
      for (const { row, k } of occurrences.get(`${it.kind}${it.id}`)!) {
        if (k > 0) lo = Math.max(lo, get(row[k - 1]!) + sep(row[k - 1]!, it));
        if (k < row.length - 1) hi = Math.min(hi, get(row[k + 1]!) - sep(it, row[k + 1]!));
      }
      set(it, Math.min(hi, Math.max(lo, want)));
    }
  }

  const left = Math.min(...rows.flatMap((row) => row.map((it) => get(it) - it.l)));
  return { center: vertices.map((_, v) => center(v) - left), group: gx.map((x) => x - left), width, span };
};
