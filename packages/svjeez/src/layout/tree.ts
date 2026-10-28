import {
  around,
  flip,
  simplify,
  union,
  type Box,
  type Direction,
  type Point,
  type Size,
} from "./box";

interface TreeInput {
  /** In order; siblings keep this order. Exactly one node has no parent. */
  readonly nodes: readonly ({ readonly id: string; readonly parent?: string } & Size)[];
  readonly direction?: Direction;
  readonly levelGap?: number;
  readonly siblingGap?: number;
}

export interface TreeLayout {
  readonly nodes: ReadonlyMap<string, Box>;
  readonly parent: ReadonlyMap<string, string>;
  /** Breadth-first, siblings in input order. */
  readonly order: readonly string[];
  /** One per child, parent to child, in breadth-first order of the child. */
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly points: readonly Point[];
  }[];
  readonly bounds: Box;
}

type Contour = [number, number][];

/** A tidy tree: each subtree packed beside its siblings as close as their contours allow, each parent centered over its children. */
export function tree(input: TreeInput): TreeLayout {
  const { direction = "TB", levelGap = 40, siblingGap = 24 } = input;
  const lr = direction === "LR";
  const index = new Map(input.nodes.map((n, i) => [n.id, i]));

  if (index.size !== input.nodes.length) throw new Error("tree() node ids must be unique.");
  const size = input.nodes.map((n) => (lr ? { w: n.h, h: n.w } : { w: n.w, h: n.h }));
  const children = input.nodes.map((): number[] => []);
  const roots: number[] = [];
  input.nodes.forEach((n, i) => {
    if (n.parent === undefined) return roots.push(i);
    const p = index.get(n.parent);

    if (p === undefined)
      throw new Error(
        `tree() node ${JSON.stringify(n.id)} has an unknown parent ${JSON.stringify(n.parent)}.`,
      );
    children[p]!.push(i);
  });

  if (roots.length !== 1) throw new Error(`tree() needs exactly one root, got ${roots.length}.`);

  const order = [roots[0]!];
  const depth = new Array<number>(input.nodes.length).fill(0);

  for (let k = 0; k < order.length; k++) {
    for (const c of children[order[k]!]!) {
      depth[c] = depth[order[k]!]! + 1;
      order.push(c);
    }
  }

  if (order.length !== input.nodes.length) throw new Error("tree() parents form a cycle.");

  const offset = new Array<number>(input.nodes.length).fill(0);

  const lay = (v: number): Contour => {
    const own: [number, number] = [-size[v]!.w / 2, size[v]!.w / 2];
    const kids = children[v]!;

    if (kids.length === 0) return [own];
    let merged: Contour = [];
    kids.forEach((c) => {
      const contour = lay(c);

      const shift =
        merged.length === 0
          ? 0
          : Math.max(
              ...contour.slice(0, merged.length).map(([lo], d) => merged[d]![1] + siblingGap - lo),
            );

      offset[c] = shift;
      merged = Array.from({ length: Math.max(merged.length, contour.length) }, (_, d) => {
        const [a, b] = [merged[d], contour[d]];

        return b
          ? [
              Math.min(a?.[0] ?? Infinity, b[0] + shift),
              Math.max(a?.[1] ?? -Infinity, b[1] + shift),
            ]
          : a!;
      });
    });
    const mid = (offset[kids[0]!]! + offset[kids.at(-1)!]!) / 2;

    for (const c of kids) offset[c]! -= mid;

    return [own, ...merged.map(([a, b]): [number, number] => [a - mid, b - mid])];
  };

  lay(roots[0]!);

  const x = new Array<number>(input.nodes.length).fill(0);

  for (const v of order.slice(1)) x[v] = x[index.get(input.nodes[v]!.parent!)!]! + offset[v]!;
  const left = Math.min(...order.map((v) => x[v]! - size[v]!.w / 2));
  const levels = Math.max(...depth) + 1;

  const thick = Array.from({ length: levels }, (_, d) =>
    Math.max(...order.filter((v) => depth[v] === d).map((v) => size[v]!.h)),
  );

  const top: number[] = [];
  thick.forEach((_, d) => top.push(d === 0 ? 0 : top[d - 1]! + thick[d - 1]! + levelGap));

  const box = (v: number): Box => ({
    x: x[v]! - left - size[v]!.w / 2,
    y: top[depth[v]!]! + (thick[depth[v]!]! - size[v]!.h) / 2,
    ...size[v]!,
  });

  const out = (b: Box) => (lr ? flip(b) : b);

  const edges = order.slice(1).map((c) => {
    const p = index.get(input.nodes[c]!.parent!)!;
    const [a, b] = [box(p), box(c)];
    const mid = top[depth[p]!]! + thick[depth[p]!]! + levelGap / 2;

    const points = simplify([
      { x: a.x + a.w / 2, y: a.y + a.h },
      { x: a.x + a.w / 2, y: mid },
      { x: b.x + b.w / 2, y: mid },
      { x: b.x + b.w / 2, y: b.y },
    ]);

    return {
      from: input.nodes[p]!.id,
      to: input.nodes[c]!.id,
      points: lr ? points.map(flip) : points,
    };
  });

  const nodes = new Map(input.nodes.map((n, i) => [n.id, out(box(i))]));

  return {
    nodes,
    parent: new Map(
      input.nodes.flatMap((n) => (n.parent === undefined ? [] : [[n.id, n.parent] as const])),
    ),
    order: order.map((v) => input.nodes[v]!.id),
    edges,
    bounds: union([...nodes.values(), ...edges.map((e) => around(e.points))]),
  };
}
