/** @jsxImportSource svjeez */
import {
  Center,
  Group,
  Shape,
  Text,
  circle,
  ease,
  line,
  rect,
  span,
  track,
  type SceneElement,
  type Span,
} from "svjeez";
import { SceneError, type Child, type Hex } from "svjeez/tools";
import { sequence as layout, type SequenceRow } from "./layout/sequence.ts";
import type { Box, Size } from "./layout/box.ts";
import {
  Route,
  checkIds,
  Chip,
  Edge,
  checkDraws,
  drawnBy,
  fade,
  Node,
  extent,
  known,
  labelOf,
  labelSize,
  look,
  mix,
  partsOf,
  pop,
  sizeOf,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import type { ArrowHead, Labelled, SequenceBox, SequenceMessage } from "./types.ts";

export interface SequenceOptions extends DiagramOptions {
  /** One span plays the rows one after another; a record times the rows it names, by id ("message-1", "note-2", counted over messages and notes together). */
  readonly reveal?: Reveal<RowId>;
}

export type RowId = `message-${number}` | `note-${number}`;

export interface Sequence<A extends string> extends Diagram<A> {
  message(index: number): {
    readonly span: Span | undefined;
    readonly route: Route;
  };
}

const WHAT = "sequence()";

interface Leaf {
  readonly kind: "message" | "note";
  readonly text: string;
  readonly reply: boolean;
  readonly head: ArrowHead | undefined;
  readonly number: number | undefined;
}

interface Frame {
  readonly keyword: string;
  readonly label: string | undefined;
  readonly sections: readonly (string | undefined)[];
  readonly color: Hex | undefined;
  readonly opacity: number;
}

export function sequence<const A extends Record<string, Labelled>>(
  spec: {
    readonly actors: A;
    readonly messages: readonly SequenceMessage<NoInfer<keyof A & string>>[];
    readonly title?: string;
    readonly boxes?: readonly SequenceBox<NoInfer<keyof A & string>>[];
  },
  options: SequenceOptions,
): Sequence<keyof A & string> {
  type Id = keyof A & string;

  const l = look(options, WHAT);
  const actors = Object.entries<Labelled>(spec.actors).map(([id, s]) => ({ id, ...labelOf(s) }));
  const ids = actors.map((a) => a.id);
  checkIds(ids, WHAT, "actor");

  const stream: SequenceRow[] = [];
  const leaves: Leaf[] = [];
  const frames: Frame[] = [];
  let counting: number | false = false;

  const tag = (text: string): Size => ({
    w: l.measure(text, l.small) + 14,
    h: Math.round(l.small * 1.6),
  });

  const bracket = (text: string | undefined): Size | undefined => {
    if (text === undefined || text === "") return undefined;
    const t = `[${text}]`;

    return { w: l.measure(t, l.small), h: Math.round(l.small * 1.4) };
  };

  const walk = (items: readonly SequenceMessage<string>[]): void => {
    for (const m of items) {
      const where = `message ${leaves.length + 1}`;

      if ("block" in m) {
        const plain = m.block === "rect";

        if (plain && m.color === undefined)
          throw new SceneError(
            `${WHAT} rect needs a color.`,
            'Give the block { block: "rect", color: "#bfdfff" }.',
          );

        frames.push({
          keyword: m.block,
          label: m.label,
          sections: (m.sections ?? []).map((x) => x.label),
          color: m.color,
          opacity: m.opacity ?? 1,
        });
        stream.push({
          kind: "open",
          tab: plain ? undefined : tag(m.block),
          label: plain ? undefined : bracket(m.label),
        });
        walk(m.messages);

        for (const section of m.sections ?? []) {
          stream.push({ kind: "divider", label: bracket(section.label) });
          walk(section.messages);
        }

        stream.push({ kind: "close" });
      } else if ("activate" in m) {
        stream.push({ kind: "activate", actor: known(m.activate, ids, WHAT, "actor", where) });
      } else if ("deactivate" in m) {
        stream.push({ kind: "deactivate", actor: known(m.deactivate, ids, WHAT, "actor", where) });
      } else if ("autonumber" in m) {
        counting = m.autonumber;
      } else if ("note" in m) {
        const [first, second] = [m.note].flat();

        if (second !== undefined && m.side)
          throw new SceneError(
            `${WHAT} note ${leaves.length + 1} has two actors and a side.`,
            "Give a note over two actors no side, or name one actor to put it beside.",
          );

        stream.push({
          kind: "note",
          actor: known(first!, ids, WHAT, "actor", `note ${leaves.length + 1}`),
          to:
            second === undefined
              ? undefined
              : known(second, ids, WHAT, "actor", `note ${leaves.length + 1}`),
          side: m.side,
          size: { w: l.measure(m.text, l.small) + 20, h: Math.round(l.small * 1.4 + 12) },
        });
        leaves.push({
          kind: "note",
          text: m.text,
          reply: false,
          head: undefined,
          number: undefined,
        });
      } else {
        const [from, to, text, extra] = m;

        stream.push({
          kind: "message",
          from: known(from, ids, WHAT, "actor", where),
          to: known(to, ids, WHAT, "actor", where),
          label: labelSize(l, text),
          activate: extra?.activate,
          deactivate: extra?.deactivate,
        });
        leaves.push({
          kind: "message",
          text,
          reply: extra?.reply ?? false,
          head: extra?.head,
          number: counting === false ? undefined : counting,
        });

        if (counting !== false) counting += 1;
      }
    }
  };

  walk(spec.messages);

  for (const box of spec.boxes ?? [])
    for (const id of box.actors) known(id, ids, WHAT, "actor", "box");

  const heading = spec.title ? l.measure(spec.title, l.size * 1.15, l.weight) : undefined;

  const out = layout({
    actors: actors.map((a) => ({ id: a.id, ...sizeOf(l, a.role, a.label) })),
    rows: stream,
    title: heading === undefined ? undefined : { w: heading, h: Math.round(l.size * 1.6) },
    boxes: (spec.boxes ?? []).map((b) => ({ actors: b.actors, label: bracket(b.label) })),
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];
  const move = (b: Box): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  const heads = new Map([...out.heads].map(([id, b]) => [id, move(b)]));

  const placed = out.rows.map((r) => ({
    points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    box: move(r.box),
  }));

  const rowIds = leaves.map((row, i) => `${row.kind}-${i + 1}`);
  const shown = schedule(options.reveal, rowIds, WHAT);
  const beats: readonly (Span | undefined)[] = rowIds.map((id) => shown.get(id));

  const drawOf = (beat: Span) => span(beat.start, Math.min(0.5, beat.over * 0.7));
  const fadeOf = (beat: Span) => span(beat.start, Math.min(0.25, beat.over));
  checkDraws(
    options.draw,
    leaves.flatMap((row, i) => (row.kind === "note" ? [] : [`message-${i + 1}`])),
    WHAT,
  );

  /** A frame or divider shows with the first row after it, a bar with the row that starts it. */
  const next = (count: number): Span | undefined => {
    const beat = beats[Math.min(count, beats.length - 1)];

    return beat && fadeOf(beat);
  };

  const prior = (count: number): Span | undefined => {
    const beat = beats[Math.max(count - 1, 0)];

    return beat && fadeOf(beat);
  };

  /** A bar grows from the row that starts it to the row that ends it. */
  const grow = (from: number, until: number, b: Box) => {
    const [first, last] = [beats[Math.max(from - 1, 0)], beats[Math.max(until - 1, 0)]];

    if (!first || !last) return rect(b.w, b.h);
    const end = drawOf(last);

    return track(rect(b.w, 0)).to(
      rect(b.w, b.h),
      span(first.start, Math.max(end.start + end.over - first.start, 0.05)),
      ease.linear,
    );
  };

  const pad = (b: Box): Box => ({ x: b.x - 3, y: b.y - 1, w: b.w + 6, h: b.h + 2 });

  const noteTint = mix(l.colors.accent, l.colors.background, 0.12);
  const edgeLine = l.colors.muted;
  const widest = Math.max(1, ...leaves.map((x) => x.number ?? 0));
  const badge = Math.max(8, Math.ceil(l.measure(String(widest), l.small) / 2) + 4);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {out.boxes.map((g, i) => {
        const b = move(g.box);
        const given = spec.boxes![i]!;

        return (
          <Group key={`box-${i}`}>
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 6 })}
              at={[b.x, b.y]}
              fill={
                given.color
                  ? mix(given.color, l.colors.background, (given.opacity ?? 1) * 0.12)
                  : mix(l.colors.line, l.colors.background, 0.12)
              }
              stroke={{ color: l.colors.line, width: 1 }}
            />
            {g.label && given.label !== undefined && (
              <Text
                key="label"
                font={l.font}
                size={l.small}
                fill={l.colors.muted}
                anchor="top-left"
                at={[move(g.label).x, move(g.label).y]}
              >
                {`[${given.label}]`}
              </Text>
            )}
          </Group>
        );
      })}
      {frames.map((f, i) => {
        if (f.keyword !== "rect") return undefined;
        const b = move(out.frames[i]!.box);
        const beat = next(out.frames[i]!.at);

        return (
          <Shape
            key={`rect-${i}`}
            geometry={rect(b.w, b.h)}
            at={[b.x, b.y]}
            fill={mix(f.color!, l.colors.background, f.opacity)}
            opacity={beat && fade(beat)}
          />
        );
      })}
      {[...out.lifelines].map(([id, [a, b]]) => (
        <Shape
          key={`${id}:life`}
          geometry={line([a.x + dx, a.y + dy], [b.x + dx, b.y + dy])}
          stroke={{ color: l.colors.line, width: 1, dash: [3, 4] }}
        />
      ))}
      {actors.map((a) => (
        <Node key={a.id} look={l} role={a.role} label={a.label} box={heads.get(a.id)!} />
      ))}
      {heading !== undefined && out.title && (
        <Text
          key="title"
          font={l.font}
          size={l.size * 1.15}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[move(out.title).x + heading / 2, move(out.title).y + out.title.h / 2]}
        >
          {spec.title}
        </Text>
      )}
      {out.bars.map((bar, i) => {
        const b = move(bar.box);
        const beat = prior(bar.at);

        return (
          <Shape
            key={`bar-${i}`}
            geometry={grow(bar.at, bar.until, b)}
            at={[b.x, b.y]}
            fill={mix(l.colors.accent, l.colors.background, 0.25)}
            stroke={{ color: l.colors.accent, width: 1 }}
            opacity={beat && fade(beat)}
          />
        );
      })}
      {frames.map((f, i) => {
        if (f.keyword === "rect") return undefined;
        const g = out.frames[i]!;
        const b = move(g.box);
        const beat = next(g.at);

        return (
          <Group key={`frame-${i}`} opacity={beat && fade(beat)}>
            <Shape
              key="frame"
              geometry={rect(b.w, b.h, { radius: 3 })}
              at={[b.x, b.y]}
              stroke={{ color: edgeLine, width: 1 }}
            />
            {g.tab && (
              <Center
                key="tab"
                at={[move(g.tab).x, move(g.tab).y]}
                width={g.tab.w}
                height={g.tab.h}
                radius={3}
                fill={noteTint}
                stroke={{ color: edgeLine, width: 1 }}
              >
                <Text font={l.font} size={l.small} weight={l.weight} fill={l.colors.text}>
                  {f.keyword}
                </Text>
              </Center>
            )}
            {g.label && f.label !== undefined && (
              <Chip key="label" look={l} box={pad(move(g.label))} text={`[${f.label}]`} />
            )}
            {g.dividers.map((d, k) => {
              const text = f.sections[k];
              const mark = next(d.at);

              return (
                <Group key={`divider-${k}`} opacity={mark && fade(mark)}>
                  <Shape
                    key="rule"
                    geometry={line([b.x, d.y + dy], [b.x + b.w, d.y + dy])}
                    stroke={{ color: edgeLine, width: 1, dash: [5, 4] }}
                  />
                  {d.label && text !== undefined && (
                    <Chip key="label" look={l} box={pad(move(d.label))} text={`[${text}]`} />
                  )}
                </Group>
              );
            })}
          </Group>
        );
      })}
      {between}
      {leaves.map((row, i) => {
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
            <Edge
              key="arrow"
              look={l}
              points={points}
              head={row.head ?? "filled"}
              stroke={row.reply ? { dash: [5, 4] } : undefined}
              draw={drawnBy(options.draw, `message-${i + 1}`, beat && drawOf(beat), WHAT)}
            />
            <Chip
              key="label"
              look={l}
              box={box}
              text={row.text}
              fill={l.colors.text}
              motion={beat && pop(fadeOf(beat))}
            />
            {row.number !== undefined && (
              <Group
                key="number"
                offset={[points[0]!.x, points[0]!.y]}
                motion={beat && pop(fadeOf(beat))}
              >
                <Shape key="dot" geometry={circle(badge)} fill={l.colors.text} />
                <Text
                  key="n"
                  font={l.font}
                  size={l.small}
                  fill={l.colors.background}
                  anchor="center"
                  at={[0, 0]}
                >
                  {String(row.number)}
                </Text>
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );

  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, undefined]));
  const handle = partsOf<Id>(WHAT, parts);

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: extent(beats.map((b, i) => b && (leaves[i]!.kind === "note" ? fadeOf(b) : drawOf(b)))),
    ...handle,
    message: (index) => {
      const row = placed[index];

      if (!Number.isInteger(index) || !row)
        throw new SceneError(
          `${WHAT} has no message ${index}.`,
          `Count from 0: it has ${leaves.length}.`,
        );

      return { span: beats[index], route: new Route([row.points]) };
    },
  };
}
