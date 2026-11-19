import { SceneError } from "svjeez/tools";
import { groupBy } from "./group.ts";
import {
  around,
  flip,
  indexing,
  simplify,
  union,
  type Box,
  type Direction,
  type Point,
  type Size,
} from "./box.ts";
import { placeLabels, tracks, type Crossing } from "./route.ts";

export interface LayeredInput {
  readonly nodes: readonly ({ readonly id: string } & Size)[];
  readonly edges: readonly { readonly from: string; readonly to: string; readonly label?: Size }[];
  readonly groups?: readonly {
    readonly id: string;
    readonly members: readonly string[];
    readonly label: Size;
  }[];
  readonly direction?: Direction;
  readonly rankGap?: number;
  readonly nodeGap?: number;
  readonly groupPad?: number;
}

interface LayeredEdge {
  readonly from: string;
  readonly to: string;
  readonly points: readonly Point[];
  readonly label?: Box;
}

export interface LayeredLayout {
  readonly nodes: ReadonlyMap<string, Box>;
  readonly rank: ReadonlyMap<string, number>;
  readonly edges: readonly LayeredEdge[];
  readonly groups: ReadonlyMap<string, Box>;
  readonly bounds: Box;
}

interface Vertex {
  readonly node?: number;
  readonly rank: number;
  readonly w: number;
  readonly h: number;
  group: number;
  readonly up: number[];
  readonly down: number[];
  readonly outs: number[];
  readonly anchor?: number;
  readonly back?: number;
  outer?: "left" | "right";
  loop: number;
}

const LOOP = 20;
const PITCH = 16;
const MARGIN = 10;
const TRACK = 14;
const SNAP = 12;
const BEND_SNAP = 24;
const SLOPE = 0.125;
const MAX_GAP = 3;

export const BEND = 16;

