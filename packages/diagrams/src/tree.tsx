/** @jsxImportSource svjeez */
import { Group, span, type SceneElement } from "svjeez";
import { SceneError, type Child, type Spanned } from "svjeez/tools";
import { tree as layout } from "./layout/tree.ts";
import type { Point } from "./layout/box.ts";
import {
  Route,
  checkIds,
  drawEdge,
  drawNode,
  edgeKey,
  extent,
  isBare,
  known,
  labelOf,
  look,
  partsOf,
  pop,
  schedule,
  sizeOf,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import type { Direction, TreeSpec } from "./types.ts";

export interface TreeOptions<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  readonly reveal?: Reveal<N>;
}

type TreeEdges<N> = {
  [K in keyof N & string]: N[K] extends {
    readonly parent: infer P extends string;
  }
    ? `${P}->${K}`
    : never;
}[keyof N & string];

export interface Tree<N extends string, E extends string = `${N}->${N}`> extends Diagram<N | E> {
  route(from: N, to: N): Route;
}

const WHAT = "tree()";

export function tree<const N extends Record<string, TreeSpec<string>>>(
  spec: {
    readonly nodes: N & {
      readonly [K in keyof N]: TreeSpec<Exclude<keyof N & string, K>>;
    };
  },
  options: TreeOptions<NoInfer<keyof N & string>>,
): Tree<keyof N & string, TreeEdges<N>> {
  type Id = keyof N & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (direction !== "TB" && direction !== "LR")
    throw new SceneError(`${WHAT} takes direction "TB" or "LR", got "${String(direction)}".`);

  const nodes = Object.entries<TreeSpec<string>>(spec.nodes).map(([id, s]) => ({
    id,
    ...labelOf(s),
    parent: isBare(s) ? undefined : s.parent,
  }));

  const ids = nodes.map((n) => n.id);
  checkIds(ids, WHAT, "node");

  for (const n of nodes)
    if (n.parent !== undefined) known(n.parent, ids, WHAT, "node", `node "${n.id}"'s parent`);
  const roots = nodes.filter((n) => n.parent === undefined);

  if (roots.length !== 1)
    throw new SceneError(
      `${WHAT} needs exactly one node with no parent, got ${roots.length === 0 ? "none" : roots.map((n) => `"${n.id}"`).join(", ")}.`,
      "Give every other node a parent.",
    );

  const out = layout({
    direction,
    nodes: nodes.map((n) => ({ id: n.id, parent: n.parent, ...sizeOf(l, n.role, n.label) })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];

  const boxes = new Map(
    [...out.nodes].map(([id, b]) => [id, { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }]),
  );

  const lines = new Map(
    out.edges.map((e) => [e.to, e.points.map((p): Point => ({ x: p.x + dx, y: p.y + dy }))]),
  );

  const shown = schedule(options.reveal, out.order, WHAT);

  const drawn = (from: string, to: string): Spanned | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.35, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  const parts = new Map<string, Spanned | undefined>([
    ...out.order.map((id) => [id, shown.get(id)] as const),
    ...out.edges.map((e) => [edgeKey(e.from, e.to), drawn(e.from, e.to)] as const),
  ]);

  const handle = partsOf<Id | TreeEdges<N>>(WHAT, options.name ?? "tree", parts);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {out.edges.map((e) =>
        drawEdge(l, {
          key: edgeKey(e.from, e.to),
          points: lines.get(e.to)!,
          drawn: drawn(e.from, e.to),
        }),
      )}
      {between}
      {nodes.map((n) => {
        const at = shown.get(n.id);

        return drawNode(l, {
          key: n.id,
          role: n.role,
          label: n.label,
          box: boxes.get(n.id)!,
          motion: at && pop(at),
        });
      })}
    </Group>
  );

  const up = (id: string): string[] => {
    const parent = out.parent.get(id);

    return parent === undefined ? [id] : [id, ...up(parent)];
  };

  const reversed = (points: readonly Point[]) => [...points].reverse();

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: extent([...parts.values()]),
    ...handle,
    route: (from, to) => {
      known(from, ids, WHAT, "node", "route()");
      known(to, ids, WHAT, "node", "route()");

      if (from === to) {
        const b = boxes.get(from)!;

        return new Route([[{ x: b.x + b.w / 2, y: b.y + b.h / 2 }]]);
      }

      const [a, b] = [up(from), up(to)];
      const meet = a.find((id) => b.includes(id))!;

      return new Route([
        ...a.slice(0, a.indexOf(meet)).map((id) => reversed(lines.get(id)!)),
        ...b
          .slice(0, b.indexOf(meet))
          .reverse()
          .map((id) => lines.get(id)!),
      ]);
    },
  };
}
