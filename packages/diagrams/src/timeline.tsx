/** @jsxImportSource svjeez */
import { series } from "./series.ts";
import { Group, Shape, Text, circle, enter, line, rect, type Span } from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
import {
  Edge,
  extent,
  look,
  mix,
  partsOf,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";

export interface TimelinePeriod {
  readonly label: string;
  readonly events?: readonly string[];
}

export interface TimelineSection {
  /** An empty label draws the section's periods with no header. */
  readonly label: string;
  readonly periods: readonly TimelinePeriod[];
}

export interface TimelineSpec {
  readonly title?: string;
  readonly sections: readonly TimelineSection[];
}

export interface TimelineOptions extends DiagramOptions {
  /** Periods fade in left to right with their events, named `period-1`, `period-2`, and so on. A span gives each period one beat. */
  readonly reveal?: Reveal<string>;
}

export type Timeline = Diagram<string>;

const WHAT = "timeline()";
const PAD = 12;
const GAP = 12;
const MIN_TEXT = 100;
const MAX_TEXT = 170;
const INSET = 10;

export function timeline(spec: TimelineSpec, options: TimelineOptions): Timeline {
  const l = look(options, WHAT);
  const sections = spec.sections.filter((s) => s.periods.length > 0);
  const periods = sections.flatMap((s) => s.periods);

  if (periods.length === 0) throw new SceneError(`${WHAT} needs at least one period, got none.`);
  const ids = periods.map((_, i) => `period-${i + 1}`);
  const beats = schedule(options.reveal, ids, WHAT);

  const words = periods
    .flatMap((p) => [p.label, ...(p.events ?? [])])
    .flatMap((t) => t.split(/\s+/));

  const widest = Math.max(...words.map((w) => l.measure(w, l.size, l.weight)));
  const textW = Math.min(MAX_TEXT, Math.max(MIN_TEXT, Math.ceil(widest)));
  const cardW = textW + 2 * INSET;
  const pitch = cardW + GAP;

  const wrap = (text: string): string[] => {
    const rows: string[] = [];
    let current = "";

    for (const word of text.split(/\s+/)) {
      const next = current === "" ? word : `${current} ${word}`;

      if (current === "" || l.measure(next, l.size, l.weight) <= textW) current = next;
      else {
        rows.push(current);
        current = word;
      }
    }

    return [...rows, current];
  };

  const lineH = Math.round(l.size * 1.3);
  const boxH = (rows: readonly string[]): number => rows.length * lineH + 16;

  const named = sections.some((s) => s.label !== "");

  const tints: Color[] = sections.flatMap((s, i) =>
    s.periods.map((_, n) =>
      series(l, named ? i : n + sections.slice(0, i).reduce((a, p) => a + p.periods.length, 0)),
    ),
  );

  const total = Math.ceil(PAD * 2 + periods.length * pitch - GAP);
  const titleSize = Math.round(l.size * 1.2);
  const titleW = spec.title === undefined ? 0 : l.measure(spec.title, titleSize, l.weight);
  const width = Math.ceil(Math.max(total, titleW + 2 * PAD));
  const head = spec.title === undefined ? 0 : Math.round(l.size * 1.6) + 8;
  const bandH = Math.round(l.size * 1.9);
  const bandTop = PAD + head;
  const periodsTop = bandTop + (named ? bandH + 8 : 0);

  const periodRows = periods.map((p) => wrap(p.label));
  const periodH = Math.max(...periodRows.map(boxH));
  const axisY = periodsTop + periodH + 22;
  const eventsTop = axisY + 18;
  const eventRows = periods.map((p) => (p.events ?? []).map(wrap));

  const stackH = (i: number): number => eventRows[i]!.reduce((h, rows) => h + boxH(rows) + 8, 0);

  const height = Math.ceil(eventsTop + Math.max(...periods.map((_, i) => stackH(i))) + PAD);

  const edge = mix(l.colors.line, l.colors.background, 0.45);
  const band = mix(l.colors.line, l.colors.background, 0.12);
  const cx = (i: number): number => PAD + i * pitch + cardW / 2;

  const fit = (text: string, room: number): string => {
    if (l.measure(text, l.small, l.weight) <= room) return text;
    let cut = text;

    while (cut.length > 1 && l.measure(`${cut}…`, l.small, l.weight) > room) cut = cut.slice(0, -1);

    return `${cut}…`;
  };

  const card = (
    key: string,
    rows: readonly string[],
    x: number,
    y: number,
    tint: Color,
    strong: boolean,
  ) => (
    <Group key={key} offset={[x, y]}>
      <Shape
        key="box"
        geometry={rect(cardW, boxH(rows), { radius: 6 })}
        fill={mix(tint, l.colors.background, strong ? 0.3 : 0.1)}
        stroke={{ color: strong ? tint : edge, width: 1 }}
      />
      {rows.map((text, n) => (
        <Text
          key={`line-${n}`}
          font={l.font}
          size={l.size}
          weight={l.weight}
          fill={l.colors.text}
          anchor="top"
          at={[cardW / 2, 8 + n * lineH]}
        >
          {text}
        </Text>
      ))}
    </Group>
  );

  const chart = (
    <Group key="~chart">
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={titleSize}
          weight={l.weight}
          fill={l.colors.text}
          anchor="top-left"
          at={[PAD, PAD]}
        >
          {spec.title}
        </Text>
      )}
      {named &&
        sections.map((s, i) => {
          const index = sections.slice(0, i).reduce((n, p) => n + p.periods.length, 0);
          const w = s.periods.length * pitch - GAP;

          return s.label === "" ? null : (
            <Group key={`section-${i}`} offset={[PAD + index * pitch, bandTop]}>
              <Shape key="band" geometry={rect(w, bandH, { radius: 6 })} fill={band} />
              <Text
                key="label"
                font={l.font}
                size={l.small}
                weight={l.weight}
                fill={l.colors.text}
                anchor="center"
                at={[w / 2, bandH / 2]}
              >
                {fit(s.label, w - 12)}
              </Text>
            </Group>
          );
        })}
      <Edge
        key="axis"
        look={l}
        color={edge}
        points={[
          { x: PAD / 2, y: axisY },
          { x: width - PAD / 2, y: axisY },
        ]}
      />
    </Group>
  );

  const periodNode = (p: (typeof periods)[number], i: number) => {
    const when: Span | undefined = beats.get(ids[i]!);
    const tint = tints[i]!;
    let y = eventsTop;

    return (
      <Group key={ids[i]} motion={when && enter(when)}>
        <Shape
          key="stem"
          geometry={line([cx(i), periodsTop + periodH], [cx(i), axisY])}
          stroke={{ color: edge, width: 1, dash: [2, 3] }}
        />
        {eventRows[i]!.length > 0 && (
          <Shape
            key="spine"
            geometry={line([cx(i), axisY], [cx(i), eventsTop + stackH(i) - 8])}
            stroke={{ color: edge, width: 1, dash: [2, 3] }}
          />
        )}
        {card("card", periodRows[i]!, PAD + i * pitch, periodsTop, tint, true)}
        <Shape
          key="dot"
          geometry={circle(4.5)}
          anchor="center"
          at={[cx(i), axisY]}
          fill={tint}
          stroke={{ color: l.colors.background, width: 1.5 }}
        />
        {eventRows[i]!.map((rows, n) => {
          const at = y;
          y += boxH(rows) + 8;

          return card(`event-${n}`, rows, PAD + i * pitch, at, tint, false);
        })}
      </Group>
    );
  };

  const handle = partsOf<string>(WHAT, new Map(ids.map((id) => [id, beats.get(id)])));

  const draw = (between?: Child) => (
    <Group ref={handle.ref}>
      {chart}
      {between}
      {periods.map(periodNode)}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [width, height],
    span: extent([...beats.values()]),
    ...handle,
  };
}
