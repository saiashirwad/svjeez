/** @jsxImportSource svjeez */
import { Group, Shape, Text, rect, span, type SceneElement } from "svjeez";
import type { Child } from "svjeez/tools";
import { SceneError, type Spanned } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import type { Box, Point } from "./layout/box.ts";
import {
  Route,
  checkIds,
  Chip,
  Edge,
  Node,
  checkDraws,
  drawnBy,
  edgeKey,
  extent,
  keyed,
  known,
  labelOf,
  labelSize,
  look,
  onOutline,
  partsOf,
  pop,
  schedule,
  sizeOf,
  type Diagram,
  type DiagramOptions,
  type EdgeId,
  type Reveal,
} from "./kit.tsx";
import type { Direction, FlowchartEdge, FlowchartGroup, Labelled } from "./types.ts";

export interface FlowchartOptions<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  readonly reveal?: Reveal<N>;
}

export interface Flowchart<
  N extends string,
  G extends string,
  E extends string = `${N}->${N}`,
> extends Diagram<N | G | E> {
  edge(from: N, to: N): Route;
  route(from: N, to: N): Route;
}

const WHAT = "flowchart()";

export function flowchart<
  const N extends Record<string, Labelled>,
  const E extends readonly FlowchartEdge<NoInfer<keyof N & string>>[],
  const G extends Record<string, FlowchartGroup<NoInfer<keyof N & string>>> = {},
