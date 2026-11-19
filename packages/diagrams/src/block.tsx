/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  ellipse,
  line,
  polygon,
  rect,
  span,
  type SceneElement,
  type Span,
} from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import type { Box, Point, Size } from "./layout/box.ts";
import { block as place, type BlockCell } from "./layout/block.ts";
import {
  Chip,
  Edge,
  Route,
  checkDraws,
  drawnBy,
  edgeKey,
  extent,
  keyed,
  known,
  labelSize,
  look,
  mix,
  outline,
  partsOf,
  pop,
  schedule,
  sizeOf,
  type Diagram,
  type DiagramOptions,
  type Look,
  type Reveal,
} from "./kit.tsx";
import type { FlowchartEdge, NodeRole } from "./types.ts";

export type BlockShape =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "circle"
  | "subroutine"
  | "cylinder"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-x"
  | "arrow-y";

export interface BlockBlock {
  readonly id: string;
  /** By default the id. */
  readonly label?: string;
  readonly shape?: BlockShape;
  /** Columns the block takes up, 1 by default. */
  readonly span?: number;
}

export interface BlockSpace {
  /** Empty columns, left blank in the grid. */
  readonly space: number;
}

export interface BlockGroup {
  readonly id: string;
  /** A title drawn on the group's frame. */
  readonly label?: string;
  readonly span?: number;
  /** Columns of the group's own grid; by default its cells share one row. */
  readonly columns?: number;
  readonly cells: readonly BlockItem[];
}

export type BlockItem = BlockBlock | BlockSpace | BlockGroup;

export interface BlockSpec {
  /** Columns of the grid; by default every cell shares one row. */
  readonly columns?: number;
  readonly cells: readonly BlockItem[];
  /** Arrows between blocks or groups, routed around the other blocks. */
  readonly edges?: readonly FlowchartEdge<string>[];
}

export interface BlockDiagramOptions extends DiagramOptions {
  /** Blocks and groups appear in reading order, by id. An edge draws once both its ends are there. */
  readonly reveal?: Reveal<string>;
}

export interface BlockDiagram extends Diagram<string> {
  edge(from: string, to: string): Route;
}

const WHAT = "blockDiagram()";
const GAP = 24;
const OVERHANG = 7;
const MAX_DEPTH = 20;
const LABEL = 0.25;

const ROLES: Record<BlockShape, NodeRole> = {
  rect: "task",
  round: "task",
  stadium: "input",
  diamond: "decision",
  circle: "output",
  subroutine: "tool",
  cylinder: "store",
  "arrow-right": "task",
  "arrow-left": "task",
  "arrow-up": "task",
  "arrow-down": "task",
  "arrow-x": "task",
  "arrow-y": "task",
};

const isSpace = (cell: BlockItem): cell is BlockSpace => "space" in cell;

const isGroup = (cell: BlockItem): cell is BlockGroup => "cells" in cell;

