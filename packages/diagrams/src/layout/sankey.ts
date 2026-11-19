import { SceneError } from "svjeez/tools";
import type { Box } from "./box.ts";

export interface SankeyInput {
  readonly nodes: readonly string[];
  readonly links: readonly { readonly from: string; readonly to: string; readonly value: number }[];
  /** Distance from the left edge of the first column to the left edge of the last. */
  readonly span: number;
  readonly height: number;
  readonly nodeWidth: number;
  readonly gap: number;
}

export interface SankeyLayout {
  readonly nodes: ReadonlyMap<string, Box>;
  readonly column: ReadonlyMap<string, number>;
  /** The flow through each node. */
  readonly flow: ReadonlyMap<string, number>;
  readonly columns: number;
  /** In input order. `y0` and `y1` are the centers of the band at its source and at its target. */
  readonly links: readonly {
    readonly from: string;
    readonly to: string;
    readonly thickness: number;
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  }[];
  readonly bounds: Box;
}

const PASSES = 6;

/** Columns by longest path, node heights by flow, then a few passes that pull each node level with its bands. */
export function sankey(input: SankeyInput): SankeyLayout {
  const { height, nodeWidth, gap } = input;
  const n = input.nodes.length;
  const index = new Map(input.nodes.map((id, i) => [id, i]));

  if (index.size !== n) throw new SceneError("sankey() node ids must be unique.");

  const links = input.links.map((link) => {
    const [from, to] = [index.get(link.from), index.get(link.to)];

    if (from === undefined || to === undefined)
      throw new SceneError(
        `sankey() link ${JSON.stringify(link.from)} to ${JSON.stringify(link.to)} names an unknown node.`,
      );

    if (!(link.value > 0 && Number.isFinite(link.value)))
      throw new SceneError(`sankey() link values must be above 0, got ${link.value}.`);

    return { from, to, value: link.value, thickness: 0, y0: 0, y1: 0 };
  });

  const out = input.nodes.map((): number[] => []);
  const into = input.nodes.map((): number[] => []);
  links.forEach((link, k) => {
    out[link.from]!.push(k);
    into[link.to]!.push(k);
  });

  const depth = Array.from({ length: n }, () => 0);
  const pending = into.map((list) => list.length);
  const order = [...pending.keys()].filter((i) => pending[i] === 0);

  for (let q = 0; q < order.length; q++) {
    const i = order[q]!;

    for (const k of out[i]!) {
      const t = links[k]!.to;
      depth[t] = Math.max(depth[t]!, depth[i]! + 1);

      if (--pending[t]! === 0) order.push(t);
    }
  }

  if (order.length < n) {
    const stuck = pending.findIndex((p) => p > 0);

    throw new SceneError(
      `sankey() links form a loop through ${JSON.stringify(input.nodes[stuck])}.`,
      "Sankey flows run one way: remove the link that leads back.",
    );
  }

  const columns = Math.max(...depth) + 1;
  const column = depth.map((d, i) => (out[i]!.length > 0 ? d : columns - 1));
  const members = Array.from({ length: columns }, (): number[] => []);
  column.forEach((c, i) => members[c]!.push(i));

  const flow = input.nodes.map((_, i) =>
    Math.max(
      into[i]!.reduce((sum, k) => sum + links[k]!.value, 0),
      out[i]!.reduce((sum, k) => sum + links[k]!.value, 0),
    ),
  );

  const crowded = Math.max(...members.map((m) => m.length));
  const room = crowded > 1 ? Math.min(gap, height / (crowded * 2)) : gap;

  const scale = Math.min(
    ...members.map((m) => (height - (m.length - 1) * room) / m.reduce((s, i) => s + flow[i]!, 0)),
  );

  for (const link of links) link.thickness = link.value * scale;
  const top = input.nodes.map(() => 0);
  const size = flow.map((f) => f * scale);
  const step = columns > 1 ? input.span / (columns - 1) : 0;

  for (const m of members) {
    const spare = height - m.reduce((s, i) => s + size[i]!, 0) - (m.length - 1) * room;
    let y = spare / 2;

    for (const i of m) {
      top[i] = y;
      y += size[i]! + room;
    }
  }

  const center = (i: number): number => top[i]! + size[i]! / 2;
  const [offsetOut, offsetIn] = [links.map(() => 0), links.map(() => 0)];

  const stack = (list: number[], offsets: number[], far: (k: number) => number): void => {
    list.sort((a, b) => center(far(a)) - center(far(b)) || a - b);
    let y = 0;

    for (const k of list) {
      offsets[k] = y + links[k]!.thickness / 2;
      y += links[k]!.thickness;
    }
  };

  const stackAll = (): void => {
    for (let i = 0; i < n; i++) {
      stack(out[i]!, offsetOut, (k) => links[k]!.to);
      stack(into[i]!, offsetIn, (k) => links[k]!.from);
    }
  };

  const settle = (m: number[], pull: number, forward: boolean): void => {
    for (const i of m) {
      const list = forward ? into[i]! : out[i]!;

      if (list.length === 0) continue;
      let [weighted, weight] = [0, 0];

      for (const k of list) {
        const link = links[k]!;

        const level = forward
          ? top[link.from]! + offsetOut[k]! - offsetIn[k]!
          : top[link.to]! + offsetIn[k]! - offsetOut[k]!;

        weighted += level * link.thickness;
        weight += link.thickness;
      }

      top[i] = top[i]! + (weighted / weight - top[i]!) * pull;
    }

    m.sort((a, b) => center(a) - center(b) || a - b);
    let y = 0;

    for (const i of m) {
      top[i] = Math.max(top[i]!, y);
      y = top[i]! + size[i]! + room;
    }

    y = height;

    for (const i of [...m].reverse()) {
      top[i] = Math.min(top[i]!, y - size[i]!);
      y = top[i]! - room;
    }
  };

  stackAll();

  for (let pass = 0; pass < PASSES; pass++) {
    const pull = 0.99 ** pass;

    for (let c = columns - 2; c >= 0; c--) settle(members[c]!, pull, false);
    stackAll();

    for (let c = 1; c < columns; c++) settle(members[c]!, pull, true);
    stackAll();
  }

  const x = (i: number): number => column[i]! * step;

  return {
    nodes: new Map(
      input.nodes.map((id, i) => [id, { x: x(i), y: top[i]!, w: nodeWidth, h: size[i]! }]),
    ),
    column: new Map(input.nodes.map((id, i) => [id, column[i]!])),
    flow: new Map(input.nodes.map((id, i) => [id, flow[i]!])),
    columns,
    links: links.map((link, k) => ({
      from: input.nodes[link.from]!,
      to: input.nodes[link.to]!,
      thickness: link.thickness,
      x0: x(link.from) + nodeWidth,
      y0: top[link.from]! + offsetOut[k]!,
      x1: x(link.to),
      y1: top[link.to]! + offsetIn[k]!,
    })),
    bounds: { x: 0, y: 0, w: input.span + nodeWidth, h: height },
  };
}
