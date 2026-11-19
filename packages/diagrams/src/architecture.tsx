/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, path, rect, span, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import { architecture as place, type Side } from "./layout/architecture.ts";
import { simplify, type Box, type Point } from "./layout/box.ts";
import {
  Chip,
  Edge,
  Route,
  checkDraws,
  checkIds,
  drawnBy,
  edgeKey,
  extent,
  keyed,
  known,
  labelSize,
  look,
  mix,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Look,
  type Reveal,
} from "./kit.tsx";

export type ArchitectureSide = Side;

export type ArchitectureIcon = "cloud" | "database" | "disk" | "internet" | "server";

export interface ArchitectureService {
  /** By default the id. */
  readonly label?: string;
  readonly icon?: ArchitectureIcon;
  /** The group it sits in. */
  readonly in?: string;
}

export interface ArchitectureGroup {
  readonly label?: string;
  readonly icon?: ArchitectureIcon;
  readonly in?: string;
}

export interface ArchitectureEdgeOptions {
  readonly label?: string;
  /** Where the arrow head goes: `"to"` (the end), `"from"` (the start), `"both"` or `"none"`, the default. */
  readonly head?: "none" | "to" | "from" | "both";
}

/** An edge from a side of one block to a side of another: `["db", "R", "api", "L"]` leaves `db` on its right and enters `api` on its left. */
export type ArchitectureEdge =
  | readonly [from: string, fromSide: Side, to: string, toSide: Side]
  | readonly [
      from: string,
      fromSide: Side,
      to: string,
      toSide: Side,
      options: ArchitectureEdgeOptions,
    ];

export interface ArchitectureSpec {
  readonly groups?: Readonly<Record<string, ArchitectureGroup>>;
  readonly services: Readonly<Record<string, ArchitectureService>>;
  /** Bare points where edges meet, drawn as a dot. */
  readonly junctions?: Readonly<Record<string, { readonly in?: string }>>;
  readonly edges?: readonly ArchitectureEdge[];
}

export interface ArchitectureOptions extends DiagramOptions {
  /** Services and junctions appear in reading order, by id. Groups appear with their first member, and an edge once both ends are there. */
  readonly reveal?: Reveal<string>;
}

export interface Architecture extends Diagram<string> {
  edge(from: string, to: string): Route;
}

const WHAT = "architecture()";
const MARGIN = 2;
const PAD = 14;
const STUB = 24;
const LABEL = 0.25;
const SIDES: readonly Side[] = ["L", "R", "T", "B"];

const GLYPHS: Readonly<Record<ArchitectureIcon, string>> = {
  database: "M4 6a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 6v12a8 3 0 0 0 16 0V6M4 12a8 3 0 0 0 16 0",
  server: "M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6",
  disk: "M5 3h14v18H5zM12 6.5a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 10.5h.01M8 18h3",
  internet:
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3a13 13 0 0 0 0 18M12 3a13 13 0 0 1 0 18",
  cloud: "M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z",
};

const round = (value: number): number => Math.round(value * 100) / 100;

const Glyph = (props: {
  readonly key: string;
  readonly look: Look;
  readonly icon: ArchitectureIcon;
  readonly at: Point;
  readonly size: number;
}): SceneElement => (
  <Group key={props.key} offset={[round(props.at.x), round(props.at.y)]} scale={props.size / 24}>
    <Shape
      geometry={path.parse(GLYPHS[props.icon])}
      stroke={{ color: props.look.colors.accent, width: 1.6, cap: "round", join: "round" }}
    />
  </Group>
);

const horizontal = (side: Side): boolean => side === "L" || side === "R";

const routeOf = (p: Point, sa: Side, q: Point, sb: Side): Point[] => {
  if (horizontal(sa) !== horizontal(sb))
    return simplify([p, horizontal(sa) ? { x: q.x, y: p.y } : { x: p.x, y: q.y }, q]);

  if (sa === sb) {
    const out = (side: Side): number =>
      side === "R"
        ? Math.max(p.x, q.x) + STUB
        : side === "L"
          ? Math.min(p.x, q.x) - STUB
          : side === "B"
            ? Math.max(p.y, q.y) + STUB
            : Math.min(p.y, q.y) - STUB;

    const at = out(sa);

    return simplify(
      horizontal(sa)
        ? [p, { x: at, y: p.y }, { x: at, y: q.y }, q]
        : [p, { x: p.x, y: at }, { x: q.x, y: at }, q],
    );
  }

  return simplify(
    horizontal(sa)
      ? [p, { x: (p.x + q.x) / 2, y: p.y }, { x: (p.x + q.x) / 2, y: q.y }, q]
      : [p, { x: p.x, y: (p.y + q.y) / 2 }, { x: q.x, y: (p.y + q.y) / 2 }, q],
  );
};