export function layered(input: LayeredInput): LayeredLayout {
  const { direction = "TB", rankGap = 48, nodeGap = 36, groupPad = 12 } = input;
  const lr = direction === "LR";

  const { unique, at } = indexing(
    input.nodes.map((n) => n.id),
    (id) => `layered() has no node ${JSON.stringify(id)}.`,
  );

  if (!unique) throw new SceneError("layered() node ids must be unique.");
  const size = (s: Size): Size => (lr ? { w: s.h, h: s.w } : s);

  const groups = (input.groups ?? []).map((g) => ({
    id: g.id,
    members: g.members.map(at),
    label: size(g.label),
  }));

  const groupOf = input.nodes.map(() => -1);
  groups.forEach((g, gi) => {
    if (g.members.length === 0)
      throw new SceneError(`Group ${JSON.stringify(g.id)} has no members.`);

    for (const m of g.members) {
      if (groupOf[m] !== -1)
        throw new SceneError(`Node ${JSON.stringify(input.nodes[m]!.id)} is in two groups.`);
      groupOf[m] = gi;
    }
  });

  const edges = input.edges.map((e, i) => ({
    i,
    u: at(e.from),
    v: at(e.to),
    label: e.label && size(e.label),
  }));

  const proper = edges.filter((e) => e.u !== e.v);
  const reversed = backEdges(input.nodes.length, proper);
  const directed = proper.map((e) => (reversed.has(e.i) ? { ...e, u: e.v, v: e.u } : e));

  const rank = longestPath(input.nodes.length, directed);

  const vertices: Vertex[] = input.nodes.map((n, i) => ({
    node: i,
    rank: rank[i]!,
    ...size(n),
    group: groupOf[i]!,
    up: [],
    down: [],
    outs: [],
    loop: 0,
  }));

  for (const e of edges)
    if (e.u === e.v)
      vertices[e.u]!.loop = Math.max(vertices[e.u]!.loop, LOOP + 4 + (e.label ? 8 + e.label.w : 0));

  const dummy = (r: number, group: number, back?: number, anchor?: number) =>
    vertices.push({
      rank: r,
      w: 0,
      h: 0,
      group,
      up: [],
      down: [],
      outs: [],
      loop: 0,
      anchor,
      back,
    }) - 1;

  const chains = new Map<number, { chain: number[]; segments: (number | undefined)[] }>();
  const crossing: { a: number; b: number }[] = [];

  for (const e of directed) {
    const back = reversed.has(e.i) ? e.i : undefined;
    const shared = back === undefined && groupOf[e.u] === groupOf[e.v] ? groupOf[e.u]! : -1;
    const chain = [e.u];

    if (back !== undefined) chain.push(dummy(rank[e.u]!, groupOf[e.u]!, back, e.u));

    for (let r = rank[e.u]! + 1; r < rank[e.v]!; r++) chain.push(dummy(r, shared, back));

    if (back !== undefined) chain.push(dummy(rank[e.v]!, groupOf[e.v]!, back, e.v));
    chain.push(e.v);

    const segments = chain.slice(1).map((v, k) => {
      const a = chain[k]!;

      if (vertices[a]!.rank === vertices[v]!.rank) return undefined;
      const id = crossing.push({ a, b: v }) - 1;
      vertices[a]!.down.push(v);
      vertices[a]!.outs.push(id);
      vertices[v]!.up.push(a);

      return id;
    });

    chains.set(e.i, { chain, segments });
  }

  const { layers, groupKey, base } = order(vertices, Math.max(0, ...rank) + 1, groups.length);

  const key = outside(
    vertices,
    layers,
    base,
    [...reversed].map((i) => chains.get(i)!),
  );

  const sides: Record<"left" | "right", number[]>[] = input.nodes.map(() => ({
    left: [],
    right: [],
  }));

  for (const i of reversed) {
    const { chain } = chains.get(i)!;
    const end = vertices[chain[1]!]!.outer ?? "right";

    for (const node of [chain[0]!, chain.at(-1)!]) sides[node]![end].push(i);
  }

  const xs = place(vertices, layers, key, groupKey, {
    nodeGap,
    groupPad,
    labels: groups.map((g) => g.label),
    lr,
  });

  const ends = spread(vertices, crossing, xs.center);

  const thick = layers.map((layer) => Math.max(0, ...layer.map((v) => vertices[v]!.h)));
  const inGap = (r: number) => ends.filter((c) => vertices[crossing[c.id]!.a]!.rank === r);
  const lanes = thick.slice(1).map((_, r) => tracks(inGap(r)));

  const padTop = groups.map((g) => groupPad + (lr ? 0 : g.label.h + 4));

  const spans = (e: (typeof directed)[number], r: number) =>
    chains.get(e.i)!.chain.some((v) => vertices[v]!.rank === r) &&
    chains.get(e.i)!.chain.some((v) => vertices[v]!.rank === r + 1);

  const tallest = lanes.map((_, r) =>
    Math.max(
      0,
      ...directed.flatMap((e) => (e.label && !reversed.has(e.i) && spans(e, r) ? [e.label.h] : [])),
    ),
  );

  const gaps = lanes.map(({ count }, r) => {
    const below = groups.reduce((m, _, g) => (xs.span[g]![1] === r ? Math.max(m, groupPad) : m), 0);

    const above = groups.reduce(
      (m, _, g) => (xs.span[g]![0] === r + 1 ? Math.max(m, padTop[g]!) : m),
      0,
    );

    const run = tallest[r]! > 0 ? tallest[r]! + 2 * BEND + 4 : BEND;
    const spread = Math.max(0, count - 1) * TRACK;

    // A gap grows for the widest edge crossing it, so that edge keeps a clear slope.
    const wide = Math.max(0, ...inGap(r).map((c) => Math.abs(c.xa - c.xb)));

    return Math.max(
      rankGap,
      below + above + 16,
      2 * run + spread,
      Math.min(MAX_GAP * rankGap, wide * SLOPE),
    );
  });

  const top: number[] = [];
  thick.forEach((_, r) => top.push(r === 0 ? 0 : top[r - 1]! + thick[r - 1]! + gaps[r - 1]!));
  const bottom = (r: number) => top[r]! + thick[r]!;

  const trackY = (id: number) => {
    const r = vertices[crossing[id]!.a]!.rank;
    const { track, count } = lanes[r]!;
    const k = track.get(id) ?? (count - 1) / 2;

    return bottom(r) + gaps[r]! / 2 + (k - (count - 1) / 2) * TRACK;
  };

  const box = (v: number): Box => {
    const { w, h, rank: r } = vertices[v]!;

    return { x: xs.center[v]! - w / 2, y: top[r]! + (thick[r]! - h) / 2, w, h };
  };

  const side = (v: number, edge: number): Point => {
    const b = box(v);
    const end = sides[v]!.left.includes(edge) ? "left" : "right";
    const list = sides[v]![end];
    const step = Math.min(PITCH, b.h / (list.length + 1));

    return {
      x: end === "left" ? b.x : b.x + b.w,
      y: b.y + b.h / 2 + (list.indexOf(edge) - (list.length - 1) / 2) * step,
    };
  };

  const routes = edges.map(({ i, u, v }): Point[] => {
    if (u === v) {
      const b = box(u);
      const [y1, y2, x] = [b.y + b.h * 0.3, b.y + b.h * 0.7, b.x + b.w];

      return [
        { x, y: y1 },
        { x: x + LOOP, y: y1 },
        { x: x + LOOP, y: y2 },
        { x, y: y2 },
      ];
    }

    const { chain, segments } = chains.get(i)!;
    const points: Point[] = [];
    chain.slice(1).forEach((b, k) => {
      const a = chain[k]!;
      const id = segments[k];

      if (id === undefined) {
        const [node, other] = vertices[a]!.node === undefined ? [b, a] : [a, b];
        const port = side(node, i);
        const stub = [port, { x: xs.center[other]!, y: port.y }];
        points.push(...(node === a ? stub : stub.reverse()));

        if (node === a) points.push({ x: xs.center[b]!, y: bottom(vertices[b]!.rank) });

        return;
      }

      if (k === 0) points.push({ x: ends[id]!.xa, y: box(a).y + box(a).h });
      const y = trackY(id);
      points.push({ x: ends[id]!.xa, y }, { x: ends[id]!.xb, y });

      if (vertices[b]!.node !== undefined) points.push({ x: ends[id]!.xb, y: box(b).y });
      else if (vertices[b]!.anchor === undefined)
        points.push({ x: ends[id]!.xb, y: bottom(vertices[b]!.rank) });
    });
    const route = simplify(points);

    return reversed.has(i) ? route.reverse() : route;
  });

  const groupBoxes = groups.map((_, gi) => {
    const [r0, r1] = xs.span[gi]!;
    const y = top[r0]! - padTop[gi]!;

    return {
      x: xs.group[gi]! - xs.width[gi]! / 2,
      y,
      w: xs.width[gi]!,
      h: bottom(r1) + groupPad - y,
    };
  });

  const groupLabels = groupBoxes.map((b, gi) => ({
    x: b.x + (lr ? 6 : groupPad),
    y: b.y + (lr ? groupPad : 6),
    ...groups[gi]!.label,
  }));

  const loops = edges.map(({ u, v, label }, k) =>
    u === v && label
      ? {
          x: routes[k]![1]!.x + 8,
          y: (routes[k]![1]!.y + routes[k]![2]!.y) / 2 - label.h / 2,
          ...label,
        }
      : undefined,
  );

  const free = placeLabels(
    edges.map((e, k) => ({ points: routes[k]!, label: e.u === e.v ? undefined : e.label })),
    [...input.nodes.map((_, v) => box(v)), ...groupLabels, ...loops.filter((b) => b !== undefined)],
    BEND,
  );

  const out = (value: Box): Box => (lr ? flip(value) : value);

  const laid = edges.map(({ i }, k): LayeredEdge => {
    const label = loops[k] ?? free[k];

    return {
      from: input.edges[i]!.from,
      to: input.edges[i]!.to,
      points: routes[k]!.map((point) => (lr ? flip(point) : point)),
      label: label && out(label),
    };
  });

  const nodes = new Map(input.nodes.map((n, i) => [n.id, out(box(i))]));
  const groupMap = new Map(groups.map((g, gi) => [g.id, out(groupBoxes[gi]!)]));

  const bounds = union([
    ...nodes.values(),
    ...groupMap.values(),
    ...laid.flatMap((e) => [around(e.points), ...(e.label ? [e.label] : [])]),
  ]);

  return {
    nodes,
    rank: new Map(input.nodes.map((n, i) => [n.id, rank[i]!])),
    edges: laid,
    groups: groupMap,
    bounds,
  };
}