interface Arrow {
  readonly right: boolean;
  readonly left: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

const arrowOf = (shape: BlockShape): Arrow | undefined => {
  if (!shape.startsWith("arrow-")) return undefined;
  const to = shape.slice(6);

  return {
    right: to === "right" || to === "x",
    left: to === "left" || to === "x",
    up: to === "up" || to === "y",
    down: to === "down" || to === "y",
  };
};

const sizeOfBlock = (l: Look, shape: BlockShape, label: string): Size => {
  const arrow = arrowOf(shape);
  const text = l.measure(label, l.size, l.weight);

  if (arrow) {
    const flat = arrow.right || arrow.left;
    const both = (flat ? arrow.right && arrow.left : arrow.up && arrow.down) ? 2 : 1;

    if (flat) {
      const h = Math.max(l.size * 1.3 + 8, 14) + 2 * OVERHANG;

      return { w: Math.max(text + 12, 16) + Math.min(h / 2, MAX_DEPTH) * both, h };
    }

    const w = Math.max(text + 16, 14) + 2 * OVERHANG;

    return { w, h: Math.max(l.size * 1.3 + 8, 16) + Math.min(w / 2, MAX_DEPTH) * both };
  }

  if (shape === "circle") return { w: text * 1.2 + l.size * 2.5, h: Math.round(l.size * 3.2) };

  return sizeOf(l, ROLES[shape], label);
};

const arrowGeometry = (arrow: Arrow, w: number, h: number) => {
  const [x, y] = [w / 2, h / 2];
  const points: [number, number][] = [];

  if (arrow.right || arrow.left) {
    const depth = Math.min(y, MAX_DEPTH);
    const s = y - OVERHANG;
    const [x0, x1] = [arrow.left ? -x + depth : -x, arrow.right ? x - depth : x];
    points.push([x0, -s], [x1, -s]);

    if (arrow.right) points.push([x1, -y], [x, 0], [x1, y]);
    points.push([x1, s], [x0, s]);

    if (arrow.left) points.push([x0, y], [-x, 0], [x0, -y]);
  } else {
    const depth = Math.min(x, MAX_DEPTH);
    const s = x - OVERHANG;
    const [y0, y1] = [arrow.up ? -y + depth : -y, arrow.down ? y - depth : y];
    points.push([s, y0], [s, y1]);

    if (arrow.down) points.push([x, y1], [0, y], [-x, y1]);
    points.push([-s, y1], [-s, y0]);

    if (arrow.up) points.push([-x, y0], [0, -y], [x, y0]);
  }

  return polygon(...points.map(([px, py]): [number, number] => [px + x, py + y]));
};

const nudgeOf = (arrow: Arrow | undefined, w: number, h: number): Point => {
  if (!arrow) return { x: 0, y: 0 };
  const flat = arrow.right || arrow.left;
  const depth = Math.min((flat ? h : w) / 2, MAX_DEPTH);

  return flat
    ? { x: ((Number(arrow.left) - Number(arrow.right)) * depth) / 2, y: 0 }
    : { x: 0, y: ((Number(arrow.up) - Number(arrow.down)) * depth) / 2 };
};

interface Leaf {
  readonly id: string;
  readonly label: string;
  readonly shape: BlockShape;
}

interface Frame {
  readonly id: string;
  readonly label: string | undefined;
}

const cellOf = (
  l: Look,
  spec: BlockItem,
  leaves: Leaf[],
  frames: Frame[],
  order: string[],
): BlockCell => {
  if (isSpace(spec)) {
    if (!(Number.isInteger(spec.space) && spec.space >= 1))
      throw new SceneError(
        `${WHAT} space needs a whole number of columns of 1 or more, got ${spec.space}.`,
      );

    return { space: true, span: spec.space };
  }

  if (isGroup(spec)) {
    if (spec.cells.length === 0)
      throw new SceneError(
        `${WHAT} group "${spec.id}" holds no cells.`,
        "Put a block in it, or leave the group out.",
      );
    frames.push({ id: spec.id, label: spec.label });
    order.push(spec.id);
    const w = spec.label === undefined ? 0 : l.measure(spec.label, l.small) + 24;

    return {
      id: spec.id,
      span: spec.span,
      columns: spec.columns,
      size: { w, h: 0 },
      head: spec.label === undefined ? 0 : Math.round(l.small * 1.2) + 10,
      cells: spec.cells.map((c) => cellOf(l, c, leaves, frames, order)),
    };
  }

  const leaf = { id: spec.id, label: spec.label ?? spec.id, shape: spec.shape ?? "rect" };

  if (!(leaf.shape in ROLES))
    throw new SceneError(`${WHAT} block "${spec.id}" has the shape "${String(leaf.shape)}".`);
  leaves.push(leaf);
  order.push(spec.id);

  return { id: spec.id, span: spec.span, size: sizeOfBlock(l, leaf.shape, leaf.label) };
};

const outlineOf = (l: Look, shape: BlockShape, w: number, h: number): SceneElement => {
  const arrow = arrowOf(shape);
  const role = ROLES[shape];
  const tint = arrow ? l.colors.accent : l.tint(role);
  const fill = arrow ? mix(tint, l.colors.background, 0.22) : l.wash(role);
  const stroke = { color: tint, width: 1.5, join: "round" } as const;

  if (arrow)
    return <Shape key="shape" geometry={arrowGeometry(arrow, w, h)} fill={fill} stroke={stroke} />;

  switch (shape) {
    case "rect":
      return <Shape key="shape" geometry={rect(w, h, { radius: 3 })} fill={fill} stroke={stroke} />;
    case "round":
      return (
        <Shape key="shape" geometry={rect(w, h, { radius: 10 })} fill={fill} stroke={stroke} />
      );
    case "stadium":
      return (
        <Shape key="shape" geometry={rect(w, h, { radius: h / 2 })} fill={fill} stroke={stroke} />
      );
    case "circle":
      return (
        <Shape
          key="shape"
          geometry={ellipse(w / 2, h / 2)}
          at={[w / 2, h / 2]}
          fill={fill}
          stroke={stroke}
        />
      );
    case "subroutine":
      return (
        <Group key="shape">
          <Shape geometry={rect(w, h, { radius: 3 })} fill={fill} stroke={stroke} />
          <Shape geometry={line([8, 0], [8, h])} stroke={stroke} />
          <Shape geometry={line([w - 8, 0], [w - 8, h])} stroke={stroke} />
        </Group>
      );
    default:
      return <Shape key="shape" geometry={outline(role, w, h)} fill={fill} stroke={stroke} />;
  }
};

const round = (value: number): number => Math.round(value * 100) / 100;

export function blockDiagram(spec: BlockSpec, options: BlockDiagramOptions): BlockDiagram {
  const l = look(options, WHAT);
  const leaves: Leaf[] = [];
  const frames: Frame[] = [];
  const order: string[] = [];
  const cells = spec.cells.map((c) => cellOf(l, c, leaves, frames, order));

  if (leaves.length === 0) throw new SceneError(`${WHAT} needs at least one block, got none.`);

  if (new Set(order).size !== order.length)
    throw new SceneError(
      `${WHAT} has two cells with the same id.`,
      "Give each block and group its own id.",
    );

  for (const id of order)
    if (id === "" || id.includes("/"))
      throw new SceneError(
        `${WHAT} has a block named "${id}".`,
        'Name it with no "/", so its part can be found.',
      );

  const edges = (spec.edges ?? []).map(([from, to, label, style]: FlowchartEdge<string>, i) => ({
    from: known(from, order, WHAT, "block", `edge ${i + 1}`),
    to: known(to, order, WHAT, "block", `edge ${i + 1}`),
    label,
    style,
  }));

  const out = place({ cells, columns: spec.columns, edges, gap: GAP });
  const [dx, dy] = [2 - out.bounds.x, 2 - out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const boxes = new Map([...out.boxes].map(([id, b]) => [id, move(b)] as const));

  const lines = out.edges.map((points, i) => {
    const e = edges[i]!;
    const moved = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    let at = moved[0]!;
    let best = 0;

    for (let k = 1; k < moved.length; k++) {
      const [a, b] = [moved[k - 1]!, moved[k]!];
      const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

      if (length > best) {
        best = length;
        at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }

    const size = e.label === undefined ? undefined : labelSize(l, e.label);

    return {
      ...e,
      points: moved,
      box: size && { x: at.x - size.w / 2, y: at.y - size.h / 2, w: size.w, h: size.h },
    };
  });

  const shown = schedule(options.reveal, order, WHAT);

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
    ...order.map((id) => [id, shown.get(id)] as const),
    ...lines.map((e, i) => {
      const t = timed[i];

      return [keys[i]!, t && (e.box ? span(t.start, t.over + LABEL) : t)] as const;
    }),
  ]);

  const handle = partsOf<string>(WHAT, parts);
  const arrows = new Map(leaves.map((b) => [b.id, arrowOf(b.shape)] as const));
  const all = [...boxes.values()];

  const width =
    Math.max(...all.map((b) => b.x + b.w), ...lines.flatMap((e) => e.points.map((p) => p.x))) + 2;

  const height =
    Math.max(...all.map((b) => b.y + b.h), ...lines.flatMap((e) => e.points.map((p) => p.y))) + 2;

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {frames.map((f) => {
        const b = boxes.get(f.id)!;
        const at = shown.get(f.id);

        return (
          <Group key={f.id} offset={[round(b.x), round(b.y)]} motion={at && pop(at)}>
            <Shape
              key="frame"
              geometry={rect(round(b.w), round(b.h), { radius: 10 })}
              stroke={{ color: l.colors.line, width: 1, dash: [4, 3] }}
            />
            {f.label !== undefined && (
              <Text key="label" font={l.font} size={l.small} fill={l.colors.muted} at={[12, 8]}>
                {f.label}
              </Text>
            )}
          </Group>
        );
      })}
      {lines.map((e, i) => (
        <Edge
          key={keys[i]!}
          look={l}
          points={e.points}
          draw={drawnBy(options.draw, keys[i]!, timed[i], WHAT)}
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
      {leaves.map((b) => {
        const box = boxes.get(b.id)!;
        const [w, h] = [round(box.w), round(box.h)];
        const at = shown.get(b.id);
        const nudge = nudgeOf(arrows.get(b.id), w, h);

        return (
          <Group key={b.id} offset={[round(box.x), round(box.y)]} motion={at && pop(at)}>
            {outlineOf(l, b.shape, w, h)}
            <Text
              key="label"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="center"
              at={[
                round(w / 2 + nudge.x),
                round(h / 2 + nudge.y + (b.shape === "cylinder" ? 2.5 : 0)),
              ]}
            >
              {b.label}
            </Text>
          </Group>
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
    size: [Math.ceil(width), Math.ceil(height)],
    span: extent([...parts.values()]),
    ...handle,
    edge: (from, to) => {
      const line = lines.find((e) => e.from === from && e.to === to);

      if (!line) throw new SceneError(`${WHAT} has no edge from "${from}" to "${to}".`);

      return new Route([line.points]);
    },
  };
}
