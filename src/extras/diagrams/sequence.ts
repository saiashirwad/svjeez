import { el } from "../../el";
import type { Point } from "../../geometry";
import { sequence as layout } from "../../layout/sequence";
import { motion, type Seconds, type Span } from "../../motion";
import { defaultDark } from "../theme";
import { arrow, chip, labelOf, labelSize, lookup, placer, shape, sizeOf, textWidth, type Diagram, type DiagramOptions, type Labelled } from "./kit";

/** `[from, to, label]`, dashed with `{ reply: true }`; a message to its own sender loops on the right. */
export type SequenceMessage<A extends string> =
  | readonly [from: A, to: A, label: string]
  | readonly [from: A, to: A, label: string, options: { readonly reply?: boolean }]
  | { readonly note: A; readonly text: string };

export interface SequenceOptions extends DiagramOptions {
  /** Each message draws on in order, `step` apart, its label fading in; lifelines are there from the start. */
  readonly play?: { readonly at: Seconds; readonly step?: Seconds };
}

export interface Sequence<A extends string> extends Diagram<A> {
  /** Message or note `i` in the order given: its slot on the `play` timeline (from 0 without `play`), and its arrow or, for a note, its center. */
  message(i: number): { readonly span: Span; readonly points: Point[] };
}

export function sequence<const A extends Record<string, Labelled>>(
  spec: { readonly actors: A; readonly messages: readonly SequenceMessage<NoInfer<keyof A & string>>[] },
  options: SequenceOptions = {},
): Sequence<keyof A & string> {
  const { theme = defaultDark, fontSize = 14, class: cls, play } = options;
  const look = { theme, fontSize };
  const small = fontSize * 0.85;
  const actors = Object.entries(spec.actors as Record<string, Labelled>).map(([id, s]) => ({ id, ...labelOf(s) }));
  const rows = spec.messages.map((m) =>
    "note" in m
      ? { kind: "note" as const, actor: m.note, text: m.text, size: { w: textWidth(m.text, small) + 20, h: small * 1.4 + 12 } }
      : { kind: "message" as const, from: m[0], to: m[1], text: m[2], reply: m[3]?.reply ?? false, label: labelSize(m[2], small) },
  );
  const out = layout({ actors: actors.map((a) => ({ id: a.id, ...sizeOf(a.role, a.label, fontSize) })), rows });
  const at = placer(out.bounds, options.x, options.y);
  const heads = new Map([...out.heads].map(([id, b]) => [id, at.box(b)]));
  const placed = out.rows.map((r) => ({ points: r.points.map(at.point), box: at.box(r.box) }));
  const step = play?.step ?? 0.8;
  const span = (i: number): Span => ({ at: (play?.at ?? 0) + i * step, over: step });
  const fade = (i: number) => play && motion({ opacity: 0 }).at(span(i).at).to({ opacity: 1 }, 0.25);

  const node = el.g({ class: cls }, [
    [...out.lifelines].map(([, [a, b]]) => {
      const [p, q] = [at.point(a), at.point(b)];
      return el.path({ d: `M${p.x} ${p.y}V${q.y}`, stroke: theme.base03, strokeDasharray: "3 4", fill: "none" });
    }),
    actors.map((a) => shape(a.role, heads.get(a.id)!, a.label, look)),
    rows.map((row, i) => {
      const { points, box } = placed[i]!;
      if (row.kind === "note") {
        return el.g({ animation: fade(i) }, [
          el.rect({ x: box.x, y: box.y, width: box.w, height: box.h, rx: 4, fill: theme.base00 }),
          el.rect({ x: box.x, y: box.y, width: box.w, height: box.h, rx: 4, fill: theme.base0A, fillOpacity: 0.12, stroke: theme.base0A, strokeOpacity: 0.7 }),
          el.text({ x: box.center.x, y: box.center.y + small * 0.35, fontSize: small, textAnchor: "middle", fill: theme.base05 }, row.text),
        ]);
      }
      return el.g({}, [
        arrow(points, { ...look, dashed: row.reply, at: play && span(i).at, over: Math.min(0.5, step * 0.7) }),
        chip(box, row.text, { theme, fontSize: small, fill: theme.base05 }, fade(i)),
      ]);
    }),
  ]);
  return {
    node,
    bounds: at.bounds,
    get: lookup("sequence()", heads),
    message: (i) => {
      const row = placed[i];
      if (!row) throw new Error(`sequence() has no message ${i}.`);
      return { span: span(i), points: [...row.points] };
    },
  };
}