// Spreads the ends of segments along the node sides they meet. Each end wants to sit level
// with the other end of its segment, so a segment runs straight where both nodes have room
// for it; a side with several ends keeps them a pitch apart, in the order the other ends lie.
// A lone end only leaves the middle of its side when it can then run straight. Ends on
// dummies stay put. A few rounds let the two ends of a segment settle on one another.
const spread = (
  vertices: readonly Vertex[],
  crossing: readonly { a: number; b: number }[],
  center: readonly number[],
): Crossing[] => {
  const ends = crossing.map((_, id): Crossing => ({ id, xa: 0, xb: 0 }));
  const xa = crossing.map(({ a }) => center[a]!);
  const xb = crossing.map(({ b }) => center[b]!);

  const sides = (key: "a" | "b") => {
    const by = new Map<number, number[]>();

    crossing.forEach((c, id) => {
      if (vertices[c[key]]!.node !== undefined) by.set(c[key], [...(by.get(c[key]) ?? []), id]);
    });

    return [...by];
  };

  const [leaving, arriving] = [sides("a"), sides("b")];

  const fit = (v: number, ids: readonly number[], want: readonly number[], x: number[]) => {
    const [c, half] = [center[v]!, Math.max(0, vertices[v]!.w / 2 - MARGIN)];

    if (ids.length === 1) {
      x[ids[0]!] = Math.abs(want[0]! - c) <= half ? want[0]! : c;

      return;
    }

    const pitch = Math.min(PITCH, (2 * half) / (ids.length - 1));
    const at = ids.map((_, k) => k).sort((p, q) => want[p]! - want[q]! || p - q);
    const p = at.map((k) => Math.min(c + half, Math.max(c - half, want[k]!)));

    for (let k = 1; k < p.length; k++) p[k] = Math.max(p[k]!, p[k - 1]! + pitch);
    p[p.length - 1] = Math.min(p.at(-1)!, c + half);

    for (let k = p.length - 2; k >= 0; k--) p[k] = Math.min(p[k]!, p[k + 1]! - pitch);
    at.forEach((k, i) => (x[ids[k]!] = p[i]!));
  };

  for (let round = 0; round < 4; round++) {
    for (const [v, ids] of leaving)
      fit(
        v,
        ids,
        ids.map((id) => xb[id]!),
        xa,
      );

    for (const [v, ids] of arriving)
      fit(
        v,
        ids,
        ids.map((id) => xa[id]!),
        xb,
      );
  }

  return ends.map((c) => ({
    ...c,
    xa: xa[c.id]!,
    xb: Math.abs(xa[c.id]! - xb[c.id]!) < 1e-6 ? xa[c.id]! : xb[c.id]!,
  }));
};

