/** @jsxImportSource svjeez */
import { Group, Shape, Text, enter, rect, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  extent,
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
import { layoutTreemap, type TreemapBox, type TreemapInput } from "./layout/treemap.ts";
import { series } from "./series.ts";

export interface TreemapNode {
  readonly label: string;
  /** A leaf's size. Leave it out on a section, whose size is the sum of what it holds. */
  readonly value?: number;
  /** The id of the section this node sits in. Leave it out for a top-level node. */
  readonly parent?: string;
}

export interface TreemapSpec<N extends Record<string, TreemapNode>> {
  readonly title?: string;
  readonly nodes: N;
  /** Defaults to 640. */
  readonly width?: number;
  /** Defaults to 400. */
  readonly height?: number;
}

export interface TreemapOptions<Id extends string = string> extends DiagramOptions {
  readonly reveal?: Reveal<Id>;
}

export type Treemap<Id extends string> = Diagram<Id>;

const WHAT = "treemap()";
const HEADER = 28;
const SHORT = 18;
const LINE = 1.25;

const thousands = (n: number): string => {
  const [whole, frac] = `${Math.round(n * 100) / 100}`.split(".");

  return `${whole!.replace(/\B(?=(\d{3})+$)/g, ",")}${frac === undefined ? "" : `.${frac}`}`;
};

const fitText = (
  l: Look,
  text: string,
  room: number,
  max: number,
  min: number,
  weight = l.weight,
): { readonly text: string; readonly size: number } | undefined => {
  if (text === "" || room <= 0) return undefined;

  for (let size = max; ; size = Math.max(min, size - 1)) {
    if (l.measure(text, size, weight) <= room) return { text, size };

    if (size <= min) break;
  }

  let cut = text;

  while (cut.length > 1) {
    cut = cut.slice(0, -1);

    if (l.measure(`${cut.trimEnd()}…`, min, weight) <= room)
      return { text: `${cut.trimEnd()}…`, size: min };
  }

  return undefined;
};

export function treemap<const N extends Record<string, TreemapNode>>(
  spec: TreemapSpec<N>,
  options: TreemapOptions<NoInfer<keyof N & string>>,
): Treemap<keyof N & string> {
  type Id = keyof N & string;

  const l = look(options, WHAT);
  const ids = Object.keys(spec.nodes);
  checkIds(ids, WHAT, "node");
  const [width, height] = [spec.width ?? 640, spec.height ?? 400];

  if (!(width >= 40 && height >= 40))
    throw new SceneError(
      `${WHAT} needs a width and height of at least 40, got ${width} by ${height}.`,
    );
  const kids = new Map<string, string[]>(ids.map((id) => [id, []]));
  const tops: string[] = [];

  for (const id of ids) {
    const n = spec.nodes[id]!;

    if (n.parent === undefined) {
      tops.push(id);
      continue;
    }

    if (!kids.has(n.parent))
      throw new SceneError(
        `${WHAT} node "${id}" sits in "${n.parent}", which is not one of its nodes.`,
        `Its nodes are ${ids.map((x) => `"${x}"`).join(", ")}.`,
      );

    if (n.parent === id) throw new SceneError(`${WHAT} node "${id}" cannot sit in itself.`);
    kids.get(n.parent)!.push(id);
  }

  for (const id of ids) {
    const n = spec.nodes[id]!;
    const has = kids.get(id)!.length > 0;

    if (has && n.value !== undefined)
      throw new SceneError(
        `${WHAT} node "${id}" has a value and also holds other nodes.`,
        "Give a value to leaves only: a section adds up what it holds.",
      );

    if (!has && !(n.value !== undefined && n.value > 0 && Number.isFinite(n.value)))
      throw new SceneError(
        `${WHAT} node "${id}" needs a value above 0, or nodes inside it, got ${n.value}.`,
        "A leaf is sized by its value.",
      );
  }

  const tree = (id: string): TreemapInput => ({
    id,
    value: spec.nodes[id]!.value ?? 0,
    children: kids.get(id)!.map(tree),
  });

  const roots = tops.map(tree);

  const reached = (r: TreemapInput): number => 1 + r.children.reduce((s, c) => s + reached(c), 0);

  if (roots.reduce((s, r) => s + reached(r), 0) < ids.length)
    throw new SceneError(
      `${WHAT} has nodes that sit inside each other in a loop.`,
      "Nodes must form a tree: leave `parent` off the top-level ones.",
    );
  const shown = schedule(options.reveal, ids, WHAT);
  const leaves = ids.filter((id) => kids.get(id)!.length === 0).length;
  const crowd = Math.min(1, Math.max(0, Math.log10((width * height) / leaves / 800)));
  const gap = Math.round(2 + 2 * crowd);
  const side = Math.round(3 + 3 * crowd);

  const boxes = new Map<string, TreemapBox>(
    layoutTreemap(roots, width, height, { gap, header: HEADER, short: SHORT, side }).map((b) => [
      b.id,
      b,
    ]),
  );

  const [titleW, titleH] =
    spec.title === undefined
      ? [0, 0]
      : [l.measure(spec.title, l.size * 1.15, l.weight), l.size * 2.4];

  const pad = 8;
  const total = Math.max(width, titleW) + 2 * pad;
  const [left, top] = [(total - width) / 2, pad + titleH];
  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, shown.get(id)]));
  const handle = partsOf<Id>(WHAT, parts);
  const tiny = Math.round(l.size * 0.75);
  const least = Math.max(6, Math.round(l.size * 0.5625));

  const section = (b: TreemapBox, label: string): SceneElement => {
    const c = series(l, b.series);

    if (!b.headed) return <Group key="none" />;
    const short = b.header < HEADER;
    const room = b.w - 2 * 6 - 4;
    const value = thousands(b.value);
    const labelSize = short ? tiny : l.small;
    const valueW = l.measure(value, tiny, l.weight);
    const withValue = !short && room - valueW - 12 >= 3 * labelSize;
    const text = fitText(l, label, withValue ? room - valueW - 12 : room, labelSize, labelSize);

    return (
      <Group key="section">
        <Shape
          key="box"
          geometry={rect(b.w, b.h, { radius: Math.min(4, Math.min(b.w, b.h) / 4) })}
          at={[left + b.x, top + b.y]}
          fill={mix(c, l.colors.background, 0.12)}
          stroke={{ color: c, width: 1 }}
        />
        {text && text.size * LINE < b.header && (
          <Text
            key="label"
            font={l.font}
            size={text.size}
            weight={l.weight}
            fill={l.colors.text}
            anchor="left"
            at={[left + b.x + 8, top + b.y + b.header / 2 + 1]}
          >
            {text.text}
          </Text>
        )}
        {text && withValue && (
          <Text
            key="value"
            font={l.font}
            size={tiny}
            weight={l.weight}
            fill={l.colors.muted}
            anchor="right"
            at={[left + b.x + b.w - 8, top + b.y + b.header / 2 + 1]}
          >
            {value}
          </Text>
        )}
      </Group>
    );
  };

  const leaf = (b: TreemapBox, label: string): SceneElement => {
    const c = series(l, b.series);
    const room = b.w - 8;
    const tallest = Math.min(l.size, Math.floor((b.h - 4) / LINE));
    const text = tallest >= least ? fitText(l, label, room, tallest, least) : undefined;
    const value = thousands(b.value);
    const valueSize = text && Math.max(least, Math.round(text.size * 0.8));
    const lines = text && valueSize ? (text.size + valueSize) * LINE : 0;

    const twoLines =
      text !== undefined &&
      valueSize !== undefined &&
      lines <= b.h - 4 &&
      l.measure(value, valueSize, l.weight) <= room;

    const [cx, cy] = [left + b.x + b.w / 2, top + b.y + b.h / 2];

    return (
      <Group key="leaf">
        <Shape
          key="box"
          geometry={rect(b.w, b.h, { radius: Math.min(4, Math.min(b.w, b.h) / 4) })}
          at={[left + b.x, top + b.y]}
          fill={c}
        />
        {text && (
          <Text
            key="label"
            font={l.font}
            size={text.size}
            weight={l.weight}
            fill={l.colors.background}
            anchor="center"
            at={[cx, twoLines ? cy - lines / 2 + (text.size * LINE) / 2 : cy]}
          >
            {text.text}
          </Text>
        )}
        {twoLines && (
          <Text
            key="value"
            font={l.font}
            size={valueSize}
            weight={l.weight}
            fill={l.colors.background}
            anchor="center"
            at={[cx, cy + lines / 2 - (valueSize * LINE) / 2]}
          >
            {value}
          </Text>
        )}
      </Group>
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={l.size * 1.15}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[total / 2, pad + titleH / 2]}
        >
          {spec.title}
        </Text>
      )}
      {ids.map((id) => {
        const b = boxes.get(id);
        const when = shown.get(id);

        if (!b || b.w <= 0 || b.h <= 0) return <Group key={id} />;
        const label = spec.nodes[id]!.label;

        return (
          <Group key={id} motion={when && (b.leaf ? pop(when) : enter(when))}>
            {b.leaf ? leaf(b, label) : section(b, label)}
          </Group>
        );
      })}
      {between}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(total), Math.ceil(top + height + pad)],
    span: extent([...parts.values()]),
    ...handle,
  };
}
