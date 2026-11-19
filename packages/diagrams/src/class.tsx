/** @jsxImportSource svjeez */
import { Group, Shape, Text, line, rect, span, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import type { Box, Point } from "./layout/box.ts";
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
import { Link, type ClassEnd } from "./link.tsx";
import type { Direction } from "./types.ts";

export type { ClassEnd } from "./link.tsx";

export interface ClassSpec {
  readonly label?: string;
  /** Drawn as «annotation» above the name, as in «interface». */
  readonly annotation?: string;
  readonly attributes?: readonly string[];
  readonly methods?: readonly string[];
}

export interface ClassRelation<N extends string = string> {
  readonly from: N;
  readonly to: N;
  /** The marker at `from`. Default "none". */
  readonly start?: ClassEnd;
  /** The marker at `to`. Default "arrow". */
  readonly end?: ClassEnd;
  readonly line?: "solid" | "dashed";
  readonly label?: string;
  /** Text beside the `from` end, such as a cardinality. */
  readonly fromLabel?: string;
  readonly toLabel?: string;
}

export interface ClassNamespace<N extends string = string> {
  readonly label?: string;
  readonly classes: readonly N[];
}

export interface ClassDiagramOptions<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  readonly reveal?: Reveal<N>;
}

type RelationId<R> = R extends {
  readonly from: infer F extends string;
  readonly to: infer T extends string;
}
  ? `${F}->${T}`
  : never;

export interface ClassDiagram<
  N extends string,
  G extends string = never,
  E extends string = `${N}->${N}`,
> extends Diagram<N | G | E> {
  edge(from: N, to: N): Route;
}

const WHAT = "classDiagram()";
const ENDS: readonly ClassEnd[] = ["none", "triangle", "diamond", "diamond-filled", "arrow"];
const HOLLOW: readonly ClassEnd[] = ["triangle", "diamond", "diamond-filled"];
const LABEL = 0.25;

const round = (value: number): number => Math.round(value * 100) / 100;

interface Sizes {
  readonly pad: number;
  readonly line: number;
  readonly side: number;
  readonly name: number;
  readonly note: number;
  readonly section: number;
  readonly empty: number;
}

const sizesOf = (l: Look): Sizes => ({
  pad: Math.round(l.size * 0.5),
  line: Math.round(l.size * 1.5),
  side: Math.round(l.size * 0.85),
  name: Math.round(l.size * 1.5),
  note: Math.round(l.small * 1.3),
  section: Math.round(l.size * 0.4),
  empty: Math.round(l.size * 0.6),
});

interface Built {
  readonly id: string;
  readonly label: string;
  readonly annotation: string | undefined;
  readonly attributes: readonly string[];
  readonly methods: readonly string[];
  readonly w: number;
  readonly h: number;
  readonly head: number;
  readonly attrs: number;
}

const build = (l: Look, s: Sizes, id: string, spec: string | ClassSpec): Built => {
  const own = isBare(spec) ? { label: spec } : spec;
  const label = own.label ?? id;
  const annotation = own.annotation === undefined ? undefined : `«${own.annotation}»`;
  const [attributes, methods] = [own.attributes ?? [], own.methods ?? []];
  const part = (n: number) => (n === 0 ? s.empty : 2 * s.section + n * s.line);
  const head = 2 * s.pad + (annotation ? s.note : 0) + s.name;
  const members = attributes.length + methods.length > 0;
  const attrs = members ? part(attributes.length) : 0;

  const text = Math.max(
    l.measure(label, l.size * 1.1, l.weight),
    annotation ? l.measure(annotation, l.small) : 0,
    ...[...attributes, ...methods].map((m) => l.measure(m, l.size, l.weight)),
  );

  return {
    id,
    label,
    annotation,
    attributes,
    methods,
    w: Math.max(64, Math.ceil(text + 2 * s.side)),
    h: head + attrs + (members ? part(methods.length) : 0),
    head,
    attrs,
  };
};

const named = (id: string, ids: readonly string[], where: string): string => {
  if (!ids.includes(id))
    throw new SceneError(
      `${WHAT} ${where} names "${id}", which is not one of its classes.`,
      `Its classes are ${ids.map((c) => `"${c}"`).join(", ")}.`,
    );

  return id;
};

interface RelationLine {
  readonly relation: ClassRelation;
  readonly points: readonly Point[];
  readonly box: Box | undefined;
}

export function classDiagram<
  const C extends Record<string, string | ClassSpec>,
  const R extends readonly ClassRelation<NoInfer<keyof C & string>>[],
  const G extends Record<string, ClassNamespace<NoInfer<keyof C & string>>> = {},