const backEdges = (
  count: number,
  edges: readonly { i: number; u: number; v: number }[],
): Set<number> => {
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
  const rank = Array.from({ length: count }, () => 0);
  const indegree = Array.from({ length: count }, () => 0);
  const into = Array.from({ length: count }, (): number[] => []);
  const out = Array.from({ length: count }, (): number[] => []);

  for (const e of edges) {
    indegree[e.v]!++;
    out[e.u]!.push(e.v);
    into[e.v]!.push(e.u);
  }

  const queue = rank.flatMap((_, i) => (indegree[i] === 0 ? [i] : []));

  for (let k = 0; k < queue.length; k++) {
    const u = queue[k]!;

    for (const v of out[u]!) {
      rank[v] = Math.max(rank[v]!, rank[u]! + 1);

      if (--indegree[v]! === 0) queue.push(v);
    }
  }

  // Longest-path ranks leave loosely attached nodes far from their neighbours. Sweeping
  // from the bottom, a node with more edges leaving than arriving moves down beside its
  // targets, and one with more arriving than leaving moves up beside its sources.
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false;

    for (const v of [...queue].reverse()) {
      const next =
        out[v]!.length > into[v]!.length
          ? Math.min(...out[v]!.map((w) => rank[w]! - 1))
          : out[v]!.length < into[v]!.length
            ? Math.max(...into[v]!.map((u) => rank[u]! + 1))
            : rank[v]!;

      if (next !== rank[v]) [rank[v], changed] = [next, true];
    }
  }

  const top = Math.min(...rank);

  return rank.map((r) => r - top);
};

const SWEEPS = 24;
const STALE = 4;
const BIG = 600;

// Counts crossings between each pair of neighbouring layers: pairs of segments whose ends
// come in opposite order. Sorting by source and counting inversions of the targets with a
// Fenwick tree keeps it O(E log V).
const countCrossings = (vertices: readonly Vertex[], layers: readonly number[][]): number => {
  const pos = new Int32Array(vertices.length);
  layers.forEach((layer) => layer.forEach((v, k) => (pos[v] = k)));
  let total = 0;

  for (let r = 0; r + 1 < layers.length; r++) {
    const pairs = layers[r]!.flatMap((v) =>
      vertices[v]!.down.map((d) => [pos[v]!, pos[d]!] as const),
    );

    pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const tree = new Int32Array(layers[r + 1]!.length + 1);

    pairs.forEach(([, b], seen) => {
      let below = 0;

      for (let i = b + 1; i > 0; i -= i & -i) below += tree[i]!;
      total += seen - below;

      for (let i = b + 1; i < tree.length; i += i & -i) tree[i]!++;
    });
  }

  return total;
};

// Depth-first from the top, so that what hangs off one node starts out side by side.
const depthFirst = (vertices: readonly Vertex[], ranks: number): number[][] => {
  const layers = Array.from({ length: ranks }, (): number[] => []);
  const seen = new Uint8Array(vertices.length);

  const roots = vertices.map((_, i) => i).sort((a, b) => vertices[a]!.rank - vertices[b]!.rank);

  for (const root of roots) {
    const stack = [root];

    while (stack.length > 0) {
      const v = stack.pop()!;

      if (seen[v]) continue;
      seen[v] = 1;
      layers[vertices[v]!.rank]!.push(v);

      for (let k = vertices[v]!.down.length - 1; k >= 0; k--) stack.push(vertices[v]!.down[k]!);
    }
  }

  return layers;
};

const mean = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;

