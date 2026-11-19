/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  line,
  rect,
  span,
  through,
  type SceneElement,
  type Span,
} from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import { DIRECTIONS, isVertical, type Box, type Point } from "./layout/box.ts";
import {
  Chip,
  Edge,
  Route,
  checkDraws,
  checkIds,
  drawnBy,
  edgeKey,
  extent,
  known,
  keyed,
  labelSize,
  look,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Look,
  type Reveal,
} from "./kit.tsx";
import type { Direction, NodeRole } from "./types.ts";
import { wrap } from "./wrap.ts";

export type RequirementLink =
  | "contains"
  | "copies"
  | "derives"
  | "satisfies"
  | "verifies"
  | "refines"
  | "traces";

export interface RequirementNode {
  /** The line above the name, such as "Functional Requirement". */
  readonly stereotype: string;
  /** A requirement is drawn in the task color, an element in the input color. Default "requirement". */
  readonly kind?: "requirement" | "element";
  /** Rows under the name, as [name, value] pairs. */
  readonly fields?: readonly (readonly [string, string])[];
}

export interface RequirementRelation<N extends string = string> {
  readonly from: N;
  readonly to: N;
  readonly type: RequirementLink;
}

export interface RequirementDiagramOptions<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  readonly reveal?: Reveal<N>;
}

type RelationId<R> = R extends {
  readonly from: infer F extends string;
  readonly to: infer T extends string;
}
  ? `${F}->${T}`
  : never;

export interface RequirementDiagram<
  N extends string,
  E extends string = `${N}->${N}`,
> extends Diagram<N | E> {
  edge(from: N, to: N): Route;
}

const WHAT = "requirementDiagram()";

const LINKS: readonly RequirementLink[] = [
  "contains",
  "copies",
  "derives",
  "satisfies",
  "verifies",
  "refines",
  "traces",
];

const LABEL = 0.25;
const MIN = 120;
const PAD_X = 12;
const PAD_Y = 8;
const COLUMN = 12;
const VALUE_WRAP = 220;
const RING = 6;

const round = (value: number): number => Math.round(value * 100) / 100;

interface Built {
  readonly id: string;
  readonly role: NodeRole;
  readonly stereotype: string;
  readonly rows: readonly { readonly key: string; readonly lines: readonly string[] }[];
  readonly keyWidth: number;
  readonly lineHeight: number;
  readonly head: number;
  readonly w: number;
  readonly h: number;
}

const build = (l: Look, id: string, node: RequirementNode): Built => {
  const lineHeight = Math.ceil(l.small * 1.5);
  const head = 2 * PAD_Y + lineHeight + Math.ceil(l.size * 1.5);

  const rows = (node.fields ?? []).map(([key, value]) => ({
    key,
    lines: wrap(l, value, l.small, VALUE_WRAP),
  }));

  const widest = (texts: readonly string[], size: number) =>
    Math.max(0, ...texts.map((t) => l.measure(t, size, l.weight)));

  const keyWidth = widest(
    rows.map((r) => r.key),
    l.small,
  );

  const valueWidth = widest(
    rows.flatMap((r) => r.lines),
    l.small,
  );

  const body = rows.reduce((h, r) => h + Math.max(1, r.lines.length) * lineHeight, 0);

  return {
    id,
    role: node.kind === "element" ? "input" : "task",
    stereotype: `«${node.stereotype}»`,
    rows,
    keyWidth,
    lineHeight,
    head,
    w: Math.ceil(
      Math.max(
        MIN,
        l.measure(id, l.size, l.weight) + 2 * PAD_X,
        l.measure(`«${node.stereotype}»`, l.small, l.weight) + 2 * PAD_X,
        rows.length > 0 ? keyWidth + COLUMN + valueWidth + 2 * PAD_X : 0,
      ),
    ),
    h: head + (rows.length > 0 ? body + 2 * PAD_Y + (rows.length - 1) * 2 : 0),
  };
};

export function requirementDiagram<
  const C extends Record<string, RequirementNode>,
  const R extends readonly RequirementRelation<NoInfer<keyof C & string>>[],
