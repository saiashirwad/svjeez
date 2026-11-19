/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  path,
  rect,
  span,
  through,
  type SceneElement,
  type Span,
} from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import { DIRECTIONS, isVertical, union, type Box, type Point } from "./layout/box.ts";
import {
  Edge,
  Route,
  checkDraws,
  checkIds,
  detailOf,
  drawnBy,
  edgeKey,
  extent,
  keyed,
  known,
  look,
  mix,
  outline,
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

export type C4Kind = "person" | "system" | "container" | "component";

export interface C4Element {
  readonly label: string;
  /** Default "system". */
  readonly kind?: C4Kind;
  /** A database is drawn as a cylinder and a queue as a pill. Default "box". */
  readonly shape?: "box" | "db" | "queue";
  /** An element outside the system is drawn in grey. */
  readonly external?: boolean;
  /** The technology, shown as `[Container: tech]`. */
  readonly techn?: string;
  readonly descr?: string;
  /** The boundary this element sits in. */
  readonly boundary?: string;
}

export interface C4Boundary {
  readonly label: string;
  /** Shown after the label in brackets, such as "System". */
  readonly type?: string;
  /** The boundary this one sits in. */
  readonly boundary?: string;
}

export interface C4Relation<N extends string = string> {
  readonly from: N;
  readonly to: N;
  readonly label?: string;
  readonly techn?: string;
  /** Draw an arrow head at both ends. */
  readonly both?: boolean;
}

export interface C4Options<N extends string = string> extends DiagramOptions {
  readonly direction?: Direction;
  /** Drawn centred above the diagram. */
  readonly title?: string;
  readonly reveal?: Reveal<N>;
}

type RelationId<R> = R extends {
  readonly from: infer F extends string;
  readonly to: infer T extends string;
}
  ? `${F}->${T}`
  : never;

export interface C4<N extends string, E extends string = `${N}->${N}`> extends Diagram<N | E> {
  edge(from: N, to: N): Route;
}

const WHAT = "c4()";

const KINDS: readonly C4Kind[] = ["person", "system", "container", "component"];
const SHAPES = ["box", "db", "queue"];

const ROLES: Readonly<Record<C4Kind, NodeRole>> = {
  person: "input",
  system: "task",
  container: "output",
  component: "tool",
};

const NAMES: Readonly<Record<C4Kind, string>> = {
  person: "Person",
  system: "Software System",
  container: "Container",
  component: "Component",
};

const LABEL = 0.25;
const MIN = 160;
const DESCR_WRAP = 200;
const PAD_X = 14;
const PAD_Y = 12;
const GLYPH = 34;
const LID = 5;
const NEST = 14;
const TITLE = 40;

const round = (value: number): number => Math.round(value * 100) / 100;

interface Built {
  readonly id: string;
  readonly element: C4Element;
  readonly kind: C4Kind;
  readonly kindLine: string;
  readonly descr: readonly string[];
  readonly line: number;
  readonly lid: number;
  readonly w: number;
  readonly h: number;
}

const build = (l: Look, id: string, e: C4Element): Built => {
  const kind = e.kind ?? "system";
  const line = Math.ceil(l.small * 1.5);

  const kindLine = `[${e.external ? "External " : ""}${NAMES[kind]}${
    e.techn ? `: ${e.techn}` : ""
  }]`;

  const descr = e.descr ? wrap(l, e.descr, l.small, DESCR_WRAP) : [];
  const lid = e.shape === "db" ? 2 * LID : 0;

  const text = Math.max(
    l.measure(e.label, l.size, l.weight),
    l.measure(kindLine, l.small, l.weight),
    ...descr.map((d) => l.measure(d, l.small, l.weight)),
  );

  const h =
    2 * PAD_Y +
    lid +
    (kind === "person" ? GLYPH : 0) +
    Math.ceil(l.size * 1.5) +
    line +
    (descr.length > 0 ? 4 + descr.length * line : 0);

  return {
    id,
    element: e,
    kind,
    kindLine,
    descr,
    line,
    lid,
    w: Math.ceil(Math.max(MIN, text + 2 * PAD_X)),
    h,
  };
};

/** The first stretch of a route, run backwards, so a second arrow head sits at its start. */
const stub = (points: readonly Point[]): Point[] => {
  const [a, b] = [points[0]!, points[1]!];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const reach = Math.min(length, 30) / length;

  return [{ x: a.x + (b.x - a.x) * reach, y: a.y + (b.y - a.y) * reach }, a];
};

interface Tag {
  readonly text: string;
  readonly techn: string | undefined;
}

const tag = (r: C4Relation): Tag => ({
  text: r.label ?? "",
  techn: r.techn ? `[${r.techn}]` : undefined,
});

export function c4<
  const C extends Record<string, C4Element>,
  const B extends Record<string, C4Boundary>,
  const R extends readonly C4Relation<NoInfer<keyof C & string>>[],
>(
  spec: {
    readonly elements: C;
    readonly boundaries?: B;
    readonly relations?: R;
  },
  options: C4Options<NoInfer<(keyof C | keyof B) & string>>,
): C4<(keyof C | keyof B) & string, RelationId<R[number]>> {
  type Id = (keyof C | keyof B) & string;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (!DIRECTIONS.includes(direction))
    throw new SceneError(
      `${WHAT} takes direction "TB", "LR", "BT" or "RL", got "${String(direction)}".`,
    );

  const built = Object.entries<C4Element>(spec.elements).map(([id, e]) => {
    if (!KINDS.includes(e.kind ?? "system"))
      throw new SceneError(
        `${WHAT} element "${id}" has the kind "${String(e.kind)}".`,
        `A kind is one of ${KINDS.map((k) => `"${k}"`).join(", ")}.`,
      );

    if (!SHAPES.includes(e.shape ?? "box"))
      throw new SceneError(
        `${WHAT} element "${id}" has the shape "${String(e.shape)}".`,
        'A shape is one of "box", "db", "queue".',
      );

    return build(l, id, e);
  });

  const walls = Object.entries<C4Boundary>(spec.boundaries ?? {});
  const ids = built.map((e) => e.id);
  const wallIds = walls.map(([id]) => id);
  checkIds([...ids, ...wallIds], WHAT, "element or boundary");

  if (new Set([...ids, ...wallIds]).size !== ids.length + wallIds.length)
    throw new SceneError(
      `${WHAT} has an element and a boundary with the same name.`,
      "Give each element and boundary its own name.",
    );

  const parentOf = new Map<string, string>();

  for (const [id, w] of walls) {
    if (w.boundary === undefined) continue;
    known(w.boundary, wallIds, WHAT, "boundary", `boundary "${id}"`);
    parentOf.set(id, w.boundary);
  }

  for (const [id] of walls)
    for (let at: string | undefined = id, n = 0; at !== undefined; at = parentOf.get(at))
      if (++n > wallIds.length + 1)
        throw new SceneError(`${WHAT} boundary "${id}" sits inside itself.`);

  const direct = new Map<string, string[]>(wallIds.map((id) => [id, []]));

  for (const e of built)
    if (e.element.boundary !== undefined)
      direct
        .get(known(e.element.boundary, wallIds, WHAT, "boundary", `element "${e.id}"`))!
        .push(e.id);

  const children = (id: string) => walls.filter(([, w]) => w.boundary === id).map(([c]) => c);

  const below = (id: string): string[] => [
    ...direct.get(id)!,
    ...children(id).flatMap((c) => below(c)),
  ];

  for (const id of wallIds)
    if (below(id).length === 0)
      throw new SceneError(
        `${WHAT} boundary "${id}" holds no elements.`,
        "Put an element in it, or leave the boundary out.",
      );

  const relations = (spec.relations ?? []).map((r, i): C4Relation => {
    const where = `relation ${i + 1}`;

    return {
      ...r,
      from: known(r.from, ids, WHAT, "element", where),
      to: known(r.to, ids, WHAT, "element", where),
    };
  });

  const flat = walls.filter(([id]) => direct.get(id)!.length > 0);

  const wallLabel = (w: C4Boundary) => {
    const type = w.type ? `[${w.type}]` : "";

    return {
      type,
      w: Math.ceil(
        l.measure(w.label, l.small, l.weight) + (type ? 8 + l.measure(type, l.small) : 0),
      ),
      h: Math.ceil(l.small * 1.2),
    };
  };

  const tags = relations.map(tag);

  const out = layered({
    direction,
    rankGap: 80,
    nodeGap: 48,
    nodes: built.map((e) => ({ id: e.id, w: e.w, h: e.h })),
    edges: relations.map((r, i) => {
      const t = tags[i]!;
      const lines = (t.text ? 1 : 0) + (t.techn ? 1 : 0);

      return {
        from: r.from,
        to: r.to,
        label:
          lines === 0
            ? undefined
            : {
                w: Math.ceil(
                  Math.max(l.measure(t.text, l.small), t.techn ? l.measure(t.techn, l.small) : 0) +
                    10,
                ),
                h: lines * Math.ceil(l.small * 1.5),
              },
      };
    }),
    groups: flat.map(([id, w]) => ({ id, members: direct.get(id)!, label: wallLabel(w) })),
  });

  const frames = new Map<string, Box>();

  const frame = (id: string): Box => {
    const cached = frames.get(id);

    if (cached) return cached;
    const own = out.groups.get(id);
    const inner = children(id).map(frame);

    const box = (() => {
      if (inner.length === 0) return own!;
      const u = union([...(own ? [own] : []), ...inner]);
      const top = NEST + wallLabel(walls.find(([w]) => w === id)![1]).h + 4;

      return { x: u.x - NEST, y: u.y - top, w: u.w + 2 * NEST, h: u.h + top + NEST };
    })();

    frames.set(id, box);

    return box;
  };

  for (const id of wallIds) frame(id);

  const title = options.title ? TITLE : 0;
  const all = union([out.bounds, ...frames.values()]);
  const [dx, dy] = [-all.x, -all.y + title];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.nodes].map(([id, b]) => [id, move(b)]));

  const lines = out.edges.map((e, i) => ({
    relation: relations[i]!,
    tag: tags[i]!,
    points: e.points.map((p): Point => ({ x: p.x + dx, y: p.y + dy })),
    box: e.label && move(e.label),
  }));

  const width = Math.ceil(all.w);
  const height = Math.ceil(all.h + title);
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

  const wallAt = (id: string): Span | undefined => {
    const spans = below(id).map((n) => shown.get(n));

    if (spans.some((s) => !s)) return undefined;

    return span(Math.min(...spans.map((s) => s!.start)), 0.4);
  };

  const keys = keyed(lines.map((e) => edgeKey(e.relation.from, e.relation.to)));
  const timed = lines.map((e) => drawn(e.relation.from, e.relation.to));
  checkDraws(options.draw, keys, WHAT);

  const parts = new Map<string, Span | undefined>([
    ...order.map((id) => [id, shown.get(id)] as const),
    ...wallIds.map((id) => [id, wallAt(id)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [keys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<Id | RelationId<R[number]>>(WHAT, parts);

  const depth = (id: string): number => (parentOf.has(id) ? 1 + depth(parentOf.get(id)!) : 0);
  const outer = [...walls].sort(([a], [b]) => depth(a) - depth(b));

  const grey = l.colors.muted;
  const tint = (e: Built): Color => (e.element.external ? grey : l.tint(ROLES[e.kind]));

  const fill = (e: Built): Color =>
    e.element.external ? mix(grey, l.colors.background, 0.18) : l.wash(ROLES[e.kind], 0.2);

  const card = (c: Built): SceneElement => {
    const b = boxes.get(c.id)!;
    const at = shown.get(c.id);
    const stroke = { color: tint(c), width: 1.5 };

    const geometry =
      c.element.shape === "db"
        ? outline("store", b.w, b.h)
        : c.element.shape === "queue"
          ? outline("output", b.w, b.h)
          : outline("task", b.w, b.h);

    const lid = c.element.shape === "db" ? detailOf("store", b.w, b.h) : undefined;
    const glyph = c.kind === "person" ? GLYPH : 0;
    const top = PAD_Y + c.lid / 2 + glyph;
    const nameH = Math.ceil(l.size * 1.5);

    return (
      <Group key={c.id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
        <Shape key="shape" geometry={geometry} fill={fill(c)} stroke={stroke} />
        {lid && <Shape key="lid" geometry={lid} stroke={stroke} />}
        {c.kind === "person" && (
          <Group key="person">
            <Shape
              key="head"
              geometry={circle(5)}
              anchor="center"
              at={[b.w / 2, PAD_Y + 7]}
              fill={tint(c)}
            />
            <Shape
              key="body"
              geometry={path()
                .moveTo([b.w / 2 - 10, PAD_Y + 26])
                .curveTo(
                  [b.w / 2 - 10, PAD_Y + 14],
                  [b.w / 2 + 10, PAD_Y + 14],
                  [b.w / 2 + 10, PAD_Y + 26],
                )
                .close()}
              fill={tint(c)}
            />
          </Group>
        )}
        <Text
          key="name"
          font={l.font}
          size={l.size}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[b.w / 2, round(top + nameH / 2)]}
        >
          {c.element.label}
        </Text>
        <Text
          key="kind"
          font={l.font}
          size={l.small}
          weight={l.weight}
          fill={l.colors.muted}
          anchor="center"
          at={[b.w / 2, round(top + nameH + c.line / 2)]}
        >
          {c.kindLine}
        </Text>
        {c.descr.map((text, k) => (
          <Text
            key={`descr:${k}`}
            font={l.font}
            size={l.small}
            weight={l.weight}
            fill={l.colors.text}
            anchor="center"
            at={[b.w / 2, round(top + nameH + c.line + 4 + (k + 0.5) * c.line)]}
          >
            {text}
          </Text>
        ))}
      </Group>
    );
  };

  const note = (e: (typeof lines)[number], key: string, t: Span | undefined): SceneElement => {
    const b = e.box!;

    return (
      <Group
        key={`${key}:label`}
        offset={[round(b.x), round(b.y)]}
        motion={t && pop(span(t.start + t.over, LABEL))}
      >
        <Shape key="ground" geometry={rect(b.w, b.h, { radius: 3 })} fill={l.colors.background} />
        {e.tag.text !== "" && (
          <Text
            key="text"
            font={l.font}
            size={l.small}
            fill={l.colors.muted}
            anchor="center"
            at={[b.w / 2, round(e.tag.techn ? b.h / 4 : b.h / 2)]}
          >
            {e.tag.text}
          </Text>
        )}
        {e.tag.techn !== undefined && (
          <Text
            key="techn"
            font={l.font}
            size={l.small}
            fill={l.colors.muted}
            anchor="center"
            at={[b.w / 2, round(e.tag.text ? (3 * b.h) / 4 : b.h / 2)]}
          >
            {e.tag.techn}
          </Text>
        )}
      </Group>
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {options.title !== undefined && options.title !== "" && (
        <Text
          key="title"
          font={l.font}
          size={l.size * 1.2}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[width / 2, title / 2]}
        >
          {options.title}
        </Text>
      )}
      {outer.map(([id, w]) => {
        const b = move(frames.get(id)!);
        const at = wallAt(id);
        const label = wallLabel(w);

        return (
          <Group key={id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 10 })}
              stroke={{ color: l.colors.line, width: 1, dash: [6, 4] }}
            />
            <Text
              key="label"
              font={l.font}
              size={l.small}
              weight={l.weight}
              fill={l.colors.text}
              anchor="left"
              at={[12, round(8 + label.h / 2)]}
            >
              {w.label}
            </Text>
            {w.type !== undefined && w.type !== "" && (
              <Text
                key="type"
                font={l.font}
                size={l.small}
                fill={l.colors.muted}
                anchor="left"
                at={[12 + l.measure(w.label, l.small, l.weight) + 8, round(8 + label.h / 2)]}
              >
                {`[${w.type}]`}
              </Text>
            )}
          </Group>
        );
      })}
      {lines.map((e, i) => {
        const progress = drawnBy(options.draw, keys[i]!, timed[i], WHAT);

        return (
          <Group key={keys[i]!}>
            <Edge key="line" look={l} points={e.points} draw={progress} />
            {e.relation.both && (
              <Edge
                key="back"
                look={l}
                points={stub(e.points)}
                draw={progress && through(progress, (d) => Math.min(1, d * 8))}
              />
            )}
          </Group>
        );
      })}
      {between}
      {built.map(card)}
      {lines.map((e, i) => e.box && note(e, keys[i]!, timed[i]))}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [width, height],
    span: extent([...parts.values()]),
    ...handle,
    edge: (from, to) => {
      known(from, ids, WHAT, "element", "edge()");
      known(to, ids, WHAT, "element", "edge()");
      const found = lines.find((e) => e.relation.from === from && e.relation.to === to);

      if (!found) throw new SceneError(`${WHAT} has no relation from "${from}" to "${to}".`);

      return new Route([found.points]);
    },
  };
}
