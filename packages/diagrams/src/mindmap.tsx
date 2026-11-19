/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  path,
  polygon,
  rect,
  span,
  through,
  type Geometry,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
import {
  checkDraws,
  checkIds,
  drawnBy,
  edgeKey,
  extent,
  isBare,
  known,
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
import { series } from "./series.ts";

export type MindShape = "default" | "rect" | "round" | "circle" | "cloud" | "bang" | "hex";

export interface MindNode<P extends string = string> {
  readonly label: string;
  /** The idea this one branches from. Exactly one node has none: the centre. */
  readonly parent?: P;
  readonly shape?: MindShape;
}

export type MindSpec<P extends string = string> = string | MindNode<P>;

export interface MindmapOptions<N extends string = string> extends DiagramOptions {
  readonly reveal?: Reveal<N>;
}

type MindEdges<N> = {
  [K in keyof N & string]: N[K] extends { readonly parent: infer P extends string }
    ? `${P}->${K}`
    : never;
}[keyof N & string];

export type Mindmap<N extends string, E extends string = `${N}->${N}`> = Diagram<N | E>;

const WHAT = "mindmap()";
const SHAPES: readonly MindShape[] = ["default", "rect", "round", "circle", "cloud", "bang", "hex"];
const WRAP = 220;
const FIRST_GAP = 56;
const GAP = 36;
const SIBLING = 10;
const BRANCH = 26;

interface Placed {
  readonly id: string;
  readonly label: string;
  readonly shape: MindShape;
  readonly lines: readonly string[];
  readonly children: Placed[];
  readonly depth: number;
  readonly branch: number;
  w: number;
  h: number;
  x: number;
  y: number;
  tall: number;
  side: 1 | -1;
}

const wrap = (l: Look, label: string): string[] => {
  const lines: string[] = [];
  let at = "";

  for (const word of label.split(" ")) {
    const next = at === "" ? word : `${at} ${word}`;

    if (at !== "" && l.measure(next, l.size, l.weight) > WRAP) {
      lines.push(at);
      at = word;
    } else at = next;
  }

  return [...lines, at];
};

const geometry = (shape: MindShape, w: number, h: number, pill: boolean): Geometry | undefined => {
  switch (shape) {
    case "default":
      return pill ? rect(w, h, { radius: h / 2 }) : undefined;
    case "rect":
      return rect(w, h, { radius: 3 });
    case "round":
      return rect(w, h, { radius: 10 });
    case "circle":
      return path()
        .moveTo([0, h / 2])
        .curveTo([0, h * 0.225], [w * 0.225, 0], [w / 2, 0])
        .curveTo([w * 0.775, 0], [w, h * 0.225], [w, h / 2])
        .curveTo([w, h * 0.775], [w * 0.775, h], [w / 2, h])
        .curveTo([w * 0.225, h], [0, h * 0.775], [0, h / 2])
        .close();
    case "hex": {
      const s = Math.min(h * 0.4, w / 4);

      return polygon([s, 0], [w - s, 0], [w, h / 2], [w - s, h], [s, h], [0, h / 2]);
    }

    case "cloud":
      return polygon(
        ...Array.from({ length: 96 }, (_, i): Vec => {
          const a = (i / 96) * Math.PI * 2;
          const r = 0.93 + 0.07 * Math.abs(Math.sin(a * 5));

          return [
            Math.round((w / 2 + (w / 2) * r * Math.cos(a)) * 100) / 100,
            Math.round((h / 2 + (h / 2) * r * Math.sin(a)) * 100) / 100,
          ];
        }),
      );
    case "bang":
      return polygon(
        ...Array.from({ length: 24 }, (_, i): Vec => {
          const a = (i / 24) * Math.PI * 2;
          const r = i % 2 === 0 ? 1 : 0.78;

          return [
            Math.round((w / 2 + (w / 2) * r * Math.cos(a)) * 100) / 100,
            Math.round((h / 2 + (h / 2) * r * Math.sin(a)) * 100) / 100,
          ];
        }),
      );
  }
};

export function mindmap<const N extends Record<string, MindSpec<string>>>(
  spec: { readonly nodes: N },
  options: MindmapOptions<NoInfer<keyof N & string>>,
): Mindmap<keyof N & string, MindEdges<N>> {
  type Id = keyof N & string;

  const l = look(options, WHAT);

  const given = Object.entries<MindSpec<string>>(spec.nodes).map(([id, s]) => ({
    id,
    label: isBare(s) ? s : s.label,
    parent: isBare(s) ? undefined : s.parent,
    shape: isBare(s) ? "default" : (s.shape ?? "default"),
  }));

  const ids = given.map((n) => n.id);
  checkIds(ids, WHAT, "node");

  for (const n of given) {
    if (n.parent !== undefined) known(n.parent, ids, WHAT, "node", `node "${n.id}"'s parent`);

    if (!SHAPES.includes(n.shape))
      throw new SceneError(
        `${WHAT} node "${n.id}" has the shape "${String(n.shape)}".`,
        `Use one of ${SHAPES.map((s) => `"${s}"`).join(", ")}.`,
      );
  }

  const roots = given.filter((n) => n.parent === undefined);

  if (roots.length !== 1)
    throw new SceneError(
      `${WHAT} needs exactly one node with no parent, got ${roots.length === 0 ? "none" : roots.map((n) => `"${n.id}"`).join(", ")}.`,
      "Give every other node a parent.",
    );

  const kids = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const n of given) if (n.parent !== undefined) kids.get(n.parent)!.push(n.id);
  const byId = new Map(given.map((n) => [n.id, n]));
  const seen = new Set<string>();

  const build = (id: string, depth: number, branch: number): Placed => {
    if (seen.has(id))
      throw new SceneError(`${WHAT} has a loop of parents through "${id}".`, "Break the loop.");
    seen.add(id);
    const n = byId.get(id)!;
    const lines = wrap(l, n.label);
    const children = kids.get(id)!;

    const node: Placed = {
      id,
      label: n.label,
      shape: n.shape,
      lines,
      children: [],
      depth,
      branch,
      w: 0,
      h: 0,
      x: 0,
      y: 0,
      tall: 0,
      side: 1,
    };

    node.children.push(...children.map((c, i) => build(c, depth + 1, depth === 0 ? i : branch)));

    return node;
  };

  const root = build(roots[0]!.id, 0, -1);

  if (seen.size !== ids.length)
    throw new SceneError(
      `${WHAT} has nodes that hang from a loop instead of the centre.`,
      "Make every node's parents lead back to the one node with no parent.",
    );

  const lineH = Math.round(l.size * 1.3);

  const measure = (n: Placed) => {
    const tw = Math.max(...n.lines.map((t) => l.measure(t, l.size, l.weight)));
    const th = n.lines.length * lineH;
    const pill = n.children.length > 0;

    const [w, h] =
      n.depth === 0 && n.shape === "default"
        ? [tw + 36, th + 18]
        : {
            default: pill ? [tw + 24, th + 10] : [tw + 12, th + 6],
            rect: [tw + 24, th + 14],
            round: [tw + 24, th + 14],
            hex: [tw + 40, th + 16],
            circle: [tw * 1.41 + 16, th * 1.41 + 12],
            cloud: [tw * 1.3 + 30, th * 1.6 + 18],
            bang: [tw * 1.4 + 36, th * 1.8 + 24],
          }[n.shape]!;

    n.w = Math.round(w!);
    n.h = Math.round(h!);
    n.children.forEach(measure);
  };

  measure(root);

  const stack = (nodes: readonly Placed[], gap: number): number =>
    nodes.reduce((sum, n, i) => sum + n.tall + (i > 0 ? gap : 0), 0);

  const size = (n: Placed) => {
    n.children.forEach(size);
    n.tall = Math.max(n.h, stack(n.children, SIBLING));
  };

  size(root);

  const place = (n: Placed, side: 1 | -1, near: number, middle: number) => {
    n.side = side;
    n.y = middle - n.h / 2;
    n.x = side === 1 ? near : near - n.w;
    const gap = GAP;
    let top = middle - stack(n.children, SIBLING) / 2;

    for (const c of n.children) {
      place(c, side, side === 1 ? n.x + n.w + gap : n.x - gap, top + c.tall / 2);
      top += c.tall + SIBLING;
    }
  };

  root.x = -root.w / 2;
  root.y = -root.h / 2;
  const branches = root.children;
  let cut = 0;
  let best = Infinity;

  for (let k = 0; k <= branches.length; k++) {
    const miss = Math.abs(stack(branches.slice(0, k), BRANCH) - stack(branches.slice(k), BRANCH));

    if (
      miss < best ||
      (miss === best && Math.abs(k - branches.length / 2) <= Math.abs(cut - branches.length / 2))
    ) {
      best = miss;
      cut = k;
    }
  }

  const right = branches.slice(0, cut);
  const left = branches.slice(cut).reverse();

  for (const [side, group] of [
    [1, right],
    [-1, left],
  ] as const) {
    let top = -stack(group, BRANCH) / 2;

    for (const b of group) {
      place(
        b,
        side,
        side === 1 ? root.w / 2 + FIRST_GAP : -root.w / 2 - FIRST_GAP,
        top + b.tall / 2,
      );
      top += b.tall + BRANCH;
    }
  }

  const all: Placed[] = [];

  const flat = (n: Placed) => {
    all.push(n);
    n.children.forEach(flat);
  };

  flat(root);

  const pad = 8;

  const [minX, minY, maxX, maxY] = [
    Math.min(...all.map((n) => n.x)) - pad,
    Math.min(...all.map((n) => n.y)) - pad,
    Math.max(...all.map((n) => n.x + n.w)) + pad,
    Math.max(...all.map((n) => n.y + n.h)) + pad,
  ];

  for (const n of all) {
    n.x -= minX;
    n.y -= minY;
  }

  const order = [root];

  for (let i = 0; i < order.length; i++) order.push(...order[i]!.children);

  const shown = schedule(
    options.reveal,
    order.map((n) => n.id),
    WHAT,
  );

  const links = all.flatMap((n) => n.children.map((c) => ({ from: n, to: c })));

  const drawn = (from: string, to: string): Span | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.35, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  checkDraws(
    options.draw,
    links.map((k) => edgeKey(k.from.id, k.to.id)),
    WHAT,
  );

  const parts = new Map<string, Span | undefined>([
    ...order.map((n) => [n.id, shown.get(n.id)] as const),
    ...links.map((k) => [edgeKey(k.from.id, k.to.id), drawn(k.from.id, k.to.id)] as const),
  ]);

  const handle = partsOf<Id | MindEdges<N>>(WHAT, parts);
  const tint = (n: Placed): Color => (n.branch < 0 ? l.colors.text : series(l, n.branch));

  const curve = (a: Placed, b: Placed) => {
    const [from, to] = b.side === 1 ? [a.x + a.w, b.x] : [a.x, b.x + b.w];
    const [y0, y1] = [a.y + a.h / 2, b.y + b.h / 2];
    const mid = (from + to) / 2;

    return path()
      .moveTo([Math.round(from * 100) / 100, y0])
      .curveTo([mid, y0], [mid, y1], [Math.round(to * 100) / 100, y1]);
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {links.map((k) => {
        const id = edgeKey(k.from.id, k.to.id);
        const progress = drawnBy(options.draw, id, drawn(k.from.id, k.to.id), WHAT);

        return (
          <Shape
            key={id}
            geometry={curve(k.from, k.to)}
            stroke={{ color: tint(k.to), width: k.from.depth === 0 ? 2.5 : 1.75, cap: "round" }}
            trim={progress === undefined ? undefined : through(progress, (d): Vec => [0, d])}
          />
        );
      })}
      {between}
      {all.map((n) => {
        const at = shown.get(n.id);
        const color = tint(n);
        const root = n.depth === 0;
        const geo = geometry(n.shape, n.w, n.h, root || n.children.length > 0);

        return (
          <Group
            key={n.id}
            offset={[Math.round(n.x * 100) / 100, Math.round(n.y * 100) / 100]}
            motion={at && pop(at)}
          >
            {geo && (
              <Shape
                key="shape"
                geometry={geo}
                fill={mix(color, l.colors.background, root ? 0.12 : 0.22)}
                stroke={{ color, width: 1.5, join: "round" }}
              />
            )}
            {n.lines.map((t, i) => (
              <Text
                key={`line-${i}`}
                font={l.font}
                size={l.size}
                weight={l.weight}
                fill={l.colors.text}
                anchor="center"
                at={[n.w / 2, n.h / 2 + (i - (n.lines.length - 1) / 2) * lineH]}
              >
                {t}
              </Text>
            ))}
          </Group>
        );
      })}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(maxX - minX), Math.ceil(maxY - minY)],
    span: extent([...parts.values()]),
    ...handle,
  };
}