>(
  spec: {
    readonly nodes: C;
    readonly relations?: R;
  },
  options: RequirementDiagramOptions<NoInfer<keyof C & string>>,
): RequirementDiagram<keyof C & string, RelationId<R[number]>> {
  type Id = keyof C & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (!DIRECTIONS.includes(direction))
    throw new SceneError(
      `${WHAT} takes direction "TB", "LR", "BT" or "RL", got "${String(direction)}".`,
    );

  const built = Object.entries<RequirementNode>(spec.nodes).map(([id, n]) => build(l, id, n));
  const ids = built.map((n) => n.id);
  checkIds(ids, WHAT, "node");

  const relations = (spec.relations ?? []).map((r, i): RequirementRelation => {
    const where = `relation ${i + 1}`;

    if (!LINKS.includes(r.type))
      throw new SceneError(
        `${WHAT} ${where} has the type "${String(r.type)}".`,
        `A relation is one of ${LINKS.map((t) => `"${t}"`).join(", ")}.`,
      );

    return {
      type: r.type,
      from: known(r.from, ids, WHAT, "node", where),
      to: known(r.to, ids, WHAT, "node", where),
    };
  });

  const out = layered({
    direction,
    rankGap: 80,
    nodeGap: 48,
    nodes: built.map((n) => ({ id: n.id, w: n.w, h: n.h })),
    edges: relations.map((r) => ({
      from: r.from,
      to: r.to,
      label: labelSize(l, `«${r.type}»`),
    })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, move(b)]));

  const lines = out.edges.map((e, i) => ({
    relation: relations[i]!,
    points: e.points.map((p): Point => ({ x: p.x + dx, y: p.y + dy })),
    box: e.label && move(e.label),
  }));

  const cross = (b: Box) => (isVertical(direction) ? b.x : b.y);

  const order = [...ids].sort(
    (a, b) => out.rank.get(a)! - out.rank.get(b)! || cross(boxes.get(a)!) - cross(boxes.get(b)!),
  );

  const shown = schedule(options.reveal, order, WHAT);

  const drawn = (from: string, to: string): Span | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.4, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  const keys = keyed(lines.map((e) => edgeKey(e.relation.from, e.relation.to)));
  const timed = lines.map((e) => drawn(e.relation.from, e.relation.to));
  checkDraws(options.draw, keys, WHAT);

  const parts = new Map<string, Span | undefined>([
    ...order.map((id) => [id, shown.get(id)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [keys[i]!, t && span(t.start, t.over + LABEL)] as const;
    }),
  ]);

  const handle = partsOf<Id | RelationId<R[number]>>(WHAT, parts);

  const contains = (
    e: (typeof lines)[number],
    key: string,
    progress: ReturnType<typeof drawnBy>,
  ) => {
    const [a, b] = [e.points[0]!, e.points[1]!];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
    const [cx, cy] = [a.x + ux * RING, a.y + uy * RING];
    const mark = { color: l.colors.line, width: 1.5, cap: "round", join: "round" } as const;

    return (
      <Group
        key={`${key}:contains`}
        opacity={progress && through(progress, (d) => (d > 0 ? 1 : 0))}
      >
        <Shape
          key="ring"
          geometry={rect(2 * RING, 2 * RING, { radius: RING })}
          at={[round(cx - RING), round(cy - RING)]}
          fill={l.colors.background}
          stroke={mark}
        />
        <Shape
          key="plus"
          geometry={line([round(cx - RING + 2), round(cy)], [round(cx + RING - 2), round(cy)])}
          stroke={mark}
        />
        <Shape
          key="stem"
          geometry={line([round(cx), round(cy - RING + 2)], [round(cx), round(cy + RING - 2)])}
          stroke={mark}
        />
      </Group>
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {lines.map((e, i) => {
        const progress = drawnBy(options.draw, keys[i]!, timed[i], WHAT);
        const holds = e.relation.type === "contains";

        return (
          <Group key={keys[i]!}>
            <Edge
              key="line"
              look={l}
              points={e.points}
              draw={progress}
              head={holds ? "none" : "async"}
              stroke={holds ? undefined : { dash: [6, 4] }}
            />
            {holds && contains(e, keys[i]!, progress)}
          </Group>
        );
      })}
      {between}
      {built.map((c) => {
        const at = shown.get(c.id);
        const b = boxes.get(c.id)!;
        const tint = l.tint(c.role);

        return (
          <Group key={c.id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
            <Group key="fill" clip={rect(b.w, b.h, { radius: 6 })}>
              <Shape key="body" geometry={rect(b.w, b.h)} fill={l.wash(c.role, 0.05)} />
              <Shape key="head" geometry={rect(b.w, c.head)} fill={l.wash(c.role, 0.22)} />
            </Group>
            {c.rows.length > 0 && (
              <Shape
                key="rule"
                geometry={line([0, c.head], [b.w, c.head])}
                stroke={{ color: tint, width: 1 }}
              />
            )}
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 6 })}
              stroke={{ color: tint, width: 1.5 }}
            />
            <Text
              key="stereotype"
              font={l.font}
              size={l.small}
              weight={l.weight}
              fill={l.colors.muted}
              anchor="center"
              at={[b.w / 2, PAD_Y + c.lineHeight / 2]}
            >
              {c.stereotype}
            </Text>
            <Text
              key="name"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="center"
              at={[b.w / 2, c.head - PAD_Y - Math.ceil(l.size * 1.5) / 2]}
            >
              {c.id}
            </Text>
            {c.rows.map((r, k) => {
              const above = c.rows.slice(0, k).reduce((h, p) => h + p.lines.length, 0);
              const top = c.head + PAD_Y + above * c.lineHeight + k * 2;

              return (
                <Group key={`row:${k}`}>
                  <Text
                    key="key"
                    font={l.font}
                    size={l.small}
                    weight={l.weight}
                    fill={l.colors.muted}
                    anchor="left"
                    at={[PAD_X, round(top + c.lineHeight / 2)]}
                  >
                    {r.key}
                  </Text>
                  {r.lines.map((text, j) => (
                    <Text
                      key={`value:${j}`}
                      font={l.font}
                      size={l.small}
                      weight={l.weight}
                      fill={l.colors.text}
                      anchor="left"
                      at={[PAD_X + c.keyWidth + COLUMN, round(top + (j + 0.5) * c.lineHeight)]}
                    >
                      {text}
                    </Text>
                  ))}
                </Group>
              );
            })}
          </Group>
        );
      })}
      {lines.map((e, i) => {
        const t = timed[i];

        return (
          e.box && (
            <Chip
              key={`${keys[i]!}:label`}
              look={l}
              box={e.box}
              text={`«${e.relation.type}»`}
              motion={t && pop(span(t.start + t.over, LABEL))}
            />
          )
        );
      })}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: extent([...parts.values()]),
    ...handle,
    edge: (from, to) => {
      known(from, ids, WHAT, "node", "edge()");
      known(to, ids, WHAT, "node", "edge()");
      const found = lines.find((e) => e.relation.from === from && e.relation.to === to);

      if (!found) throw new SceneError(`${WHAT} has no relation from "${from}" to "${to}".`);

      return new Route([found.points]);
    },
  };
}
