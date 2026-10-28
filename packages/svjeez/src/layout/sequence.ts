import { indexing, union, type Box, type Point, type Size } from "./box";

type SequenceRow =
  | { readonly kind: "message"; readonly from: string; readonly to: string; readonly label: Size }
  | { readonly kind: "note"; readonly actor: string; readonly size: Size };

interface SequenceInput {
  readonly actors: readonly ({ readonly id: string } & Size)[];
  readonly rows: readonly SequenceRow[];
  /** Least space between neighbouring heads. */
  readonly actorGap?: number;
  readonly rowGap?: number;
}

export interface SequenceLayout {
  readonly heads: ReadonlyMap<string, Box>;
  readonly lifelines: ReadonlyMap<string, readonly [Point, Point]>;
  /** Per row: a message's arrow from lifeline to lifeline (a self message loops right), or a note's center. */
  readonly rows: readonly { readonly points: readonly Point[]; readonly box: Box }[];
  readonly bounds: Box;
}

const LOOP = { w: 28, h: 18 };
const PAD = 16;

/** Heads in a row, spaced so every label fits between the lifelines it spans; one row per message or note, top to bottom. */
export function sequence(input: SequenceInput): SequenceLayout {
  const { actorGap = 32, rowGap = 14, actors } = input;

  const { unique, at } = indexing(
    actors.map((a) => a.id),
    (id) => `sequence() has no actor ${JSON.stringify(id)}.`,
  );

  if (!unique || actors.length === 0) throw new Error("sequence() needs actors with unique ids.");
  const gaps = actors.slice(1).map((a, i) => actors[i]!.w / 2 + a.w / 2 + actorGap);

  const need = (from: number, to: number, length: number) => {
    const have = gaps.slice(from, to).reduce((a, b) => a + b, 0);

    if (have < length) for (let k = from; k < to; k++) gaps[k]! += (length - have) / (to - from);
  };

  const demands = input.rows.flatMap((row): { from: number; to: number; length: number }[] => {
    if (row.kind === "note") {
      const i = at(row.actor);

      return [
        { from: i - 1, to: i, length: row.size.w / 2 + PAD },
        { from: i, to: i + 1, length: row.size.w / 2 + PAD },
      ];
    }

    const [a, b] = [at(row.from), at(row.to)];

    if (a === b) return [{ from: a, to: a + 1, length: LOOP.w + 8 + row.label.w + PAD }];

    return [{ from: Math.min(a, b), to: Math.max(a, b), length: row.label.w + 2 * PAD }];
  });

  for (const { from, to, length } of demands.sort((p, q) => p.to - p.from - (q.to - q.from)))
    if (from >= 0 && to <= gaps.length) need(from, to, length);

  const centers = actors.map(
    (_, i) => actors[0]!.w / 2 + gaps.slice(0, i).reduce((s, g) => s + g, 0),
  );

  const tall = Math.max(...actors.map((a) => a.h));

  const heads = new Map(
    actors.map((a, i) => [a.id, { x: centers[i]! - a.w / 2, y: (tall - a.h) / 2, w: a.w, h: a.h }]),
  );

  let cursor = tall + 24;

  const rows = input.rows.map((row) => {
    if (row.kind === "note") {
      const x = centers[at(row.actor)]!;
      const box = { x: x - row.size.w / 2, y: cursor, ...row.size };
      cursor += row.size.h + rowGap;

      return { points: [{ x, y: box.y + box.h / 2 }], box };
    }

    const [a, b] = [centers[at(row.from)]!, centers[at(row.to)]!];

    if (a === b) {
      const y = cursor + 4;
      cursor = y + LOOP.h + rowGap;

      return {
        points: [
          { x: a, y },
          { x: a + LOOP.w, y },
          { x: a + LOOP.w, y: y + LOOP.h },
          { x: a, y: y + LOOP.h },
        ],
        box: { x: a + LOOP.w + 8, y: y + LOOP.h / 2 - row.label.h / 2, ...row.label },
      };
    }

    const y = cursor + row.label.h + 4;
    cursor = y + rowGap;

    return {
      points: [
        { x: a, y },
        { x: b, y },
      ],
      box: { x: (a + b) / 2 - row.label.w / 2, y: cursor - rowGap - 4 - row.label.h, ...row.label },
    };
  });

  const bottom = cursor + 8;

  const lifelines = new Map(
    actors.map((a, i) => [
      a.id,
      [
        { x: centers[i]!, y: heads.get(a.id)!.y + a.h },
        { x: centers[i]!, y: bottom },
      ] as const,
    ]),
  );

  return {
    heads,
    lifelines,
    rows,
    bounds: union([
      ...heads.values(),
      ...rows.map((r) => r.box),
      { x: 0, y: 0, w: 0, h: bottom },
      ...rows.flatMap((r) => r.points.map((p) => ({ ...p, w: 0, h: 0 }))),
    ]),
  };
}