>(
  spec: {
    readonly nodes: N;
    readonly groups?: G;
    readonly edges: E;
  },
  options: FlowchartOptions<NoInfer<keyof N & string>>,
): Flowchart<keyof N & string, keyof G & string, EdgeId<E[number]>> {
  type Id = keyof N & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (direction !== "TB" && direction !== "LR")
    throw new SceneError(`${WHAT} takes direction "TB" or "LR", got "${String(direction)}".`);
  const nodes = Object.entries<Labelled>(spec.nodes).map(([id, s]) => ({ id, ...labelOf(s) }));
  const ids = nodes.map((n) => n.id);
  checkIds(ids, WHAT, "node");
  const roles = new Map(nodes.map((n) => [n.id, n.role]));

  const edges = spec.edges.map(([from, to, label, style]: FlowchartEdge<string>, i) => ({
    from: known(from, ids, WHAT, "node", `edge ${i + 1}`),
    to: known(to, ids, WHAT, "node", `edge ${i + 1}`),
    label,
    style,
  }));

  const groups = Object.entries<FlowchartGroup<string>>(spec.groups ?? {});
  checkIds(groups.length === 0 ? ["-"] : groups.map(([id]) => id), WHAT, "group");
  const member = new Map<string, string>();

  for (const [id, g] of groups) {
    if (ids.includes(id))
      throw new SceneError(
        `${WHAT} has a group and a node both named "${id}".`,
        "Give the group another name.",
      );

    if (g.nodes.length === 0)
      throw new SceneError(
        `${WHAT} group "${id}" holds no nodes.`,
        "List its nodes, or leave the group out.",
      );

    for (const n of g.nodes) {
      known(n, ids, WHAT, "node", `group "${id}"`);
      const other = member.get(n);

      if (other)
        throw new SceneError(
          `${WHAT} puts node "${n}" in two groups, "${other}" and "${id}".`,
          "A node sits in one group at most.",
        );
      member.set(n, id);
    }
  }

  const out = layered({
    direction,
    nodes: nodes.map((n) => ({ id: n.id, ...sizeOf(l, n.role, n.label) })),
    edges: edges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.label === undefined ? undefined : labelSize(l, e.label),
    })),
    groups: groups.map(([id, g]) => ({
      id,
      members: g.nodes,
      label: { w: l.measure(g.label, l.small), h: l.small * 1.2 },
    })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, move(b)]));

  const lines = out.edges.map((e, i) => {
    const points: Point[] = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    points[0] = onOutline(roles.get(e.from)!, boxes.get(e.from)!, points[0]!, points[1]!);
    points[points.length - 1] = onOutline(
      roles.get(e.to)!,
      boxes.get(e.to)!,
      points.at(-1)!,
      points.at(-2)!,
    );

    return { ...edges[i]!, points, box: e.label && move(e.label) };
  });

  const cross = (b: Box) => (direction === "TB" ? b.x : b.y);

  const order = [...ids].sort(
    (a, b) => out.rank.get(a)! - out.rank.get(b)! || cross(boxes.get(a)!) - cross(boxes.get(b)!),
  );

  const shown = schedule(options.reveal, order, WHAT);
  const LABEL = 0.25;

  const drawn = (from: string, to: string): Spanned | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.4, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  const groupAt = (g: FlowchartGroup<string>): Spanned | undefined => {
    const spans = g.nodes.map((n) => shown.get(n));

    if (spans.some((s) => !s)) return undefined;

    return span(Math.min(...spans.map((s) => s!.start)), 0.4);
  };

  const edgeKeys = keyed(lines.map((e) => edgeKey(e.from, e.to)));
  const timed = lines.map((e) => drawn(e.from, e.to));
  checkDraws(options.draw, edgeKeys, WHAT);

  const parts = new Map<string, Spanned | undefined>([
    ...order.map((id) => [id, shown.get(id)] as const),
    ...groups.map(([id, g]) => [id, groupAt(g)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [edgeKeys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<Id | (keyof G & string) | EdgeId<E[number]>>(WHAT, parts);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {groups.map(([id, g]) => {
        const b = move(out.groups.get(id)!);
        const at = groupAt(g);

        return (
          <Group key={id} offset={[b.x, b.y]} motion={at && pop(at)}>
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 10 })}
              stroke={{ color: l.colors.line, width: 1, dash: [4, 3] }}
            />
            <Text key="label" font={l.font} size={l.small} fill={l.colors.muted} at={[12, 6]}>
              {g.label}
            </Text>
          </Group>
        );
      })}
      {lines.map((e, i) => (
        <Edge
          key={edgeKeys[i]!}
          look={l}
          points={e.points}
          draw={drawnBy(options.draw, edgeKeys[i]!, timed[i], WHAT)}
          stroke={
            e.style?.line === "dotted"
              ? { dash: [2, 4] }
              : e.style?.line === "thick"
                ? { width: 3 }
                : undefined
          }
          head={e.style?.head}
        />
      ))}
      {between}
      {nodes.map((n) => {
        const at = shown.get(n.id);

        return (
          <Node
            key={n.id}
            look={l}
            role={n.role}
            label={n.label}
            box={boxes.get(n.id)!}
            motion={at && pop(at)}
          />
        );
      })}
      {lines.map((e, i) => {
        const t = timed[i];

        return (
          e.box &&
          e.label !== undefined && (
            <Chip
              key={`${edgeKeys[i]!}:label`}
              look={l}
              box={e.box}
              text={e.label}
              motion={t && pop(span(t.start + t.over, LABEL))}
            />
          )
        );
      })}
    </Group>
  );

  const find = (from: string, to: string) => {
    const line = lines.find((e) => e.from === from && e.to === to);

    if (!line) throw new SceneError(`${WHAT} has no edge from "${from}" to "${to}".`);

    return line;
  };

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: extent([...parts.values()]),
    ...handle,
    edge: (from, to) =>
      new Route([
        find(known(from, ids, WHAT, "node", "edge()"), known(to, ids, WHAT, "node", "edge()"))
          .points,
      ]),
    route: (from, to) => {
      known(from, ids, WHAT, "node", "route()");
      known(to, ids, WHAT, "node", "route()");

      if (from === to) {
        const b = boxes.get(from)!;

        return new Route([[{ x: b.x + b.w / 2, y: b.y + b.h / 2 }]]);
      }

      const via = new Map<string, (typeof lines)[number]>();

      for (const queue: string[] = [from]; queue.length > 0 && !via.has(to);) {
        const here = queue.shift()!;

        for (const line of lines) {
          if (line.from !== here || line.to === from || via.has(line.to)) continue;
          via.set(line.to, line);
          queue.push(line.to);
        }
      }

      if (!via.has(to))
        throw new SceneError(
          `${WHAT} has no way from "${from}" to "${to}" along its edges.`,
          "Route between nodes an edge path joins.",
        );
      const hops: (typeof lines)[number][] = [];

      for (let at: string = to; at !== from; at = hops[0]!.from) hops.unshift(via.get(at)!);

      return new Route(hops.map((h) => h.points));
    },
  };
}