const order = (vertices: readonly Vertex[], ranks: number, groups: number) => {
  const small = vertices.length <= BIG;
  const pos = new Float64Array(vertices.length);

  const pin = (layer: number[]) =>
    layer.splice(
      0,
      layer.length,
      ...layer
        .filter((v) => vertices[v]!.anchor === undefined)
        .flatMap((v) => [v, ...layer.filter((d) => vertices[d]!.anchor === v)]),
    );

  const sortLayer = (layer: number[], key: (v: number) => number, bary: (v: number) => number) => {
    layer.sort(
      (a, b) => key(a) - key(b) || vertices[a]!.group - vertices[b]!.group || bary(a) - bary(b),
    );
    pin(layer);
  };

  const index = (layers: readonly number[][]) =>
    layers.forEach((layer) => layer.forEach((v, k) => (pos[v] = (k + 0.5) / layer.length)));

  const sweep = (layers: number[][], down: boolean) => {
    for (let k = 1; k < ranks; k++) {
      const layer = layers[down ? k : ranks - 1 - k]!;

      const bary = new Map(
        layer.map((v) => [
          v,
          mean((down ? vertices[v]!.up : vertices[v]!.down).map((n) => pos[n]!)) ?? pos[v]!,
        ]),
      );

      const groupBary = new Map<number, number>();

      for (let g = 0; g < groups; g++) {
        const m = mean(layer.flatMap((v) => (vertices[v]!.group === g ? [bary.get(v)!] : [])));

        if (m !== undefined) groupBary.set(g, m);
      }

      const b = (v: number) => bary.get(v)!;
      sortLayer(
        layer,
        (v) => (vertices[v]!.group >= 0 ? groupBary.get(vertices[v]!.group)! : b(v)),
        b,
      );
      index(layers);
    }
  };

  // Swaps neighbours in a layer while that removes crossings. A node and the back-edge
  // dummies anchored to it move together; nodes of different groups never swap.
  const transpose = (layers: number[][]) => {
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;

      for (const layer of layers) {
        const units: number[][] = [];

        for (const v of layer)
          if (vertices[v]!.anchor === undefined || units.length === 0) units.push([v]);
          else units.at(-1)!.push(v);

        const near = (unit: readonly number[]) =>
          unit.flatMap((v) => [...vertices[v]!.up, ...vertices[v]!.down]);

        const rank = new Map(layers.flatMap((l) => l.map((v, k) => [v, k] as const)));

        const between = (left: readonly number[], right: readonly number[]) => {
          let n = 0;

          for (const x of near(left))
            for (const y of near(right))
              if (vertices[x]!.rank === vertices[y]!.rank && rank.get(x)! > rank.get(y)!) n++;

          return n;
        };

        for (let i = 0; i + 1 < units.length; i++) {
          const [a, b] = [units[i]!, units[i + 1]!];

          if (vertices[a[0]!]!.group !== vertices[b[0]!]!.group) continue;

          if (between(b, a) < between(a, b)) {
            [units[i], units[i + 1]] = [b, a];
            layer.splice(0, layer.length, ...units.flat());
            layer.forEach((v, k) => rank.set(v, k));
            changed = true;
          }
        }
      }

      if (!changed) break;
      index(layers);
    }
  };

  const climb = (start: number[][], flip: boolean) => {
    let layers = start.map((layer) => [...layer]);
    layers.forEach(pin);
    index(layers);

    let best = groups === 0 ? countCrossings(vertices, layers) : Infinity;
    let kept = layers.map((layer) => [...layer]);
    let stale = 0;

    for (let i = 0; i < SWEEPS && stale < STALE && best > 0; i++, stale++) {
      sweep(layers, (i % 2 === 0) !== flip);
      const n = countCrossings(vertices, layers);

      if (n < best) [best, kept, stale] = [n, layers.map((layer) => [...layer]), 0];
    }

    layers = kept;

    if (small && best > 0) {
      index(layers);
      transpose(layers);
      best = countCrossings(vertices, layers);
    }

    return { layers, crossings: best };
  };

  const plain = Array.from({ length: ranks }, (): number[] => []);
  vertices.forEach((v, i) => plain[v.rank]!.push(i));

  const first = climb(depthFirst(vertices, ranks), false);
  const second = small ? climb(plain, true) : first;
  const { layers } = second.crossings < first.crossings ? second : first;

  index(layers);
  const settled = Float64Array.from(pos);

  const groupKey = Array.from(
    { length: groups },
    (_, g) => mean(vertices.flatMap((v, i) => (v.group === g ? [settled[i]!] : []))) ?? 0,
  );

  const base = (v: number) =>
    vertices[v]!.group >= 0 ? groupKey[vertices[v]!.group]! : settled[v]!;

  for (const layer of layers)
    sortLayer(
      layer,
      (v) => base(vertices[v]!.anchor ?? v),
      (v) => settled[v]!,
    );

  return { layers, groupKey, base };
};

const outside = (
  vertices: Vertex[],
  layers: number[][],
  base: (v: number) => number,
  backs: readonly { chain: readonly number[] }[],
) => {
  const spans = [...backs].sort((a, b) => a.chain.length - b.chain.length);

  for (const { chain } of spans) {
    const [top, bottom] = [chain[0]!, chain.at(-1)!];
    const mine = new Set(chain.slice(1, -1));

    const others = (v: number) =>
      layers[vertices[v]!.rank]!.filter((u) => !mine.has(u) && !vertices[u]!.outer);

    const at = (v: number, end: "left" | "right") =>
      (end === "left" ? others(v)[0] : others(v).at(-1)) === v;

    const end = (["right", "left"] as const).find((s) => at(top, s) && at(bottom, s));

    if (!end) continue;

    for (const v of chain.slice(1, -1)) {
      vertices[v]!.outer = end;
      vertices[v]!.group = -1;
      const layer = layers[vertices[v]!.rank]!;
      layer.splice(layer.indexOf(v), 1);

      if (end === "left") layer.unshift(v);
      else layer.push(v);
    }
  }

  return (v: number): number => {
    const { outer, anchor, rank } = vertices[v]!;
    const layer = layers[rank]!;

    if (outer) return (outer === "left" ? -1 : 2) + layer.indexOf(v) * 1e-6;

    return anchor === undefined
      ? base(v)
      : base(anchor) + (layer.indexOf(v) - layer.indexOf(anchor)) * 1e-9;
  };
};

interface Item {
  readonly kind: "v" | "g";
  readonly id: number;
  readonly l: number;
  readonly r: number;
  readonly gap: number;
  readonly key: number;
}

