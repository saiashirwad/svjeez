import { el } from "../../el";
import type { Point, Rect } from "../../geometry";
import type { Direction } from "../../layout/box";
import { layered } from "../../layout/layered";
import { motion, type Seconds } from "../../motion";
import { enter } from "../../recipes";
import type { SvgNode } from "../../svg";
import { beats, type Beats } from "../timeline";
import { curve } from "./curve";
import { arrow, chip, labelOf, labelSize, look, lookup, onShape, placer, popIn, shape, sizeOf, textWidth, type Diagram, type DiagramOptions, type Labelled, type NodeRole } from "./kit";

export type FlowchartEdge<N extends string> = readonly [from: N, to: N] | readonly [from: N, to: N, options: { readonly label?: string }];

export interface FlowchartGroup<N extends string> {
  readonly label: string;
  readonly nodes: readonly N[];
}

export interface FlowchartOptions extends DiagramOptions {
  /** Default `"TB"`. */
  readonly direction?: Direction;
  /**
   * Nodes appear in rank order after the first rank; each edge draws on as its target appears; a group fades in with its
   * first member. From a start `at` they follow `step` apart (default 0.4), or each comes at its own time.
   */
  readonly play?: { readonly at: Beats; readonly step?: Seconds };
}

export interface Flowchart<N extends string, G extends string> extends Diagram<N | G> {
  /** The drawn line of the first edge `from` → `to`. */
  edge(from: N, to: N): Point[];
  /** The shortest directed path through edges, as one polyline through each node on the way. */
  route(from: N, to: N): Point[];
  /** `node` in two layers, groups and edges `under` the nodes and labels `over` them, so a flow can run between. */
  readonly layers: { readonly under: SvgNode; readonly over: SvgNode };
}

/** Laid-out boxes and lines, shifted into place. */
interface Laid<N extends string> {
  readonly boxes: ReadonlyMap<string, Rect>;
  readonly lines: readonly { readonly from: N; readonly to: N; readonly points: Point[]; readonly label?: Rect }[];
  readonly groups: ReadonlyMap<string, Rect>;
  readonly rank: ReadonlyMap<string, number>;
  readonly bounds: Rect;
}

export function flowchart<const N extends Record<string, Labelled>, const G extends Record<string, FlowchartGroup<NoInfer<keyof N & string>>> = {}>(
  spec: { readonly nodes: N; readonly groups?: G; readonly edges: readonly FlowchartEdge<NoInfer<keyof N & string>>[] },
  options: FlowchartOptions = {},
): Flowchart<keyof N & string, keyof G & string> {
  type Id = keyof N & string;
  const { direction, play } = options;
  const l = look(options);
  const { theme, fontSize, font, smallLook: small } = l;
  const nodes = Object.entries(spec.nodes as Record<string, Labelled>).map(([id, s]) => ({ id, ...labelOf(s) }));
  const roles = new Map(nodes.map((n) => [n.id, n.role]));
  const edges = spec.edges.map(([from, to, o]) => ({ from, to, label: o?.label }));
  const groups = Object.entries((spec.groups ?? {}) as Record<string, FlowchartGroup<Id>>);
  const laid = lay<Id>(
    {
      direction,
      nodes: nodes.map((n) => ({ id: n.id, ...sizeOf(n.role, n.label, fontSize, font) })),
      edges: edges.map((e) => ({ ...e, label: e.label === undefined ? undefined : labelSize(e.label, small.fontSize, font) })),
      groups: groups.map(([id, g]) => ({ id, members: g.nodes, label: { w: textWidth(g.label, small.fontSize, font), h: small.fontSize * 1.2 } })),
    },
    roles,
    options,
  );

  const order = nodes.map((n) => n.id).sort((a, b) => laid.rank.get(a)! - laid.rank.get(b)! || cross(laid.boxes.get(a)!, direction) - cross(laid.boxes.get(b)!, direction));
  const step = play?.step ?? 0.4;
  /** The first rank is there from the start, so no frame is empty; the rest follow in order. */
  const later = order.filter((id) => laid.rank.get(id)! > 0);
  const times = beats(play?.at ?? 0, later.length, step, "flowchart() play");
  const shown = new Map(order.map((id) => [id, later.includes(id) ? times[later.indexOf(id)]! : -Infinity]));
  const appear = (id: string) => (play && shown.get(id)! >= 0 ? popIn(shown.get(id)!) : undefined);
  const drawOver = Math.min(0.4, step);
  const drawAt = (from: string, to: string) => Math.max(0, shown.get(from)!, shown.get(to)! - drawOver);

  const under = l.root([
    groups.map(([id, g]) => {
      const b = laid.groups.get(id)!;
      const at = Math.min(...g.nodes.map((n) => shown.get(n)!));
      return el.g({ animation: play && at >= 0 ? enter({ at, over: 0.4 }) : undefined }, [
        el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: "none", stroke: theme.base0E, strokeOpacity: 0.45, strokeDasharray: "4 3" }),
        el.text({ x: b.x + 12, y: b.y + 8 + small.fontSize, fontSize: small.fontSize, fill: theme.base04 }, g.label),
      ]);
    }),
    laid.lines.map((line) => arrow(line.points, { ...l, at: play && drawAt(line.from, line.to), over: drawOver })),
  ]);
  const over = l.root([
    nodes.map((n) => shape(n.role, laid.boxes.get(n.id)!, n.label, l, appear(n.id))),
    laid.lines.map((line, i) => line.label && chip(line.label, edges[i]!.label!, small, play && motion({ opacity: 0 }).at(drawAt(line.from, line.to) + drawOver).to({ opacity: 1 }, 0.25))),
  ]);
  return { node: el.g({}, [under, over]), layers: { under, over }, bounds: laid.bounds, get: lookup("flowchart()", new Map([...laid.boxes, ...laid.groups])), ...paths(laid.lines, laid.boxes) };
}