>(
  spec: {
    readonly classes: C;
    readonly relations?: R;
    readonly namespaces?: G;
  },
  options: ClassDiagramOptions<NoInfer<keyof C & string>>,
): ClassDiagram<keyof C & string, keyof G & string, RelationId<R[number]>> {
  type Id = keyof C & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (direction !== "TB" && direction !== "LR")
    throw new SceneError(`${WHAT} takes direction "TB" or "LR", got "${String(direction)}".`);
  const s = sizesOf(l);

  const built = Object.entries<string | ClassSpec>(spec.classes).map(([id, c]) =>
    build(l, s, id, c),
  );

  const ids = built.map((c) => c.id);
  checkIds(ids, WHAT, "class");

  const relations = (spec.relations ?? []).map((r, i): ClassRelation => {
    const where = `relation ${i + 1}`;

    for (const end of [r.start, r.end])
      if (end !== undefined && !ENDS.includes(end))
        throw new SceneError(
          `${WHAT} ${where} has the end "${String(end)}".`,
          `An end is one of ${ENDS.map((e) => `"${e}"`).join(", ")}.`,
        );

    return {
      ...r,
      from: named(r.from, ids, where),
      to: named(r.to, ids, where),
    };
  });

  const spaces = Object.entries<ClassNamespace<string>>(spec.namespaces ?? {});
  checkIds(spaces.length === 0 ? ["-"] : spaces.map(([id]) => id), WHAT, "namespace");
  const member = new Map<string, string>();

  for (const [id, g] of spaces) {
    if (ids.includes(id))
      throw new SceneError(
        `${WHAT} has a namespace and a class both named "${id}".`,
        "Give the namespace another name.",
      );

    if (g.classes.length === 0)
      throw new SceneError(
        `${WHAT} namespace "${id}" holds no classes.`,
        "List its classes, or leave the namespace out.",
      );

    for (const c of g.classes) {
      named(c, ids, `namespace "${id}"`);
      const other = member.get(c);

      if (other)
        throw new SceneError(
          `${WHAT} puts class "${c}" in two namespaces, "${other}" and "${id}".`,
          "A class sits in one namespace at most.",
        );
      member.set(c, id);
    }
  }

  // The marked end (a parent, a whole) goes on top, whichever way the relation is written.
  const flipped = relations.map(
    (r) => HOLLOW.includes(r.end ?? "arrow") && !HOLLOW.includes(r.start ?? "none"),
  );

  const labelled = relations.some((r) => r.fromLabel !== undefined || r.toLabel !== undefined);

  const out = layered({
    direction,
    rankGap: labelled ? 80 : 64,
    nodeGap: 40,
    nodes: built.map((c) => ({ id: c.id, w: c.w, h: c.h })),
    edges: relations.map((r, i) => ({
      from: flipped[i] ? r.to : r.from,
      to: flipped[i] ? r.from : r.to,
      label: r.label === undefined ? undefined : labelSize(l, r.label),
    })),
    groups: spaces.map(([id, g]) => ({
      id,
      members: g.classes,
      label: { w: l.measure(g.label ?? id, l.small), h: l.small * 1.2 },
    })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, move(b)]));

  const lines = out.edges.map((e, i): RelationLine => {
    const points = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

    return {
      relation: relations[i]!,
      points: flipped[i] ? points.reverse() : points,
      box: e.label && move(e.label),
    };
  });

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

  const spaceAt = (g: ClassNamespace<string>): Span | undefined => {
    const spans = g.classes.map((c) => shown.get(c));

    if (spans.some((t) => !t)) return undefined;

    return span(Math.min(...spans.map((t) => t!.start)), 0.4);
  };

  const keys = keyed(lines.map((e) => edgeKey(e.relation.from, e.relation.to)));
  const timed = lines.map((e) => drawn(e.relation.from, e.relation.to));
  checkDraws(options.draw, keys, WHAT);

  const parts = new Map<string, Span | undefined>([
    ...order.map((id) => [id, shown.get(id)] as const),
    ...spaces.map(([id, g]) => [id, spaceAt(g)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [keys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<Id | (keyof G & string) | RelationId<R[number]>>(WHAT, parts);

  const labels = lines.flatMap((e) => (e.box ? [e.box] : []));

  const overlaps = (a: Box) =>
    labels.some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);

  // A cardinality sits just beside its end of the line, off the line and clear of the marker,
  // and moves to the other side of the line when a relation label is already there.
  const beside = (text: string, tip: Point, next: Point): Box => {
    const [w, h] = [l.measure(text, l.small) + 8, Math.round(l.small * 1.5)];
    const vertical = Math.abs(next.y - tip.y) >= Math.abs(next.x - tip.x);

    if (vertical) {
      const toward = Math.sign(next.y - tip.y || 1);

      // Right of the line, then left, then tucked closer to the node on either side.
      const spots = [18, 4].flatMap((gap) =>
        [tip.x + 8, tip.x - 8 - w].map((x) => ({
          x,
          y: tip.y + toward * (h / 2 + gap) - h / 2,
          w,
          h,
        })),
      );

      return spots.find((b) => !overlaps(b)) ?? spots[0]!;
    }

    const above = {
      x: tip.x + Math.sign(next.x - tip.x || 1) * (w / 2 + 18) - w / 2,
      y: tip.y - h - 3,
      w,
      h,
    };

    return overlaps(above) ? { ...above, y: tip.y + 3 } : above;
  };

  const ends = lines.flatMap((e, i) => {
    const [first, second] = [e.points[0]!, e.points[1]!];
    const [last, before] = [e.points.at(-1)!, e.points.at(-2)!];

    return [
      e.relation.fromLabel !== undefined && {
        key: `${keys[i]!}:from`,
        text: e.relation.fromLabel,
        box: beside(e.relation.fromLabel, first, second),
        at: timed[i],
      },
      e.relation.toLabel !== undefined && {
        key: `${keys[i]!}:to`,
        text: e.relation.toLabel,
        box: beside(e.relation.toLabel, last, before),
        at: timed[i],
      },
    ].flatMap((c) => (c === false ? [] : [c]));
  });

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {spaces.map(([id, g]) => {
        const b = move(out.groups.get(id)!);
        const at = spaceAt(g);

        return (
          <Group key={id} offset={[b.x, b.y]} motion={at && pop(at)}>
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 10 })}
              stroke={{ color: l.colors.line, width: 1, dash: [4, 3] }}
            />
            <Text key="label" font={l.font} size={l.small} fill={l.colors.muted} at={[12, 6]}>
              {g.label ?? id}
            </Text>
          </Group>
        );
      })}
      {lines.map((e, i) => (
        <Link
          key={keys[i]!}
          look={l}
          points={e.points}
          start={e.relation.start ?? "none"}
          end={e.relation.end ?? "arrow"}
          dashed={e.relation.line === "dashed"}
          draw={drawnBy(options.draw, keys[i]!, timed[i], WHAT)}
        />
      ))}
      {between}
      {built.map((c) => {
        const at = shown.get(c.id);
        const b = boxes.get(c.id)!;
        const tint = l.tint("task");

        const rows = (items: readonly string[], top: number) =>
          items.map((text, k) => (
            <Text
              key={`${top}:${k}`}
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="left"
              at={[s.side, round(top + s.section + s.line * (k + 0.5))]}
            >
              {text}
            </Text>
          ));

        return (
          <Group key={c.id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
            <Group key="fill" clip={rect(b.w, b.h, { radius: 6 })}>
              <Shape key="body" geometry={rect(b.w, b.h)} fill={l.wash("task", 0.06)} />
              <Shape key="head" geometry={rect(b.w, c.head)} fill={l.wash("task", 0.22)} />
            </Group>
            {c.attrs > 0 && (
              <Group key="rules">
                <Shape
                  key="head"
                  geometry={line([0, c.head], [b.w, c.head])}
                  stroke={{ color: tint, width: 1 }}
                />
                <Shape
                  key="methods"
                  geometry={line([0, c.head + c.attrs], [b.w, c.head + c.attrs])}
                  stroke={{ color: tint, width: 1 }}
                />
              </Group>
            )}
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 6 })}
              stroke={{ color: tint, width: 1.5 }}
            />
            {c.annotation !== undefined && (
              <Text
                key="annotation"
                font={l.font}
                size={l.small}
                fill={l.colors.muted}
                anchor="center"
                at={[b.w / 2, round(s.pad + s.note / 2)]}
              >
                {c.annotation}
              </Text>
            )}
            <Text
              key="name"
              font={l.font}
              size={l.size * 1.1}
              weight={l.weight}
              fill={l.colors.text}
              anchor="center"
              at={[b.w / 2, round(s.pad + (c.annotation ? s.note : 0) + s.name / 2)]}
            >
              {c.label}
            </Text>
            {rows(c.attributes, c.head)}
            {rows(c.methods, c.head + c.attrs)}
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
      {ends.map((c) => (
        <Chip
          key={c.key}
          look={l}
          box={c.box}
          text={c.text}
          motion={c.at && pop(span(c.at.start + c.at.over, LABEL))}
        />
      ))}
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
