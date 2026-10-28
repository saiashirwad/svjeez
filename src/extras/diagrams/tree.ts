import { el } from "../../el";
import type { Point } from "../../geometry";
import type { Direction } from "../../layout/box";
import { tree as layout } from "../../layout/tree";
import { ease, type Seconds } from "../../motion";
import { enter } from "../../recipes";
import { defaultDark } from "../theme";
import { beats, type Beats } from "../timeline";
import { curve } from "./curve";
import { arrow, lookup, placer, shape, sizeOf, type Diagram, type DiagramOptions, type NodeRole } from "./kit";

/** A label, or a node naming its `parent`. Exactly one node has no parent. */
export type TreeSpec<N extends string> = string | { readonly label: string; readonly parent?: N; readonly role?: NodeRole };

export interface TreeOptions extends DiagramOptions {
  /** Default `"TB"`. */
  readonly direction?: Direction;
  /** Nodes appear breadth-first after the root, each edge drawing on as its child appears. From a start `at` they follow `step` apart (default 0.3), or each comes at its own time. */
  readonly play?: { readonly at: Beats; readonly step?: Seconds };
}

export interface Tree<N extends string> extends Diagram<N> {
  /** Up from `from` to the nearest common ancestor, then down to `to`, along the drawn edges. */
  route(from: N, to: N): Point[];
}

export function tree<const N extends Record<string, TreeSpec<string>>>(
  spec: { readonly nodes: N & { readonly [K in keyof N]: TreeSpec<Exclude<keyof N & string, K>> } },
  options: TreeOptions = {},
): Tree<keyof N & string> {
  type Id = keyof N & string;
  const { theme = defaultDark, fontSize = 14, font, class: cls, play, direction } = options;
  const look = { theme, fontSize };
  const nodes = Object.entries(spec.nodes as Record<string, TreeSpec<string>>).map(([id, s]) =>
    typeof s === "string" ? { id, label: s, role: "task" as NodeRole, parent: undefined } : { id, label: s.label, role: s.role ?? "task", parent: s.parent },
  );
  const out = layout({ direction, nodes: nodes.map((n) => ({ id: n.id, parent: n.parent, ...sizeOf(n.role, n.label, fontSize, font) })) });
  const at = placer(out.bounds, options);
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, at.box(b)]));
  const edges = new Map(out.edges.map((e) => [e.to, e.points.map(at.point)]));
  const step = play?.step ?? 0.3;
  const times = beats(play?.at ?? 0, out.order.length - 1, step, "tree() play");
  /** The root is there from the start, so no frame is empty. */
  const shown = new Map(out.order.map((id, i) => [id, i === 0 ? -Infinity : times[i - 1]!]));
  const over = Math.min(0.35, step);

  const node = el.g({ class: cls, fontFamily: font }, [
    out.edges.map((e) => arrow(edges.get(e.to)!, { ...look, at: play && Math.max(0, shown.get(e.from)!, shown.get(e.to)! - over), over })),
    nodes.map((n) => shape(n.role, boxes.get(n.id)!, n.label, look, play && shown.get(n.id)! >= 0 ? enter({ at: shown.get(n.id)!, over: 0.35 }, { opacity: 0, scale: 0.9 }, ease.out) : undefined)),
  ]);
  const up = (id: string): string[] => {
    const parent = out.parent.get(id);
    return parent === undefined ? [id] : [id, ...up(parent)];
  };
  const down = (id: string) => curve(edges.get(id)!).samples;
  return {
    node,
    bounds: at.bounds,
    get: lookup("tree()", boxes),
    route: (from: Id, to: Id): Point[] => {
      const [a, b] = [up(from), up(to)];
      const meet = a.find((id) => b.includes(id))!;
      if (from === to) return [boxes.get(from)!.center];
      return [...a.slice(0, a.indexOf(meet)).flatMap((id) => down(id).reverse()), ...b.slice(0, b.indexOf(meet)).reverse().flatMap(down)];
    },
  };
}
