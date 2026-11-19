/** @jsxImportSource svjeez */
import { Group, Shape, Text, rect, type SceneElement } from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
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
  type Reveal,
} from "./kit.tsx";
import { wrap } from "./wrap.ts";

export type KanbanPriority = "very high" | "high" | "medium" | "low" | "very low";

export interface KanbanCard<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly ticket?: string;
  readonly assigned?: string;
  /** A "medium" card gets no mark. */
  readonly priority?: KanbanPriority;
}

export interface KanbanColumn<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly cards?: readonly KanbanCard[];
}

export interface KanbanOptions<N extends string = string> extends DiagramOptions {
  /** Width of a column. Default 220. */
  readonly columnWidth?: number;
  readonly reveal?: Reveal<N>;
}

type Ids<C extends readonly KanbanColumn[]> =
  | C[number]["id"]
  | NonNullable<C[number]["cards"]>[number]["id"];

export type Kanban<N extends string> = Diagram<N>;

const WHAT = "kanban()";

const PRIORITIES: readonly KanbanPriority[] = ["very high", "high", "medium", "low", "very low"];
const GAP = 12;
const COLUMN_PAD = 8;
const CARD_PAD = 10;
const CARD_GAP = 8;
const MARK = 3;

const round = (value: number): number => Math.round(value * 100) / 100;

interface Card {
  readonly card: KanbanCard;
  readonly lines: readonly string[];
  readonly stacked: boolean;
  readonly h: number;
  y: number;
}

interface Column {
  readonly column: KanbanColumn;
  readonly cards: readonly Card[];
  readonly title: readonly string[];
  readonly h: number;
}

