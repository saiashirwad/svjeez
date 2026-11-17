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
  readonly ins: number[];
  readonly outs: number[];
  readonly anchor?: number;
  readonly back?: number;
  outer?: "left" | "right";
  loop: number;
}

const LOOP = 20;
const PORT = 12;
const TRACK = 14;

const SNAP = 6;

const MERGE = 16;

export const BEND = 16;

export function layered(input: LayeredInput): LayeredLayout {
  const { direction = "TB", rankGap = 48, nodeGap = 36, groupPad = 12 } = input;
  const lr = direction === "LR";

  const { unique, at } = indexing(
    input.nodes.map((n) => n.id),
    (id) => `layered() has no node ${JSON.stringify(id)}.`,
  );

  if (!unique) throw new Error("layered() node ids must be unique.");
  const size = (s: Size): Size => (lr ? { w: s.h, h: s.w } : s);

  const groups = (input.groups ?? []).map((g) => ({
    id: g.id,
    members: g.members.map(at),
    label: size(g.label),
  }));

  const groupOf = input.nodes.map(() => -1);
  groups.forEach((g, gi) => {
    if (g.members.length === 0) throw new Error(`Group ${JSON.stringify(g.id)} has no members.`);

    for (const m of g.members) {
      if (groupOf[m] !== -1)
        throw new Error(`Node ${JSON.stringify(input.nodes[m]!.id)} is in two groups.`);
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
    ins: [],
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
      ins: [],
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
      vertices[v]!.ins.push(id);

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

  const ports = (v: number): Map<number, number> => {
    const { node, down, outs } = vertices[v]!;

    if (node === undefined) return new Map(outs.map((id) => [id, xs.center[v]!]));

    const sorted = down
      .map((o, k) => ({ o, id: outs[k]! }))
      .sort((a, b) => xs.center[a.o]! - xs.center[b.o]! || a.id - b.id);

    const step = Math.min(PORT, vertices[v]!.w / (sorted.length + 1));
    const packed = sorted.map((_, k) => xs.center[v]! + (k - (sorted.length - 1) / 2) * step);
    const reach = sorted.length < 2 ? 0 : Math.max(0, vertices[v]!.w / 2 - PORT * 1.5);

    const [lo, hi] = [
      Math.min(xs.center[v]! - reach, packed[0]!),
      Math.max(xs.center[v]! + reach, packed.at(-1)!),
    ];

    const port = sorted.map(({ o }, k) =>
      reach === 0 ? packed[k]! : Math.min(hi, Math.max(lo, xs.center[o]!)),
    );

    for (let k = 1; k < port.length; k++)
      port[k] = Math.min(hi, Math.max(port[k]!, port[k - 1]! + step));

    for (let k = port.length - 2; k >= 0; k--) port[k] = Math.min(port[k]!, port[k + 1]! - step);

    return new Map(sorted.map(({ id }, k) => [id, port[k]!]));
  };

  const outPorts = vertices.map((_, v) => ports(v));

  const ends = crossing.map(({ a, b }, id): Crossing => {
    const [xa, center] = [outPorts[a]!.get(id)!, xs.center[b]!];

    const straight =
      vertices[b]!.node !== undefined &&
      Math.abs(xa - center) <= Math.min(SNAP, vertices[b]!.w / 2);

    return { id, xa, xb: straight ? xa : center };
  });

  const into = (c: Crossing) => crossing[c.id]!.b;

  const merging = new Set(
    ends.flatMap((c) =>
      vertices[into(c)]!.node !== undefined &&
      ends.some((d) => d !== c && into(d) === into(c) && Math.abs(d.xb - c.xb) < 0.5)
        ? [c.id]
        : [],
    ),
  );

  const thick = layers.map((layer) => Math.max(0, ...layer.map((v) => vertices[v]!.h)));
  const inGap = (r: number) => ends.filter((c) => vertices[crossing[c.id]!.a]!.rank === r);
  const lanes = thick.slice(1).map((_, r) => tracks(inGap(r), merging));

  const merges = lanes.map((_, r) =>
    inGap(r).some((c) => merging.has(c.id) && Math.abs(c.xa - c.xb) > 0.5),
  );

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

    return Math.max(
      rankGap,
      below + above + 16,
      merges[r] ? run + spread + MERGE : 2 * run + spread,
    );
  });

  const top: number[] = [];
  thick.forEach((_, r) => top.push(r === 0 ? 0 : top[r - 1]! + thick[r - 1]! + gaps[r - 1]!));
  const bottom = (r: number) => top[r]! + thick[r]!;

  const trackY = (id: number) => {
    const r = vertices[crossing[id]!.a]!.rank;
    const { track, count } = lanes[r]!;
    const k = track.get(id) ?? (count - 1) / 2;

    return merges[r]
      ? top[r + 1]! - MERGE - (count - 1 - k) * TRACK
      : bottom(r) + gaps[r]! / 2 + (k - (count - 1) / 2) * TRACK;
  };

  const box = (v: number): Box => {
    const { w, h, rank: r } = vertices[v]!;

    return { x: xs.center[v]! - w / 2, y: top[r]! + (thick[r]! - h) / 2, w, h };
  };

  const side = (v: number, edge: number): Point => {
    const b = box(v);
    const end = sides[v]!.left.includes(edge) ? "left" : "right";
    const list = sides[v]![end];
    const step = Math.min(PORT, b.h / (list.length + 1));

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

  const out = <T extends Box | Point>(value: T): T => (lr ? flip(value) : value);

  const laid = edges.map(({ i }, k): LayeredEdge => {
    const label = loops[k] ?? free[k];

    return {
      from: input.edges[i]!.from,
      to: input.edges[i]!.to,
      points: routes[k]!.map(out),
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

const mean = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;

const order = (vertices: readonly Vertex[], ranks: number, groups: number) => {
  const layers = Array.from({ length: ranks }, (): number[] => []);
  vertices.forEach((v, i) => layers[v.rank]!.push(i));
  const pos = new Float64Array(vertices.length);

  const index = () =>
    layers.forEach((layer) => layer.forEach((v, k) => (pos[v] = (k + 0.5) / layer.length)));

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

  layers.forEach(pin);
  index();

  for (let sweep = 0; sweep < 8; sweep++) {
    const down = sweep % 2 === 0;

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
      index();
    }
  }

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

  for (let changed = true; changed;) {
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

  const neighbours = (v: number) => [
    ...vertices[v]!.up,
    ...vertices[v]!.down,
    ...(vertices[v]!.anchor === undefined ? [] : [vertices[v]!.anchor!]),
  ];

  const weight = (v: number, n: number) => {
    const [a, b] = [vertices[v]!, vertices[n]!];

    if ((a.node === undefined && b.node === undefined) || a.anchor === n) return 8;

    const single =
      (a.up.length === 1 && a.up[0] === n && b.down.length === 1) ||
      (a.down.length === 1 && a.down[0] === n && b.up.length === 1);

    return single ? 4 : 1;
  };

  const occurrences = new Map<string, { row: Item[]; k: number }[]>();

  for (const row of rows)
    row.forEach((it, k) =>
      occurrences.set(`${it.kind}${it.id}`, [
        ...(occurrences.get(`${it.kind}${it.id}`) ?? []),
        { row, k },
      ]),
    );
  const items = [...occurrences.values()].map((list) => list[0]!.row[list[0]!.k]!);
  const outer = (it: Item) => it.kind === "v" && vertices[it.id]!.outer !== undefined;

  for (let sweep = 0; sweep < 60; sweep++) {
    for (const it of sweep % 2 ? [...items].reverse() : items) {
      if (outer(it)) continue;

      const pulls =
        it.kind === "v"
          ? neighbours(it.id).map((n) => ({ at: center(n), weight: weight(it.id, n) }))
          : vertices.flatMap((v, i) =>
              v.group === it.id
                ? neighbours(i)
                    .filter((n) => vertices[n]!.group !== it.id)
                    .map((n) => ({ at: gx[it.id]! + center(n) - center(i), weight: weight(i, n) }))
                : [],
            );

      const total = pulls.reduce((sum, p) => sum + p.weight, 0);

      const want =
        total === 0 ? undefined : pulls.reduce((sum, p) => sum + p.at * p.weight, 0) / total;

      if (want === undefined) continue;
      let [lo, hi] = [-Infinity, Infinity];

      for (const { row, k } of occurrences.get(`${it.kind}${it.id}`)!) {
        if (k > 0 && !outer(row[k - 1]!))
          lo = Math.max(lo, get(row[k - 1]!) + sep(row[k - 1]!, it));

        if (k < row.length - 1 && !outer(row[k + 1]!))
          hi = Math.min(hi, get(row[k + 1]!) - sep(it, row[k + 1]!));
      }

      set(it, Math.min(hi, Math.max(lo, want)));
    }
  }

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
