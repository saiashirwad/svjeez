/** @jsxImportSource svjeez */
import { Center, Group, Shape, Text, linear, path, rect, type SceneElement } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  edgeKey,
  extent,
  fade,
  keyed,
  look,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { sankey as layout } from "./layout/sankey.ts";
import { series } from "./series.ts";

/** Flow from one node to another: `[from, to, value]`. */
export type SankeyLink = readonly [from: string, to: string, value: number];

export interface SankeySpec {
  /** Display names by node id. A node left out is labelled with its id. */
  readonly nodes?: Readonly<Record<string, string>>;
  readonly links: readonly SankeyLink[];
}

export interface SankeyOptions extends DiagramOptions {
  /** Nodes are revealed by id, then links by `"from->to"`: column by column, nodes first and then the links leaving them. */
  readonly reveal?: Reveal<string>;
}

export type Sankey = Diagram<string>;

const WHAT = "sankey()";
const PAD = 8;
const BAR = 12;
const LABEL_GAP = 6;
const MIN_STEP = 170;

const shown = (value: number): string => String(Math.round(value * 100) / 100);

export function sankey(spec: SankeySpec, options: SankeyOptions): Sankey {
  const l = look(options, WHAT);

  if (spec.links.length === 0) throw new SceneError(`${WHAT} needs at least one link, got none.`);
  const ids = [...new Set(spec.links.flatMap(([from, to]) => [from, to]))];
  checkIds(ids, WHAT, "node");

  for (const id of Object.keys(spec.nodes ?? {}))
    if (!ids.includes(id))
      throw new SceneError(
        `${WHAT} labels "${id}", which no link touches.`,
        `Its nodes are ${ids.map((i) => `"${i}"`).join(", ")}.`,
      );

  spec.links.forEach(([from, to, value]) => {
    if (from === to)
      throw new SceneError(
        `${WHAT} link "${from}" flows into itself.`,
        "Link two different nodes.",
      );

    if (!(value > 0 && Number.isFinite(value)))
      throw new SceneError(
        `${WHAT} link "${from}" to "${to}" needs a value above 0, got ${value}.`,
        "A flow has a size: write a positive number.",
      );
  });

  const keys = keyed(spec.links.map(([from, to]) => edgeKey(from, to)));
  const nameOf = (id: string): string => spec.nodes?.[id] ?? id;
  const links = spec.links.map(([from, to, value]) => ({ from, to, value }));
  const gap = Math.ceil(l.size * 1.9);

  const probe = layout({ nodes: ids, links, span: 100, height: 100, nodeWidth: BAR, gap });
  const crowd = new Map<number, number>();

  for (const c of probe.column.values()) crowd.set(c, (crowd.get(c) ?? 0) + 1);
  const height = Math.max(240, Math.round(Math.max(...crowd.values()) * gap * 2.6));

  const labels = new Map(
    ids.map((id) => {
      const name = nameOf(id);
      const value = shown(probe.flow.get(id)!);
      const sp = l.measure(" ", l.size, l.weight);
      const [nw, vw] = [l.measure(name, l.size, l.weight), l.measure(value, l.small, l.weight)];

      return [id, { name, value, nw, vw, sp, w: nw + sp + vw }] as const;
    }),
  );

  const last = probe.columns - 1;

  const widest = (keep: (c: number) => boolean): number =>
    Math.max(0, ...ids.flatMap((id) => (keep(probe.column.get(id)!) ? [labels.get(id)!.w] : [])));

  const step = Math.max(MIN_STEP, widest((c) => c > 0 && c < last) + BAR + 4 * LABEL_GAP);
  const span = step * last;
  const out = layout({ nodes: ids, links, span, height, nodeWidth: BAR, gap });

  const left = PAD + widest((c) => c === 0) + (widest((c) => c === 0) > 0 ? LABEL_GAP : 0);
  const right = PAD + widest((c) => c === last) + LABEL_GAP;
  const [ox, oy] = [left, PAD + l.size / 2];

  const size = [
    Math.ceil(left + span + BAR + right),
    Math.ceil(height + 2 * PAD + l.size),
  ] as const;

  const order = Array.from({ length: probe.columns }, (_, c) => [
    ...ids
      .filter((id) => out.column.get(id) === c)
      .sort((a, b) => out.nodes.get(a)!.y - out.nodes.get(b)!.y),
    ...out.links
      .flatMap((link, k) => (out.column.get(link.from) === c ? [{ link, key: keys[k]! }] : []))
      .sort((a, b) => a.link.y0 - b.link.y0)
      .map(({ key }) => key),
  ]).flat();

  const beats = schedule(options.reveal, order, WHAT);
  const handle = partsOf<string>(WHAT, new Map(order.map((id) => [id, beats.get(id)])));
  const tint = new Map(ids.map((id, i) => [id, series(l, i)] as const));

  const band = (k: number): SceneElement => {
    const link = out.links[k]!;
    const h = Math.max(link.thickness, 1) / 2;
    const [y0, y1] = [link.y0 + oy, link.y1 + oy];
    const [x0, x1] = [link.x0 + ox, link.x1 + ox];
    const mid = (x0 + x1) / 2;

    return (
      <Shape
        key={keys[k]!}
        geometry={path()
          .moveTo([x0, y0 - h])
          .curveTo([mid, y0 - h], [mid, y1 - h], [x1, y1 - h])
          .lineTo([x1, y1 + h])
          .curveTo([mid, y1 + h], [mid, y0 + h], [x0, y0 + h])
          .close()}
        fill={linear({
          from: [x0, 0],
          to: [x1, 0],
          stops: [tint.get(link.from)!, tint.get(link.to)!],
        })}
        opacity={beats.get(keys[k]!) ? fade(beats.get(keys[k]!)!) : 0.5}
      />
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {out.links.map((_, k) => band(k))}
      {between}
      {ids.map((id) => {
        const box = out.nodes.get(id)!;
        const c = out.column.get(id)!;
        const text = labels.get(id)!;
        const at = beats.get(id);
        const [x, y] = [box.x + ox, box.y + oy];
        const middle = y + Math.max(box.h, 1) / 2;
        const before = c === 0;
        const edge = before ? x - LABEL_GAP : x + BAR + LABEL_GAP;
        const anchor = before ? "right" : "left";

        return (
          <Group key={id} motion={at && pop(at)}>
            <Shape
              key="bar"
              geometry={rect(BAR, Math.max(box.h, 1), { radius: 2 })}
              at={[x, y]}
              fill={tint.get(id)!}
            />
            {c > 0 && c < last && (
              <Center
                key="halo"
                at={[edge - 3, middle - Math.round(l.size * 1.4) / 2]}
                width={text.w + 6}
                height={Math.round(l.size * 1.4)}
                radius={3}
                fill={l.colors.background}
                opacity={0.72}
              />
            )}
            <Text
              key="name"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor={anchor}
              at={[before ? edge - text.vw - text.sp : edge, middle]}
            >
              {text.name}
            </Text>
            <Text
              key="value"
              font={l.font}
              size={l.small}
              weight={l.weight}
              fill={l.colors.muted}
              anchor={anchor}
              at={[before ? edge : edge + text.nw + text.sp, middle]}
            >
              {text.value}
            </Text>
          </Group>
        );
      })}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size,
    span: extent(order.map((id) => beats.get(id))),
    ...handle,
  };
}
