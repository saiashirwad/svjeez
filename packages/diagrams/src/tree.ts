import { type Point, type Direction, type Seconds, span as spanOf } from "svjeez";
import { tree as layout } from "./layout/tree.ts";
import { curve } from "./curve.ts";
import {
  arrow,
  drawNode,
  isBareLabel,
  labelOf,
  edgeId,
  INSTANT,
  lineBox,
  look,
  partsOf,
  placer,
  POP,
  popIn,
  schedule,
  sizeOf,
  spanOfReveals,
  type Diagram,
  type DiagramOptions,
  type NodeRole,
  type PlayAt,
} from "./kit.tsx";

/** A label, or a node naming its `parent`. Exactly one node has no parent. */
export type TreeSpec<N extends string> =
  | string
  | { readonly label: string; readonly parent?: N; readonly role?: NodeRole };

export interface TreeOptions<N extends string = string> extends DiagramOptions {
  /** Default `"TB"`. */
  readonly direction?: Direction;
  /**
   * Nodes appear breadth-first after the root, edges as the later of their ends does. From a start `at` they follow
   * `step` apart (default 0.3), or each at its own time. A record such as `{ a: 1, b: 2 }` times nodes by id; omitted
   * ones are there from the start.
   */
  readonly play?: { readonly at: PlayAt<N>; readonly step?: Seconds };
}

type TreeEdges<N> = {
  [K in keyof N & string]: N[K] extends { readonly parent: infer P extends string }
    ? `${P}->${K}`
    : never;
}[keyof N & string];

/** Parts are the nodes, then edges by id such as `"root->leaf"`. An edge's span is when it draws on. */
export interface Tree<N extends string, E extends string = `${N}->${N}`> extends Diagram<N | E> {
  /** Up from `from` to the nearest common ancestor, then down to `to`, along the drawn edges. */
  route(from: N, to: N): Point[];
}

export function tree<const N extends Record<string, TreeSpec<string>>>(
  spec: { readonly nodes: N & { readonly [K in keyof N]: TreeSpec<Exclude<keyof N & string, K>> } },
  options: TreeOptions<NoInfer<keyof N & string>> = {},
): Tree<keyof N & string, TreeEdges<N>> {
  type Id = keyof N & string;

  const { play, direction } = options;
  const l = look(options);
  const { fontSize, font } = l;

  const nodes = Object.entries(spec.nodes).map(([id, s]) => ({
    id,
    ...labelOf(s),
    parent: isBareLabel(s) ? undefined : s.parent,
  }));

  const out = layout({
    direction,
    nodes: nodes.map((n) => ({
      id: n.id,
      parent: n.parent,
      ...sizeOf(n.role, n.label, fontSize, font),
    })),
  });

  const at = placer(out.bounds, options);
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, at.box(b)]));
  const edges = new Map(out.edges.map((e) => [e.to, e.points.map(at.point)]));
  const step = play?.step ?? 0.3;
  const shown = schedule(play?.at ?? 0, out.order.slice(1), out.order, step, "tree() play");
  const over = Math.min(POP, step);

  const drawAt = (e: { from: string; to: string }) =>
    Math.max(0, shown.get(e.from)!, shown.get(e.to)! - over);

  const node = l.root([
    out.edges.map((e) =>
      arrow(edges.get(e.to)!, {
        ...l,
        at: play && drawAt(e),
        over,
      }),
    ),
    nodes.map((n) =>
      drawNode(
        n.role,
        boxes.get(n.id)!,
        n.label,
        l,
        play && shown.get(n.id)! >= 0 ? popIn(shown.get(n.id)!) : undefined,
      ),
    ),
  ]);

  const up = (id: string): string[] => {
    const parent = out.parent.get(id);

    return parent === undefined ? [id] : [id, ...up(parent)];
  };

  const down = (id: string) => curve(edges.get(id)!).samples;

  const span = spanOfReveals(
    play
      ? [
          ...out.edges.map((e) => ({ at: drawAt(e), over })),
          ...nodes.flatMap((n) =>
            shown.get(n.id)! >= 0 ? [{ at: shown.get(n.id)!, over: POP }] : [],
          ),
        ]
      : [],
  );

  return {
    node,
    span,
    bounds: at.bounds,
    ...partsOf<Id | TreeEdges<N>>(
      "tree()",
      [
        ...boxes,
        ...out.edges.map((e) => [edgeId(e.from, e.to), lineBox(edges.get(e.to)!)] as const),
      ],
      (id, i) => {
        const e = out.edges[i - boxes.size];

        if (e) return play ? spanOf(drawAt(e), over) : INSTANT;

        return play && shown.get(id)! >= 0 ? spanOf(shown.get(id)!, POP) : INSTANT;
      },
    ),
    route: (from: Id, to: Id): Point[] => {
      const [a, b] = [up(from), up(to)];
      const meet = a.find((id) => b.includes(id))!;

      if (from === to) return [boxes.get(from)!.center];

      return [
        ...a.slice(0, a.indexOf(meet)).flatMap((id) => down(id).reverse()),
        ...b.slice(0, b.indexOf(meet)).reverse().flatMap(down),
      ];
    },
  };
}
