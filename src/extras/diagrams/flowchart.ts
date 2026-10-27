import { el } from "../../el";
import type { Point, Rect } from "../../geometry";
import type { Direction } from "../../layout/box";
import { layered } from "../../layout/layered";
import { ease, motion, type Seconds } from "../../motion";
import { enter } from "../../recipes";
import type { SvgNode } from "../../svg";
import { defaultDark } from "../theme";
import { arrow, chip, labelOf, lookup, onShape, placer, shape, sizeOf, textWidth, type Diagram, type DiagramOptions, type Labelled, type NodeRole } from "./kit";

export type FlowEdge<N extends string> = readonly [from: N, to: N] | readonly [from: N, to: N, options: { readonly label?: string }];

export interface FlowGroup<N extends string> {
  readonly label: string;
  readonly nodes: readonly N[];
}

export interface FlowchartOptions extends DiagramOptions {
  /** Nodes appear in rank order, `step` apart; each edge draws on as its target appears; a group fades in with its first member. */
  readonly reveal?: { readonly at: Seconds; readonly step?: Seconds };
}

export interface Flowchart<N extends string, G extends string> extends Diagram<N | G> {
  /** The drawn line of the first edge `from` → `to`. */
  edge(from: N, to: N): Point[];
  /** The shortest directed path through edges, as one polyline through each node on the way. */
  route(from: N, to: N): Point[];
}

/** Each layout box with the role and label drawn in it. Shared by `state`, which adds its own marks. */
export interface Laid<N extends string> {
  readonly boxes: ReadonlyMap<string, Rect>;
  readonly lines: readonly { readonly from: N; readonly to: N; readonly points: Point[]; readonly label?: Rect }[];
  readonly groups: ReadonlyMap<string, Rect>;
  readonly rank: ReadonlyMap<string, number>;
  readonly bounds: Rect;
}

export function flowchart<const N extends Record<string, Labelled>, const G extends Record<string, FlowGroup<NoInfer<keyof N & string>>> = {}>(
  spec: { readonly direction?: Direction; readonly nodes: N; readonly groups?: G; readonly edges: readonly FlowEdge<NoInfer<keyof N & string>>[] },
  options: FlowchartOptions = {},
): Flowchart<keyof N & string, keyof G & string> {
  type Id = keyof N & string;
  const { theme = defaultDark, fontSize = 14, class: cls, reveal } = options;
  const look = { theme, fontSize };
  const small = { theme, fontSize: fontSize * 0.85 };
  const nodes = Object.entries(spec.nodes as Record<string, Labelled>).map(([id, s]) => ({ id, ...labelOf(s) }));
  const roles = new Map(nodes.map((n) => [n.id, n.role]));
  const edges = spec.edges.map(([from, to, o]) => ({ from, to, label: o?.label }));
  const groups = Object.entries((spec.groups ?? {}) as Record<string, FlowGroup<Id>>);
  const laid = lay<Id>(
    {
      direction: spec.direction,
      nodes: nodes.map((n) => ({ id: n.id, ...sizeOf(n.role, n.label, fontSize) })),
      edges: edges.map((e) => ({ ...e, label: e.label === undefined ? undefined : { w: textWidth(e.label, small.fontSize), h: small.fontSize * 1.4 } })),
      groups: groups.map(([id, g]) => ({ id, members: g.nodes, label: { w: textWidth(g.label, small.fontSize), h: small.fontSize * 1.2 } })),
    },
    roles,
    options,
  );

  const order = nodes.map((n) => n.id).sort((a, b) => laid.rank.get(a)! - laid.rank.get(b)! || cross(laid.boxes.get(a)!, spec.direction) - cross(laid.boxes.get(b)!, spec.direction));
  const step = reveal?.step ?? 0.4;
  const shown = new Map(order.map((id, i) => [id, (reveal?.at ?? 0) + i * step]));
  const drawOver = Math.min(0.4, step);
  const drawAt = (from: string, to: string) => Math.max(shown.get(from)!, shown.get(to)! - drawOver);

  const node = el.g({ class: cls }, [
    groups.map(([id, g]) => {
      const b = laid.groups.get(id)!;
      const at = Math.min(...g.nodes.map((n) => shown.get(n)!));
      return el.g({ animation: reveal && enter({ at, over: 0.4 }) }, [
        el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: theme.base0E, fillOpacity: 0.04, stroke: theme.base0E, strokeOpacity: 0.45, strokeDasharray: "4 3" }),
        el.text({ x: b.x + 12, y: b.y + 8 + small.fontSize, fontSize: small.fontSize, fill: theme.base04 }, g.label),
      ]);
    }),
    laid.lines.map((line) => arrow(line.points, { ...look, at: reveal && drawAt(line.from, line.to), over: drawOver })),
    nodes.map((n) => shape(n.role, laid.boxes.get(n.id)!, n.label, look, reveal && enter({ at: shown.get(n.id)!, over: 0.35 }, { opacity: 0, scale: 0.9 }, ease.out))),
    laid.lines.map((line, i) => line.label && chip(line.label, edges[i]!.label!, small, reveal && motion({ opacity: 0 }).at(drawAt(line.from, line.to) + drawOver).to({ opacity: 1 }, 0.25))),
  ]);
  return { node, bounds: laid.bounds, get: lookup("flowchart()", new Map([...laid.boxes, ...laid.groups])), ...paths(laid.lines, laid.boxes) };
}

const cross = (b: Rect, direction: Direction = "TB") => (direction === "TB" ? b.x : b.y);

/** Layered layout, shifted to `x`/`y`, with each edge's ends moved onto its nodes' outlines. */
export const lay = <N extends string>(
  input: Parameters<typeof layered>[0],
  roles: ReadonlyMap<string, NodeRole>,
  { x, y }: { readonly x?: number; readonly y?: number },
): Laid<N> => {
  const out = layered(input);
  const at = placer(out.bounds, x, y);
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, at.box(b)]));
  const lines = out.edges.map((e) => {
    const points = e.points.map(at.point);
    const [from, to] = [boxes.get(e.from)!, boxes.get(e.to)!];
    points[0] = onShape(roles.get(e.from)!, from, points[0]!, points[1]!);
    points[points.length - 1] = onShape(roles.get(e.to)!, to, points.at(-1)!, points.at(-2)!);
    return { from: e.from as N, to: e.to as N, points, label: e.label && at.box(e.label) };
  });
  return { boxes, lines, groups: new Map([...out.groups].map(([id, b]) => [id, at.box(b)])), rank: out.rank, bounds: at.bounds };
};

/** `edge` and `route` over laid-out lines. */
export const paths = <N extends string>(lines: Laid<N>["lines"], boxes: ReadonlyMap<string, Rect>) => {
  const edge = (from: N, to: N): Point[] => {
    const line = lines.find((l) => l.from === from && l.to === to);
    if (!line) throw new Error(`No edge from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`);
    return [...line.points];
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
    return hops.flatMap((line) => line.points);
  };
  return { edge, route };
};