const place = (
  vertices: readonly Vertex[],
  layers: readonly number[][],
  key: (v: number) => number,
  groupKey: readonly number[],
  o: {
    readonly nodeGap: number;
    readonly groupPad: number;
    readonly labels: readonly Size[];
    readonly lr: boolean;
  },
) => {
  const groups = groupKey.length;
  const gapOf = (v: number) => (vertices[v]!.node === undefined ? o.nodeGap / 2 : o.nodeGap);

  const pads = o.labels.map((label) => ({
    left: o.groupPad + (o.lr ? label.w + 4 : 0),
    right: o.groupPad,
    min: o.lr ? 0 : label.w + 2 * o.groupPad,
  }));

  const members = (layer: readonly number[], g: number) =>
    layer.filter((v) => vertices[v]!.group === g);

  const inner = (layer: readonly number[], g: number) =>
    members(layer, g).reduce(
      (w, v, k, all) =>
        w +
        vertices[v]!.w +
        vertices[v]!.loop +
        (k > 0 ? Math.max(gapOf(v), gapOf(all[k - 1]!)) : 0),
      0,
    );

  const width = Array.from({ length: groups }, (_, g) =>
    Math.max(
      pads[g]!.min,
      Math.max(...layers.map((layer) => inner(layer, g))) + pads[g]!.left + pads[g]!.right,
    ),
  );

  const span = Array.from({ length: groups }, (_, g) => {
    const rs = vertices.flatMap((v) => (v.group === g ? [v.rank] : []));

    return [Math.min(...rs), Math.max(...rs)] as const;
  });

  const rows: Item[][] = layers.map((layer, r) => {
    const items = layer.flatMap((v): Item[] => {
      const { w, loop, group } = vertices[v]!;

      return group < 0
        ? [{ kind: "v", id: v, l: w / 2, r: w / 2 + loop, gap: gapOf(v), key: key(v) }]
        : [];
    });

    for (let g = 0; g < groups; g++)
      if (r >= span[g]![0] && r <= span[g]![1])
        items.push({
          kind: "g",
          id: g,
          l: width[g]! / 2,
          r: width[g]! / 2,
          gap: o.nodeGap,
          key: groupKey[g]!,
        });

    return items.sort((a, b) => a.key - b.key || (a.kind === b.kind ? 0 : a.kind === "v" ? -1 : 1));
  });

  const vx = Array.from({ length: vertices.length }, () => 0);
  const gx = Array.from({ length: groups }, () => 0);
  const get = (it: Item) => (it.kind === "v" ? vx[it.id]! : gx[it.id]!);

  const set = (it: Item, value: number) =>
    it.kind === "v" ? (vx[it.id] = value) : (gx[it.id] = value);

  const sep = (a: Item, b: Item) => a.r + b.l + Math.max(a.gap, b.gap);

  const offset = Array.from({ length: vertices.length }, () => 0);

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

  const center = (v: number) =>
    vertices[v]!.group < 0 ? vx[v]! : gx[vertices[v]!.group]! + offset[v]!;

  const outer = (it: Item) => it.kind === "v" && vertices[it.id]!.outer !== undefined;

  // Back-edge channels are placed last, outside everything else; the rest of each row is one
  // slot per item, and a group has one slot in each row it spans.
  const slotItem: Item[] = [];
  const slotOf = new Map<string, number>();

  const slots = rows.map((row, r) =>
    row.flatMap((it) => {
      if (outer(it)) return [];
      slotOf.set(`${it.kind}${it.id}@${r}`, slotItem.length);

      return [slotItem.push(it) - 1];
    }),
  );

  const end = (v: number) => {
    const { group, rank } = vertices[v]!;

    return {
      slot: slotOf.get(group < 0 ? `v${v}@${rank}` : `g${group}@${rank}`),
      dx: group < 0 ? 0 : offset[v]!,
    };
  };

  const dummy = (v: number) => vertices[v]!.node === undefined && vertices[v]!.group < 0;

  const links: Link[] = vertices.flatMap((u, a) =>
    u.down.flatMap((b): Link[] => {
      const [from, to] = [end(a), end(b)];

      if (from.slot === undefined || to.slot === undefined) return [];

      if (u.group >= 0 && u.group === vertices[b]!.group) return [];

      return [{ a: from.slot, b: to.slot, da: from.dx, db: to.dx, inner: dummy(a) && dummy(b) }];
    }),
  );

  for (let g = 0; g < groups; g++)
    for (let r = span[g]![0]; r < span[g]![1]; r++)
      links.push({
        a: slotOf.get(`g${g}@${r}`)!,
        b: slotOf.get(`g${g}@${r + 1}`)!,
        da: 0,
        db: 0,
        inner: true,
        held: true,
      });

  const gapBetween = (a: number, b: number) => sep(slotItem[a]!, slotItem[b]!);
  const xs = balance(slots, links, gapBetween, (s) => [slotItem[s]!.l, slotItem[s]!.r]);

  slotItem.forEach((it, s) => set(it, xs[s]!));

  // Balancing picks each slot's x from different layouts, which can, rarely, bring two
  // slots closer than their gap; push those apart.
  for (let changed = true; changed;) {
    changed = false;

    for (const row of slots)
      for (let k = 1; k < row.length; k++) {
        const [a, b] = [row[k - 1]!, row[k]!];
        const need = get(slotItem[a]!) + gapBetween(a, b);

        if (get(slotItem[b]!) < need - 1e-9) {
          set(slotItem[b]!, need);
          changed = true;
        }
      }
  }

  const at = slotItem.map(get);
  settle(slots, links, at, gapBetween, (s) => slotItem[s]!.kind === "v" && dummy(slotItem[s]!.id));
  slotItem.forEach((it, s) => set(it, at[s]!));

  const channels = groupBy(
    rows.flatMap((row) => row.flatMap((it, k) => (outer(it) ? [{ it, row, k }] : []))),
    ({ it }) => vertices[it.id]!.back!,
  );

  const depth = (list: { row: Item[]; k: number }[]) =>
    Math.min(
      ...list.map(({ row, k }) => (vertices[row[k]!.id]!.outer === "left" ? row.length - k : k)),
    );

  for (const list of [...channels.values()].sort((a, b) => depth(b) - depth(a))) {
    const left = vertices[list[0]!.it.id]!.outer === "left";

    const x = left
      ? Math.min(...list.map(({ it, row, k }) => get(row[k + 1]!) - sep(it, row[k + 1]!)))
      : Math.max(...list.map(({ it, row, k }) => get(row[k - 1]!) + sep(row[k - 1]!, it)));

    for (const { it } of list) set(it, x);
  }

  const left = Math.min(...rows.flatMap((row) => row.map((it) => get(it) - it.l)));

  return {
    center: vertices.map((_, v) => center(v) - left),
    group: gx.map((x) => x - left),
    width,
    span,
  };
};

