/** @jsxImportSource svjeez */
import { Group, Shape, Text, line, rect, span, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import type { Box } from "./layout/box.ts";
import {
  Chip,
  Route,
  checkDraws,
  checkIds,
  drawnBy,
  edgeKey,
  extent,
  isBare,
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
import { Link, type ErCard } from "./link.tsx";
import type { Direction } from "./types.ts";

export type { ErCard } from "./link.tsx";

export interface ErAttribute {
  readonly type: string;
  readonly name: string;
  readonly keys?: readonly ("PK" | "FK" | "UK")[];
  readonly comment?: string;
}

export interface ErEntity {
  readonly label?: string;
  readonly attributes?: readonly ErAttribute[];
}

export interface ErRelation<N extends string = string> {
  readonly from: N;
  readonly to: N;
  /** How many of `from` take part. Default "one". */
  readonly fromCard?: ErCard;
  /** How many of `to` take part. Default "one". */
  readonly toCard?: ErCard;
  /** A "dashed" line is a non-identifying relationship. */
  readonly line?: "solid" | "dashed";
  readonly label?: string;
}

export interface ErDiagramOptions<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  readonly reveal?: Reveal<N>;
}

type RelationId<R> = R extends {
  readonly from: infer F extends string;
  readonly to: infer T extends string;
}
  ? `${F}->${T}`
  : never;

export interface ErDiagram<N extends string, E extends string = `${N}->${N}`> extends Diagram<
  N | E
> {
  edge(from: N, to: N): Route;
}

const WHAT = "erDiagram()";
const CARDS: readonly ErCard[] = ["one", "zero-one", "one-many", "zero-many"];
const LABEL = 0.25;
const MIN = 96;
const GAP = 16;
const PAD = 12;

const round = (value: number): number => Math.round(value * 100) / 100;

const named = (id: string, ids: readonly string[], where: string): string => {
  if (!ids.includes(id))
    throw new SceneError(
      `${WHAT} ${where} names "${id}", which is not one of its entities.`,
      `Its entities are ${ids.map((e) => `"${e}"`).join(", ")}.`,
    );

  return id;
};

interface Sizes {
  readonly name: number;
  readonly head: number;
  readonly row: number;
}

const sizesOf = (l: Look): Sizes => {
  const pad = Math.round(l.size * 0.6);
  const name = Math.round(l.size * 1.5);

  return { name, head: name + 2 * pad, row: name + pad };
};

interface Built {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly ErAttribute[];
  readonly at: readonly number[];
  readonly w: number;
  readonly h: number;
}

const build = (l: Look, s: Sizes, id: string, spec: string | ErEntity): Built => {
  const own = isBare(spec) ? { label: spec } : spec;
  const label = own.label ?? id;
  const rows = own.attributes ?? [];
  const keyed = (a: ErAttribute) => (a.keys ?? []).join(",");

  const widest = (texts: readonly string[], size: number) =>
    Math.max(0, ...texts.map((t) => l.measure(t, size, l.weight)));

  const columns = [
    widest(
      rows.map((a) => a.type),
      l.size,
    ),
    widest(
      rows.map((a) => a.name),
      l.size,
    ),
    widest(rows.map(keyed), l.small),
    widest(
      rows.map((a) => a.comment ?? ""),
      l.small,
    ),
  ];

  const at: number[] = [];
  let x = PAD;

  for (const c of columns) {
    at.push(x);

    if (c > 0) x += c + GAP;
  }

  const table = x - GAP + PAD;

  return {
    id,
    label,
    rows,
    at,
    w: Math.max(MIN, Math.ceil(Math.max(table, l.measure(label, l.size * 1.1, l.weight) + 36))),
    h: s.head + rows.length * s.row,
  };
};

export function erDiagram<
  const C extends Record<string, string | ErEntity>,
  const R extends readonly ErRelation<NoInfer<keyof C & string>>[],
>(
  spec: {
    readonly entities: C;
    readonly relations?: R;
  },
  options: ErDiagramOptions<NoInfer<keyof C & string>>,
): ErDiagram<keyof C & string, RelationId<R[number]>> {
  type Id = keyof C & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (direction !== "TB" && direction !== "LR")
    throw new SceneError(`${WHAT} takes direction "TB" or "LR", got "${String(direction)}".`);
  const s = sizesOf(l);

  const built = Object.entries<string | ErEntity>(spec.entities).map(([id, e]) =>
    build(l, s, id, e),
  );

  const ids = built.map((e) => e.id);
  checkIds(ids, WHAT, "entity");

  const relations = (spec.relations ?? []).map((r, i): ErRelation => {
    const where = `relation ${i + 1}`;

    for (const card of [r.fromCard, r.toCard])
      if (card !== undefined && !CARDS.includes(card))
        throw new SceneError(
          `${WHAT} ${where} has the cardinality "${String(card)}".`,
          `A cardinality is one of ${CARDS.map((c) => `"${c}"`).join(", ")}.`,
        );

    return {
      ...r,
      from: named(r.from, ids, where),
      to: named(r.to, ids, where),
    };
  });

  const out = layered({
    direction,
    rankGap: 72,
    nodeGap: 48,
    nodes: built.map((e) => ({ id: e.id, w: e.w, h: e.h })),
    edges: relations.map((r) => ({
      from: r.from,
      to: r.to,
      label: r.label === undefined ? undefined : labelSize(l, r.label),
    })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, move(b)]));

  const lines = out.edges.map((e, i) => ({
    relation: relations[i]!,
    points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    box: e.label && move(e.label),
  }));

  const cross = (b: Box) => (direction === "TB" ? b.x : b.y);

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

      return [keys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<Id | RelationId<R[number]>>(WHAT, parts);
  const tint = l.tint("task");

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {lines.map((e, i) => (
        <Link
          key={keys[i]!}
          look={l}
          points={e.points}
          start={e.relation.fromCard ?? "one"}
          end={e.relation.toCard ?? "one"}
          dashed={e.relation.line === "dashed"}
          draw={drawnBy(options.draw, keys[i]!, timed[i], WHAT)}
        />
      ))}
      {between}
      {built.map((c) => {
        const at = shown.get(c.id);
        const b = boxes.get(c.id)!;

        return (
          <Group key={c.id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
            <Group key="fill" clip={rect(b.w, b.h, { radius: 6 })}>
              <Shape key="body" geometry={rect(b.w, b.h)} fill={l.wash("task", 0.05)} />
              <Shape key="head" geometry={rect(b.w, s.head)} fill={l.wash("task", 0.22)} />
              {c.rows.map(
                (_, k) =>
                  k % 2 === 1 && (
                    <Shape
                      key={`stripe:${k}`}
                      geometry={rect(b.w, s.row)}
                      at={[0, s.head + k * s.row]}
                      fill={l.wash("task", 0.11)}
                    />
                  ),
              )}
            </Group>
            {c.rows.length > 0 && (
              <Shape
                key="rule"
                geometry={line([0, s.head], [b.w, s.head])}
                stroke={{ color: tint, width: 1 }}
              />
            )}
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 6 })}
              stroke={{ color: tint, width: 1.5 }}
            />
            <Text
              key="name"
              font={l.font}
              size={l.size * 1.1}
              weight={l.weight}
              fill={l.colors.text}
              anchor="center"
              at={[b.w / 2, s.head / 2]}
            >
              {c.label}
            </Text>
            {c.rows.map((a, k) => {
              const y = round(s.head + s.row * (k + 0.5));

              const cell = (part: number, text: string | undefined, size: number, fill: Color) =>
                text !== undefined &&
                text !== "" && (
                  <Text
                    key={`${k}:${part}`}
                    font={l.font}
                    size={size}
                    weight={l.weight}
                    fill={fill}
                    anchor="left"
                    at={[c.at[part]!, y]}
                  >
                    {text}
                  </Text>
                );

              return (
                <Group key={`row:${k}`}>
                  {cell(0, a.type, l.size, l.colors.muted)}
                  {cell(1, a.name, l.size, l.colors.text)}
                  {cell(2, (a.keys ?? []).join(","), l.small, l.colors.muted)}
                  {cell(3, a.comment, l.small, l.colors.muted)}
                </Group>
              );
            })}
          </Group>
        );
      })}
      {lines.map((e, i) => {
        const t = timed[i];

        return (
          e.box &&
          e.relation.label !== undefined && (
            <Chip
              key={`${keys[i]!}:label`}
              look={l}
              box={e.box}
              text={e.relation.label}
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
      named(from, ids, "edge()");
      named(to, ids, "edge()");
      const found = lines.find((e) => e.relation.from === from && e.relation.to === to);

      if (!found) throw new SceneError(`${WHAT} has no relation from "${from}" to "${to}".`);

      return new Route([found.points]);
    },
  };
}