export function kanban<const C extends readonly KanbanColumn[]>(
  spec: { readonly columns: C },
  options: KanbanOptions<NoInfer<Ids<C>>>,
): Kanban<Ids<C>> {
  const l = look(options, WHAT);
  const { columnWidth = 220 } = options;

  if (!(columnWidth >= 120 && Number.isFinite(columnWidth)))
    throw new SceneError(`${WHAT} needs a columnWidth of at least 120, got ${columnWidth}.`);

  const all = spec.columns.flatMap((c) => [c.id, ...(c.cards ?? []).map((k) => k.id)]);
  checkIds(all, WHAT, "column or card");
  const duplicate = all.find((id, i) => all.indexOf(id) !== i);

  if (duplicate !== undefined)
    throw new SceneError(
      `${WHAT} has more than one column or card named "${duplicate}".`,
      "Give each column and card its own id.",
    );

  const textWidth = columnWidth - 2 * COLUMN_PAD - 2 * CARD_PAD;
  const line = Math.ceil(l.size * 1.5);
  const small = Math.ceil(l.small * 1.5);

  const cardOf = (card: KanbanCard, where: string): Card => {
    if (card.priority !== undefined && !PRIORITIES.includes(card.priority))
      throw new SceneError(
        `${WHAT} ${where} has the priority "${String(card.priority)}".`,
        `A priority is one of ${PRIORITIES.map((p) => `"${p}"`).join(", ")}.`,
      );

    const lines = wrap(l, card.label, l.size, textWidth);

    const meta = [card.ticket, card.assigned].filter((t): t is string => t !== undefined);

    const stacked =
      meta.length === 2 &&
      l.measure(meta[0]!, l.small, l.weight) + l.measure(meta[1]!, l.small, l.weight) + 8 >
        textWidth;

    const rows = meta.length === 0 ? 0 : stacked ? 2 : 1;

    return {
      card,
      lines,
      stacked,
      h: 2 * CARD_PAD + Math.max(1, lines.length) * line + (rows > 0 ? 4 + rows * small : 0),
      y: 0,
    };
  };

  const titles = spec.columns.map((c) =>
    wrap(l, c.label, l.size, columnWidth - 2 * COLUMN_PAD - 40),
  );

  const head = Math.max(1, ...titles.map((t) => t.length)) * line + 2 * COLUMN_PAD;

  const columns = spec.columns.map((c, i): Column => {
    const cards = (c.cards ?? []).map((k) => cardOf(k, `card "${k.id}"`));
    let y = head;

    for (const k of cards) {
      k.y = y;
      y += k.h + CARD_GAP;
    }

    return {
      column: c,
      cards,
      title: titles[i]!,
      h: y + (cards.length === 0 ? COLUMN_PAD : COLUMN_PAD - CARD_GAP),
    };
  });

  const tall = Math.max(...columns.map((c) => c.h));
  const width = columns.length * columnWidth + (columns.length - 1) * GAP;

  const order = columns.flatMap((c) => [c.column.id, ...c.cards.map((k) => k.card.id)]);
  const shown = schedule(options.reveal, order, WHAT);
  const handle = partsOf<Ids<C>>(WHAT, shown);

  const tint = (p: KanbanPriority | undefined): Color | undefined => {
    switch (p) {
      case "very high":
        return l.colors.highlight;
      case "high":
        return mix(l.colors.highlight, l.colors.background, 0.55);
      case "low":
        return mix(l.colors.muted, l.colors.background, 0.55);
      case "very low":
        return l.colors.muted;
      default:
        return undefined;
    }
  };

  const ground = mix(l.colors.muted, l.colors.background, 0.14);

  const drawCard = (k: Card, w: number): SceneElement => {
    const at = shown.get(k.card.id);
    const color = tint(k.card.priority);
    const bottom = k.h - CARD_PAD - small / 2;

    return (
      <Group key={k.card.id} offset={[COLUMN_PAD, round(k.y)]} motion={at && pop(at)}>
        <Shape
          key="card"
          geometry={rect(w, k.h, { radius: 6 })}
          fill={l.colors.background}
          stroke={{ color: l.colors.line, width: 1 }}
        />
        {color !== undefined && (
          <Shape
            key="priority"
            geometry={rect(MARK, k.h - 12, { radius: MARK / 2 })}
            at={[2, 6]}
            fill={color}
          />
        )}
        {k.lines.map((text, j) => (
          <Text
            key={`text:${j}`}
            font={l.font}
            size={l.size}
            weight={l.weight}
            fill={l.colors.text}
            anchor="left"
            at={[CARD_PAD, round(CARD_PAD + (j + 0.5) * line)]}
          >
            {text}
          </Text>
        ))}
        {k.card.ticket !== undefined && (
          <Text
            key="ticket"
            font={l.font}
            size={l.small}
            weight={l.weight}
            fill={l.colors.muted}
            anchor="left"
            at={[CARD_PAD, round(k.stacked ? bottom - small : bottom)]}
          >
            {k.card.ticket}
          </Text>
        )}
        {k.card.assigned !== undefined && (
          <Text
            key="assigned"
            font={l.font}
            size={l.small}
            weight={l.weight}
            fill={l.colors.muted}
            anchor="right"
            at={[w - CARD_PAD, round(bottom)]}
          >
            {k.card.assigned}
          </Text>
        )}
      </Group>
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {columns.map((c, i) => {
        const at = shown.get(c.column.id);
        const w = columnWidth - 2 * COLUMN_PAD;

        return (
          <Group key={c.column.id} offset={[i * (columnWidth + GAP), 0]}>
            <Group key="column" motion={at && pop(at)}>
              <Shape key="ground" geometry={rect(columnWidth, tall, { radius: 8 })} fill={ground} />
              {c.title.map((text, j) => (
                <Text
                  key={`title:${j}`}
                  font={l.font}
                  size={l.size}
                  weight={l.weight}
                  fill={l.colors.text}
                  anchor="left"
                  at={[COLUMN_PAD + 4, round(COLUMN_PAD + (j + 0.5) * line)]}
                >
                  {text}
                </Text>
              ))}
              <Text
                key="count"
                font={l.font}
                size={l.small}
                weight={l.weight}
                fill={l.colors.muted}
                anchor="right"
                at={[columnWidth - COLUMN_PAD - 4, round(COLUMN_PAD + line / 2)]}
              >
                {String(c.cards.length)}
              </Text>
            </Group>
            {c.cards.map((k) => drawCard(k, w))}
          </Group>
        );
      })}
      {between}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(width), Math.ceil(tall)],
    span: extent([...shown.values()]),
    ...handle,
  };
}
