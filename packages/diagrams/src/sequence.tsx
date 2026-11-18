import { Center, Group, Shape, Text, line, span, type SceneElement, type Span } from "svjeez";
import { SceneError, type Child, type Spanned } from "svjeez/tools";
import { sequence as layout } from "./layout/sequence.ts";
import type { Box } from "./layout/box.ts";
import {
  Route,
  beatOf,
  checkIds,
  drawChip,
  drawEdge,
  drawNode,
  extent,
  known,
  labelOf,
  labelSize,
  look,
  mix,
  partsOf,
  pop,
  sizeOf,
  spanOf,
  type Diagram,
  type DiagramOptions,
} from "./kit.tsx";
import type { Labelled, SequenceMessage } from "./types.ts";

export interface SequenceOptions extends DiagramOptions {
  readonly reveal?: Span | readonly Span[];
}

export interface Sequence<A extends string> extends Diagram<A> {
  message(index: number): { readonly span: Spanned | undefined; readonly route: Route };
}

const WHAT = "sequence()";

const isList = (reveal: Span | readonly Span[] | undefined): reveal is readonly Span[] =>
  Array.isArray(reveal);

export function sequence<const A extends Record<string, Labelled>>(
  spec: {
    readonly actors: A;
    readonly messages: readonly SequenceMessage<NoInfer<keyof A & string>>[];
  },
  options: SequenceOptions,
): Sequence<keyof A & string> {
  type Id = keyof A & string;

  const l = look(options, WHAT);
  const actors = Object.entries<Labelled>(spec.actors).map(([id, s]) => ({ id, ...labelOf(s) }));
  const ids = actors.map((a) => a.id);
  checkIds(ids, WHAT, "actor");

  const rows = spec.messages.map((m: SequenceMessage<string>, i) =>
    "note" in m
      ? {
          kind: "note" as const,
          actor: known(m.note, ids, WHAT, "actor", `note ${i + 1}`),
          text: m.text,
          size: { w: l.measure(m.text, l.small) + 20, h: Math.round(l.small * 1.4 + 12) },
        }
      : {
          kind: "message" as const,
          from: known(m[0], ids, WHAT, "actor", `message ${i + 1}`),
          to: known(m[1], ids, WHAT, "actor", `message ${i + 1}`),
          text: m[2],
          reply: m[3]?.reply ?? false,
          head: m[3]?.head,
          label: labelSize(l, m[2]),
        },
  );

  const out = layout({
    actors: actors.map((a) => ({ id: a.id, ...sizeOf(l, a.role, a.label) })),
    rows,
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const heads = new Map([...out.heads].map(([id, b]) => [id, move(b)]));

  const placed = out.rows.map((r) => ({
    points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    box: move(r.box),
  }));

  const { reveal } = options;

  if (isList(reveal) && reveal.length !== rows.length)
    throw new SceneError(
      `${WHAT} reveal has ${reveal.length} spans for ${rows.length} messages and notes.`,
      "Give one span per message or note, or one span for them all to follow each other.",
    );

  const beat =
    reveal === undefined || isList(reveal) ? undefined : spanOf(reveal, `${WHAT} reveal`);

  const beats: readonly (Spanned | undefined)[] = rows.map((_, i) =>
    isList(reveal)
      ? spanOf(reveal[i], `${WHAT} reveal for message ${i + 1}`)
      : beat && beatOf(beat, i),
  );

  const drawOf = (beat: Span) => span(beat.start, Math.min(0.5, beat.over * 0.7));
  const fadeOf = (beat: Span) => span(beat.start, Math.min(0.25, beat.over));
  const noteTint = mix(l.colors.accent, l.colors.background, 0.12);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {[...out.lifelines].map(([id, [a, b]]) => (
        <Shape
          key={`${id}:life`}
          geometry={line([a.x + dx, a.y + dy], [b.x + dx, b.y + dy])}
          stroke={{ color: l.colors.line, width: 1, dash: [3, 4] }}
        />
      ))}
      {actors.map((a) =>
        drawNode(l, { key: a.id, role: a.role, label: a.label, box: heads.get(a.id)! }),
      )}
      {between}
      {rows.map((row, i) => {
        const { points, box } = placed[i]!;
        const beat = beats[i];

        if (row.kind === "note")
          return (
            <Center
              key={`note-${i + 1}`}
              at={[box.x, box.y]}
              width={box.w}
              height={box.h}
              radius={4}
              fill={noteTint}
              stroke={{ color: l.colors.accent, width: 1 }}
              motion={beat && pop(fadeOf(beat))}
            >
              <Text font={l.font} size={l.small} fill={l.colors.text}>
                {row.text}
              </Text>
            </Center>
          );

        return (
          <Group key={`message-${i + 1}`}>
            {drawEdge(l, {
              key: "arrow",
              points,
              head: row.head ?? "filled",
              ...(row.reply && { dash: [5, 4] }),
              drawn: beat && drawOf(beat),
            })}
            {drawChip(l, {
              key: "label",
              box,
              text: row.text,
              fill: l.colors.text,
              motion: beat && pop(fadeOf(beat)),
            })}
          </Group>
        );
      })}
    </Group>
  );

  const parts = new Map<string, Spanned | undefined>(ids.map((id) => [id, undefined]));
  const handle = partsOf<Id>(WHAT, options.name ?? "sequence", parts);

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: extent(beats.map((b, i) => b && (rows[i]!.kind === "note" ? fadeOf(b) : drawOf(b)))),
    ...handle,
    message: (index) => {
      const row = placed[index];

      if (!Number.isInteger(index) || !row)
        throw new SceneError(
          `${WHAT} has no message ${index}.`,
          `Count from 0: it has ${rows.length}.`,
        );

      return { span: beats[index], route: new Route([row.points]) };
    },
  };
}