// A segment between a slot and one in the next row. `da` and `db` are where it meets each
// slot, from the slot's centre. A held link joins a group's slots, which always stay in line.
interface Link {
  readonly a: number;
  readonly b: number;
  readonly da: number;
  readonly db: number;
  readonly inner: boolean;
  readonly held?: boolean;
}

// Brandes–Köpf coordinate assignment. Each of four passes (aligning to the row above or
// below, from the left or the right) lines each slot up with a median neighbour, so long
// edges become straight blocks, then packs the blocks as tightly as their gaps allow. A
// slot takes the mean of its two middle x values across the four, which centres a parent
// over its children. A segment that would cross a bend-to-bend one is never aligned, so
// long edges win over short ones.
const balance = (
  rows: readonly (readonly number[])[],
  links: readonly Link[],
  gap: (a: number, b: number) => number,
  extent: (s: number) => readonly [number, number],
): number[] => {
  const n = rows.reduce((sum, row) => sum + row.length, 0);
  const pos = new Int32Array(n);
  rows.forEach((row) => row.forEach((s, k) => (pos[s] = k)));
  const ups = Array.from({ length: n }, (): Link[] => []);
  const downs = Array.from({ length: n }, (): Link[] => []);

  for (const l of links) {
    ups[l.b]!.push(l);
    downs[l.a]!.push(l);
  }

  for (const list of ups) list.sort((p, q) => pos[p.a]! - pos[q.a]! || p.da - q.da);

  for (const list of downs) list.sort((p, q) => pos[p.b]! - pos[q.b]! || p.db - q.db);

  const conflict = new Set<Link>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    let [k0, scan] = [0, 0];

    row.forEach((s, i) => {
      const inner = ups[s]!.find((l) => l.inner);
      const k1 = inner ? pos[inner.a]! : rows[r - 1]!.length;

      if (!inner && i < row.length - 1) return;

      for (const t of row.slice(scan, i + 1))
        for (const l of ups[t]!)
          if (!l.inner && (pos[l.a]! < k0 || pos[l.a]! > k1)) conflict.add(l);

      [k0, scan] = [k1, i + 1];
    });
  }

  const layout = (down: boolean, right: boolean, free: boolean): number[] | undefined => {
    const root = Array.from({ length: n }, (_, s) => s);
    const shift = Array.from({ length: n }, () => 0);
    const taken = new Uint8Array(n);
    const near = (l: Link) => (down ? l.a : l.b);

    for (const l of links) if (l.held) taken[near(l)] = 1;

    for (let step = 0; step < rows.length; step++) {
      const r = down ? step : rows.length - 1 - step;
      const row = right ? [...rows[r]!].reverse() : rows[r]!;
      const last = (rows[down ? r - 1 : r + 1]?.length ?? 0) - 1;
      const idx = (s: number) => (right ? last - pos[s]! : pos[s]!);
      let prev = -1;

      for (const v of row) {
        const list = down ? ups[v]! : downs[v]!;
        const held = list.find((l) => l.held);

        const join = (l: Link) => {
          const w = near(l);
          const [own, other] = down ? [l.db, l.da] : [l.da, l.db];
          [root[v], shift[v], taken[w], prev] = [root[w]!, shift[w]! + other - own, 1, idx(w)];
        };

        if (held) {
          join(held);
          continue;
        }

        if (free || list.length === 0) continue;
        const [lo, hi] = [(list.length - 1) >> 1, list.length >> 1];

        for (const m of right ? [hi, lo] : [lo, hi]) {
          const l = list[m]!;

          if (root[v] === v && !taken[near(l)] && prev < idx(near(l)) && !conflict.has(l)) join(l);
        }
      }
    }

    const out = Array.from({ length: n }, (): { to: number; w: number }[] => []);
    const indegree = new Int32Array(n);

    for (const row of rows)
      for (let k = 1; k < row.length; k++) {
        const [a, b] = right ? [row[k]!, row[k - 1]!] : [row[k - 1]!, row[k]!];
        const g = gap(row[k - 1]!, row[k]!);
        out[root[a]!]!.push({
          to: root[b]!,
          w: right ? g - shift[a]! + shift[b]! : g + shift[a]! - shift[b]!,
        });
        indegree[root[b]!]!++;
      }

    const queue = root.filter((r, s) => r === s && indegree[s] === 0);

    for (let k = 0; k < queue.length; k++)
      for (const { to } of out[queue[k]!]!) if (--indegree[to]! === 0) queue.push(to);

    if (queue.length < root.filter((r, s) => r === s).length) return undefined;
    const x = new Float64Array(n);

    for (const v of queue) for (const { to, w } of out[v]!) x[to] = Math.max(x[to]!, x[v]! + w);

    // Longest paths leave a block hard against those before it; pull each back toward
    // those after it, so blocks with nothing pushing them sit beside what they lead to.
    for (const v of [...queue].reverse()) {
      const room = Math.min(...out[v]!.map(({ to, w }) => x[to]! - w));

      if (room !== Infinity && room > x[v]!) x[v] = room;
    }

    return root.map((r, s) => (right ? -x[r]! : x[r]!) + shift[s]!);
  };

  const variants = [
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ] as const;

  const all = variants.map(
    ([down, right]) => layout(down, right, false) ?? layout(down, right, true)!,
  );

  const bounds = all.map((xs) => [
    Math.min(...xs.map((x, s) => x - extent(s)[0])),
    Math.max(...xs.map((x, s) => x + extent(s)[1])),
  ]);

  const narrowest = bounds.reduce(
    (best, b, k) => (b[1]! - b[0]! < bounds[best]![1]! - bounds[best]![0]! ? k : best),
    0,
  );

  const moved = all.map((xs, k) => {
    const delta =
      k % 2 === 0
        ? bounds[narrowest]![0]! - bounds[k]![0]!
        : bounds[narrowest]![1]! - bounds[k]![1]!;

    return xs.map((x) => x + delta);
  });

  return Array.from({ length: n }, (_, s) => {
    const four = moved.map((xs) => xs[s]!).sort((p, q) => p - q);

    return (four[1]! + four[2]!) / 2;
  });
};

