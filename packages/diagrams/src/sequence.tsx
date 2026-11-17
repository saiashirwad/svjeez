/** @jsxImportSource svjeez */
import {
  textWidth,
  type Point,
  motion,
  type Seconds,
  type Span,
  type Spanned,
  type Beats,
} from "svjeez";
import { sequence as layout } from "./layout/sequence.ts";
import {
  arrow,
  chip,
  drawNode,
  labelOf,
  labelSize,
  look,
  partsOf,
  placer,
  sizeOf,
  slots,
  spanOfReveals,
  type DiagramOptions,
  type Diagram,
  type Labelled,
} from "./kit.tsx";

/** `[from, to, label]`, dashed with `{ reply: true }`; a message to its own sender loops on the right. */
export type SequenceMessage<A extends string> =
  | readonly [from: A, to: A, label: string]
  | readonly [from: A, to: A, label: string, options: { readonly reply?: boolean }]
  | { readonly note: A; readonly text: string };

export interface SequenceOptions extends DiagramOptions {
  /**
   * Each message or note draws on in order; lifelines are there from the start. From a start `at` they follow `step`
   * apart (default 0.8), or each at its own time.
   */
  readonly play?: { readonly at: Beats; readonly step?: Seconds };
}

export interface Sequence<A extends string> extends Diagram<A> {
  /** Message or note `i` in the order given: its slot on the `play` timeline (from 0 without `play`), and its arrow or, for a note, its center. */
  message(i: number): { readonly span: Span; readonly points: Point[] };
}

export function sequence<const A extends Record<string, Labelled>>(
  spec: {
    readonly actors: A;
    readonly messages: readonly SequenceMessage<NoInfer<keyof A & string>>[];
  },
  options: SequenceOptions = {},
): Sequence<keyof A & string> {
  const { play } = options;
  const l = look(options);
  const { theme, fontSize, font, small } = l;

  const actors = Object.entries(spec.actors).map(([id, s]) => ({
    id,
    ...labelOf(s),
  }));

  const rows = spec.messages.map((m) =>
    "note" in m
      ? {
          kind: "note" as const,
          actor: m.note,
          text: m.text,
          size: { w: textWidth(m.text, small, font) + 20, h: small * 1.4 + 12 },
        }
      : {
          kind: "message" as const,
          from: m[0],
          to: m[1],
          text: m[2],
          reply: m[3]?.reply ?? false,
          label: labelSize(m[2], small, font),
        },
  );

  const out = layout({
    actors: actors.map((a) => ({ id: a.id, ...sizeOf(a.role, a.label, fontSize, font) })),
    rows,
  });

  const at = placer(out.bounds, options);
  const heads = new Map([...out.heads].map(([id, b]) => [id, at.box(b)]));
  const placed = out.rows.map((r) => ({ points: r.points.map(at.point), box: at.box(r.box) }));
  const step = play?.step ?? 0.8;
  const slotted = slots(play?.at ?? 0, rows.length, step, "sequence() play");

  const span = (i: number): Spanned => slotted[i]!;

  const FADE = 0.25;

  const fade = (i: number) =>
    play && motion({ opacity: 0 }).to({ opacity: 1 }, span(i).first(FADE));

  const drawOver = (i: number) => Math.min(0.5, span(i).over * 0.7) || 0.3;

  const node = l.root([
    [...out.lifelines].map(([, [a, b]]) => {
      const [p, q] = [at.point(a), at.point(b)];

      return (
        <path d={`M${p.x} ${p.y}V${q.y}`} stroke={theme.base03} strokeDasharray="3 4" fill="none" />
      );
    }),
    actors.map((a) => drawNode(a.role, heads.get(a.id)!, a.label, l)),
    rows.map((row, i) => {
      const { points, box } = placed[i]!;

      if (row.kind === "note") {
        return (
          <g animation={fade(i)}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={theme.base00} />
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              rx={4}
              fill={theme.base0A}
              fillOpacity={0.12}
              stroke={theme.base0A}
              strokeOpacity={0.7}
            />
            <text
              x={box.center.x}
              y={box.center.y + small * 0.35}
              fontSize={small}
              textAnchor="middle"
              fill={theme.base05}
            >
              {row.text}
            </text>
          </g>
        );
      }

      return (
        <g>
          {arrow(points, {
            ...l,
            dashed: row.reply,
            at: play && span(i).at,
            over: drawOver(i),
          })}
          {chip(box, row.text, { ...l.smallLook, fill: theme.base05 }, fade(i))}
        </g>
      );
    }),
  ]);

  const reveals: Span[] = play
    ? rows.map((row, i) => ({
        at: span(i).at,
        over: row.kind === "note" ? FADE : Math.max(FADE, drawOver(i)),
      }))
    : [];

  return {
    node,
    span: spanOfReveals(reveals),
    bounds: at.bounds,
    ...partsOf<keyof A & string>("sequence()", heads),
    message: (i) => {
      const row = placed[i];

      if (!row) throw new Error(`sequence() has no message ${i}.`);

      return { span: span(i), points: [...row.points] };
    },
  };
}