export function architecture(spec: ArchitectureSpec, options: ArchitectureOptions): Architecture {
  const l = look(options, WHAT);
  const groups = Object.entries(spec.groups ?? {});
  const services = Object.entries(spec.services);
  const junctions = Object.entries(spec.junctions ?? {});
  const leafIds = [...services.map(([id]) => id), ...junctions.map(([id]) => id)];
  const ids = [...leafIds, ...groups.map(([id]) => id)];
  checkIds(leafIds, WHAT, "service");

  if (new Set(ids).size !== ids.length)
    throw new SceneError(
      `${WHAT} has two cells with the same id.`,
      "Give each service, junction and group its own id.",
    );

  for (const [id, icon] of [...services, ...groups].map(([id, s]) => [id, s.icon] as const))
    if (icon !== undefined && !(icon in GLYPHS))
      throw new SceneError(
        `${WHAT} gives "${id}" the icon "${String(icon)}".`,
        `Its icons are ${Object.keys(GLYPHS).join(", ")}.`,
      );

  const edges = (spec.edges ?? []).map(([from, fromSide, to, toSide, opts], i) => {
    for (const side of [fromSide, toSide])
      if (!SIDES.includes(side))
        throw new SceneError(
          `${WHAT} edge ${i + 1} uses the side "${String(side)}".`,
          "A side is L, R, T or B.",
        );

    if (from === to)
      throw new SceneError(`${WHAT} edge ${i + 1} leads from "${from}" back to itself.`);

    return {
      from: known(from, leafIds, WHAT, "service", `edge ${i + 1}`),
      to: known(to, leafIds, WHAT, "service", `edge ${i + 1}`),
      fromSide,
      toSide,
      label: opts?.label,
      head: opts?.head ?? "none",
    };
  });

  const out = place({
    nodes: [
      ...services.map(([id, s]) => ({ id, in: s.in })),
      ...junctions.map(([id, j]) => ({ id, in: j.in })),
    ],
    groups: groups.map(([id, g]) => ({ id, in: g.in })),
    edges,
  });

  const tile = Math.round(l.size * 4.6);
  const glyph = Math.round(tile * 0.52);
  const textH = Math.round(l.size * 1.3);
  const label = (id: string): string => spec.services[id]?.label ?? id;

  const cw = Math.max(
    tile,
    ...services.map(([id]) => Math.ceil(l.measure(label(id), l.size, l.weight)) + 8),
  );

  const ch = tile + 6 + textH;
  const head = Math.max(Math.round(l.small * 1.2), 16) + 8;

  const titled = (id: string): boolean => {
    const g = spec.groups?.[id];

    return g !== undefined && (g.label !== undefined || g.icon !== undefined);
  };

  const inside = (id: string): string[] =>
    groups.filter(([, g]) => g.in === id).map(([gid]) => gid);

  const side = (id: string): number => PAD + Math.max(0, ...inside(id).map(side));

  const top = (id: string): number =>
    PAD + (titled(id) ? head : 0) + Math.max(0, ...inside(id).map(top));

  const sideMax = Math.max(0, ...groups.map(([id]) => side(id)));
  const topMax = Math.max(0, ...groups.map(([id]) => top(id)));
  const gap = Math.max(56, 2 * sideMax + 20, sideMax + topMax + 20);
  const [px, py] = [cw + gap, ch + gap];

  const cells = new Map(
    leafIds.map((id) => {
      const c = out.nodes.get(id)!;

      return [id, { x: c.col * px, y: c.row * py }] as const;
    }),
  );

  const frames = new Map<string, Box>(
    groups.map(([id]) => {
      const c = out.groups.get(id)!;
      const [s, t] = [side(id), top(id)];

      return [
        id,
        {
          x: c.col * px - s,
          y: c.row * py - t,
          w: c.cols * px - gap + 2 * s,
          h: c.rows * py - gap + s + t,
        },
      ] as const;
    }),
  );

  const [dx, dy] = [
    MARGIN - Math.min(0, ...[...frames.values()].map((b) => b.x)),
    MARGIN - Math.min(0, ...[...frames.values()].map((b) => b.y)),
  ];

  const isJunction = new Set(junctions.map(([id]) => id));

  const portOf = (id: string, s: Side): Point => {
    const c = cells.get(id)!;
    const middle = { x: c.x + dx + cw / 2, y: c.y + dy + tile / 2 };

    if (isJunction.has(id)) return middle;

    return s === "T"
      ? { x: middle.x, y: c.y + dy }
      : s === "B"
        ? { x: middle.x, y: c.y + dy + ch }
        : { x: middle.x + (s === "R" ? tile / 2 : -tile / 2), y: middle.y };
  };

  const lines = edges.map((e) => {
    const points = routeOf(
      portOf(e.from, e.fromSide),
      e.fromSide,
      portOf(e.to, e.toSide),
      e.toSide,
    );

    let at = points[0]!;
    let best = 0;

    for (let k = 1; k < points.length; k++) {
      const [a, b] = [points[k - 1]!, points[k]!];
      const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

      if (length > best) {
        best = length;
        at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }

    const size = e.label === undefined ? undefined : labelSize(l, e.label);

    return {
      ...e,
      points,
      box: size && { x: at.x - size.w / 2, y: at.y - size.h / 2, w: size.w, h: size.h },
    };
  });

  const reading = [...leafIds].sort(
    (a, b) =>
      out.nodes.get(a)!.row - out.nodes.get(b)!.row ||
      out.nodes.get(a)!.col - out.nodes.get(b)!.col,
  );

  const shown = schedule(options.reveal, reading, WHAT);

  const members = (id: string): string[] => [
    ...leafIds.filter((n) => [...services, ...junctions].find(([k]) => k === n)?.[1].in === id),
    ...inside(id).flatMap(members),
  ];

  const groupAt = (id: string): Span | undefined => {
    const spans = members(id).map((n) => shown.get(n));

    if (spans.length === 0 || spans.some((s) => !s)) return undefined;

    return span(Math.min(...spans.map((s) => s!.start)), 0.4);
  };

  const drawn = (from: string, to: string): Span | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.4, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  const keys = keyed(lines.map((e) => edgeKey(e.from, e.to)));
  const timed = lines.map((e) => drawn(e.from, e.to));
  checkDraws(options.draw, keys, WHAT);

  const parts = new Map<string, Span | undefined>([
    ...reading.map((id) => [id, shown.get(id)] as const),
    ...groups.map(([id]) => [id, groupAt(id)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [keys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<string>(WHAT, parts);

  const reach = [
    ...[...frames.values()].map((b) => [b.x + b.w + dx, b.y + b.h + dy] as const),
    ...[...cells.values()].map((c) => [c.x + dx + cw, c.y + dy + ch] as const),
    ...lines.flatMap((e) => e.points.map((p) => [p.x, p.y] as const)),
  ];

  const size = [
    Math.ceil(Math.max(...reach.map(([x]) => x)) + MARGIN),
    Math.ceil(Math.max(...reach.map(([, y]) => y)) + MARGIN),
  ] as const;

  const wash = mix(l.colors.accent, l.colors.background, 0.14);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {[...groups]
        .sort((a, b) => side(b[0]) - side(a[0]))
        .map(([id, g]) => {
          const b = frames.get(id)!;
          const at = groupAt(id);
          const left = g.icon === undefined ? 12 : 12 + 20;

          return (
            <Group key={id} offset={[round(b.x + dx), round(b.y + dy)]} motion={at && pop(at)}>
              <Shape
                key="frame"
                geometry={rect(round(b.w), round(b.h), { radius: 12 })}
                stroke={{ color: l.colors.line, width: 1, dash: [4, 3] }}
              />
              {g.icon !== undefined && (
                <Glyph key="icon" look={l} icon={g.icon} at={{ x: 10, y: 9 }} size={16} />
              )}
              {g.label !== undefined && (
                <Text key="label" font={l.font} size={l.small} fill={l.colors.muted} at={[left, 8]}>
                  {g.label}
                </Text>
              )}
            </Group>
          );
        })}
      {lines.map((e, i) => {
        const base = {
          look: l,
          draw: drawnBy(options.draw, keys[i]!, timed[i], WHAT),
          head: e.head === "none" ? ("none" as const) : ("filled" as const),
        };

        return e.head === "from" ? (
          <Edge key={keys[i]!} {...base} points={[...e.points].reverse()} />
        ) : e.head === "both" ? (
          <Group key={keys[i]!}>
            <Edge key="to" {...base} points={e.points} />
            <Edge key="from" {...base} points={[...e.points].reverse()} />
          </Group>
        ) : (
          <Edge key={keys[i]!} {...base} points={e.points} />
        );
      })}
      {between}
      {services.map(([id, s]) => {
        const c = cells.get(id)!;
        const at = shown.get(id);
        const x = c.x + dx;
        const y = c.y + dy;
        const t = (cw - tile) / 2;

        return (
          <Group key={id} offset={[round(x), round(y)]} motion={at && pop(at)}>
            <Shape
              key="tile"
              geometry={rect(tile, tile, { radius: 10 })}
              at={[round(t), 0]}
              fill={wash}
              stroke={{ color: l.colors.accent, width: 1.5 }}
            />
            {s.icon !== undefined && (
              <Glyph
                key="icon"
                look={l}
                icon={s.icon}
                at={{ x: round(t + (tile - glyph) / 2), y: round((tile - glyph) / 2) }}
                size={glyph}
              />
            )}
            <Text
              key="label"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="center"
              at={[round(cw / 2), round(tile + 6 + textH / 2)]}
            >
              {label(id)}
            </Text>
          </Group>
        );
      })}
      {junctions.map(([id]) => {
        const c = portOf(id, "R");
        const at = shown.get(id);

        return (
          <Shape
            key={id}
            geometry={circle(4)}
            at={[round(c.x), round(c.y)]}
            fill={l.colors.line}
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
              key={`${keys[i]!}:label`}
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

  return {
    node: draw(),
    with: draw,
    size,
    span: extent([...parts.values()]),
    ...handle,
    edge: (from, to) => {
      const line = lines.find((e) => e.from === from && e.to === to);

      if (!line) throw new SceneError(`${WHAT} has no edge from "${from}" to "${to}".`);

      return new Route([line.points]);
    },
  };
}