const cross = (b: Rect, direction: Direction = "TB") => (direction === "TB" ? b.x : b.y);

/** Layered layout, shifted to `x`/`y`, with each edge's ends moved onto its nodes' outlines. */
const lay = <N extends string>(
  input: Parameters<typeof layered>[0],
  roles: ReadonlyMap<string, NodeRole>,
  options: DiagramOptions,
): Laid<N> => {
  const out = layered(input);
  const at = placer(out.bounds, options);
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, at.box(b)]));
  const lines = out.edges.map((e) => {
    const points = e.points.map(at.point);
    const [from, to] = [boxes.get(e.from)!, boxes.get(e.to)!];
    points[0] = onShape(roles.get(e.from) ?? "task", from, points[0]!, points[1]!);
    points[points.length - 1] = onShape(roles.get(e.to) ?? "task", to, points.at(-1)!, points.at(-2)!);
    return { from: e.from as N, to: e.to as N, points, label: e.label && at.box(e.label) };
  });
  return { boxes, lines, groups: new Map([...out.groups].map(([id, b]) => [id, at.box(b)])), rank: out.rank, bounds: at.bounds };
};

/** `edge` and `route` over laid-out lines. */
const paths = <N extends string>(lines: Laid<N>["lines"], boxes: ReadonlyMap<string, Rect>) => {
  const edge = (from: N, to: N): Point[] => {
    const line = lines.find((l) => l.from === from && l.to === to);
    if (!line) throw new Error(`No edge from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`);
    return curve(line.points).samples;
  };
  const route = (from: N, to: N): Point[] => {
    if (from === to) return [boxes.get(from)!.center];
    const via = new Map<string, Laid<N>["lines"][number]>();
    for (const queue: string[] = [from]; queue.length > 0 && !via.has(to); ) {
      const here = queue.shift()!;
      for (const line of lines) {
        if (line.from !== here || line.to === from || via.has(line.to)) continue;
        via.set(line.to, line);
        queue.push(line.to);
      }
    }
    if (!via.has(to)) throw new Error(`No path from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`);
    const hops: Laid<N>["lines"][number][] = [];
    for (let at: string = to; at !== from; at = hops[0]!.from) hops.unshift(via.get(at)!);
    return hops.flatMap((line) => curve(line.points).samples);
  };
  return { edge, route };
};