// Pulls nearly straight segments straight, then pulls what is left toward its neighbours.
// Slots already in line move as one block, so a straight edge stays straight. A segment's
// smaller block moves, if every slot in it keeps its gap to those beside it, by up to SNAP,
// or BEND_SNAP for a block of bends only.
const settle = (
  rows: readonly (readonly number[])[],
  links: readonly Link[],
  xs: number[],
  gap: (a: number, b: number) => number,
  bend: (s: number) => boolean,
) => {
  const n = xs.length;
  const row = new Int32Array(n);
  const pos = new Int32Array(n);
  rows.forEach((list, r) => list.forEach((s, k) => [(row[s] = r), (pos[s] = k)]));
  const block = Array.from({ length: n }, (_, s) => s);
  const members = Array.from({ length: n }, (_, s) => [s]);

  const join = (p: number, q: number) => {
    let [keep, drop] = [block[p]!, block[q]!];

    if (keep === drop) return;

    if (members[keep]!.length < members[drop]!.length) [keep, drop] = [drop, keep];

    for (const s of members[drop]!) block[s] = keep;
    members[keep]!.push(...members[drop]!);
    members[drop] = [];
  };

  const off = (l: Link) => xs[l.b]! + l.db - xs[l.a]! - l.da;
  const touching = Array.from({ length: n }, (): Link[] => []);

  for (const l of links) {
    touching[l.a]!.push(l);
    touching[l.b]!.push(l);
  }

  // How far a block can move left and right before one of its slots meets a neighbour.
  const room = (id: number) => {
    let [lo, hi] = [-Infinity, Infinity];

    for (const s of members[id]!) {
      const list = rows[row[s]!]!;
      const [left, right] = [list[pos[s]! - 1], list[pos[s]! + 1]];

      if (left !== undefined && block[left] !== id)
        lo = Math.max(lo, xs[left]! + gap(left, s) - xs[s]!);

      if (right !== undefined && block[right] !== id)
        hi = Math.min(hi, xs[right]! - gap(s, right) - xs[s]!);
    }

    return [Math.min(0, lo), Math.max(0, hi)] as const;
  };

  const move = (id: number, by: number) => {
    for (const s of members[id]!) xs[s]! += by;
  };

  const snap = () => {
    for (const l of links) if (l.held || Math.abs(off(l)) < 0.01) join(l.a, l.b);

    const near = links
      .flatMap((l, k) =>
        Math.abs(off(l)) >= 0.01 && Math.abs(off(l)) <= BEND_SNAP ? [{ l, k }] : [],
      )
      .sort((p, q) => Math.abs(off(p.l)) - Math.abs(off(q.l)) || p.k - q.k);

    for (const { l } of near) {
      const d = off(l);
      const [upper, lower] = [block[l.a]!, block[l.b]!];

      if (upper === lower) continue;

      if (Math.abs(d) < 0.01) {
        join(l.a, l.b);
        continue;
      }

      const first = members[upper]!.length <= members[lower]!.length ? upper : lower;

      for (const id of [first, first === upper ? lower : upper]) {
        const by = id === upper ? d : -d;
        const [lo, hi] = room(id);

        if ((Math.abs(d) > SNAP && !members[id]!.every(bend)) || by < lo - 0.01 || by > hi + 0.01)
          continue;

        move(id, by);
        join(l.a, l.b);
        break;
      }
    }
  };

  snap();

  // Each block moves toward the mean of where its other segments would run straight, so a
  // node with two children ends up centred over them.
  for (let sweep = 0; sweep < 24; sweep++) {
    const ids = block.filter((id, s) => id === s);

    for (const id of sweep % 2 ? ids.reverse() : ids) {
      const pulls = members[id]!.flatMap((s) =>
        touching[s]!.flatMap((l) =>
          block[l.a] === block[l.b] ? [] : [l.a === s ? off(l) : -off(l)],
        ),
      );

      const want = mean(pulls);

      if (want === undefined) continue;
      const [lo, hi] = room(id);
      move(id, Math.min(hi, Math.max(lo, want)));
    }
  }

  snap();
};
