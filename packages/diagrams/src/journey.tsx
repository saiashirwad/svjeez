/** @jsxImportSource svjeez */
import { series } from "./series.ts";
import { Group, Shape, Text, circle, enter, line, path, rect, type Span } from "svjeez";
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

export interface JourneyTask {
  readonly label: string;
  /** From 1 (worst) to 5 (best). */
  readonly score: number;
  readonly actors?: readonly string[];
}

export interface JourneySection {
  /** An empty label draws the section's tasks with no header. */
  readonly label: string;
  readonly tasks: readonly JourneyTask[];
}

export interface JourneySpec {
  readonly title?: string;
  readonly sections: readonly JourneySection[];
}

export interface JourneyOptions extends DiagramOptions {
  /** Tasks fade in left to right, named `task-1`, `task-2`, and so on. A span gives each task one beat. */
  readonly reveal?: Reveal<string>;
}

export type Journey = Diagram<string>;

const WHAT = "journey()";
const PAD = 12;
const GAP = 12;
const LEVEL = 26;
const FACE = 11;
const MIN_TEXT = 124;
const MAX_TEXT = 200;

export function journey(spec: JourneySpec, options: JourneyOptions): Journey {
  const l = look(options, WHAT);
  const sections = spec.sections.filter((s) => s.tasks.length > 0);
  const tasks = sections.flatMap((s) => s.tasks);

  if (tasks.length === 0) throw new SceneError(`${WHAT} needs at least one task, got none.`);

  tasks.forEach((t, i) => {
    if (!(t.score >= 1 && t.score <= 5))
      throw new SceneError(
        `${WHAT} task ${i + 1} ("${t.label}") needs a score from 1 to 5, got ${t.score}.`,
      );
  });
  const ids = tasks.map((_, i) => `task-${i + 1}`);
  const beats = schedule(options.reveal, ids, WHAT);
  const actors = [...new Set(tasks.flatMap((t) => t.actors ?? []))];

  const actorTint = (name: string): Color => series(l, actors.indexOf(name));

  const words = tasks.flatMap((t) => t.label.split(/\s+/));
  const widest = Math.max(...words.map((w) => l.measure(w, l.size, l.weight)));
  const textW = Math.min(MAX_TEXT, Math.max(MIN_TEXT, Math.ceil(widest)));
  const cardW = textW + 20;
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

  const rows = tasks.map((t) => wrap(t.label));
  const lineH = Math.round(l.size * 1.3);
  const cardH = Math.max(...rows.map((r) => r.length)) * lineH + 18 + 16;

  const scoreW = l.measure("5", l.small) + 8;
  const left = PAD + scoreW;
  const titleSize = Math.round(l.size * 1.2);
  const titleW = spec.title === undefined ? 0 : l.measure(spec.title, titleSize, l.weight);
  const total = Math.ceil(Math.max(left + tasks.length * pitch - GAP + PAD, titleW + 2 * PAD));

  const head = spec.title === undefined ? 0 : Math.round(l.size * 1.6) + 8;
  const bandH = Math.round(l.size * 1.9);
  const bandTop = PAD + head;
  const chartTop = bandTop + bandH + 8 + FACE + 4;
  const chartBottom = chartTop + 4 * LEVEL + FACE + 4;
  const cardsTop = chartBottom + 6;

  const legendRow = Math.round(l.size * 1.6);
  const legend: { readonly name: string; readonly x: number; readonly y: number }[] = [];
  let [lx, ly] = [PAD, cardsTop + cardH + 16];

  for (const name of actors) {
    const w = 18 + l.measure(name, l.small) + 16;

    if (lx > PAD && lx + w > total) [lx, ly] = [PAD, ly + legendRow];
    legend.push({ name, x: lx, y: ly });
    lx += w;
  }

  const height = Math.ceil(actors.length === 0 ? cardsTop + cardH + PAD : ly + legendRow);

  const fit = (text: string, room: number): string => {
    if (l.measure(text, l.small, l.weight) <= room) return text;
    let cut = text;

    while (cut.length > 1 && l.measure(`${cut}…`, l.small, l.weight) > room) cut = cut.slice(0, -1);

    return `${cut}…`;
  };

  const band = mix(l.colors.line, l.colors.background, 0.12);
  const edge = mix(l.colors.line, l.colors.background, 0.45);
  const cardFill = mix(l.colors.line, l.colors.background, 0.07);

  const face = (cx: number, cy: number, score: number) => {
    const mouth =
      score > 3
        ? path().moveTo([-5, 2]).curveTo([-3, 6.5], [3, 6.5], [5, 2])
        : score < 3
          ? path().moveTo([-5, 6.5]).curveTo([-3, 2.5], [3, 2.5], [5, 6.5])
          : line([-4.5, 4.5], [4.5, 4.5]);

    return (
      <Group key="face" offset={[cx, cy]}>
        <Shape
          key="head"
          geometry={circle(FACE)}
          anchor="center"
          at={[0, 0]}
          fill={l.colors.background}
          stroke={{ color: l.colors.line, width: 1.5 }}
        />
        <Shape
          key="eye-l"
          geometry={circle(1.3)}
          anchor="center"
          at={[-3.6, -2.8]}
          fill={l.colors.line}
        />
        <Shape
          key="eye-r"
          geometry={circle(1.3)}
          anchor="center"
          at={[3.6, -2.8]}
          fill={l.colors.line}
        />
        <Shape
          key="mouth"
          geometry={mouth}
          stroke={{ color: l.colors.line, width: 1.2, cap: "round" }}
        />
      </Group>
    );
  };

  const centers = tasks.map((t, i) => ({
    x: left + i * pitch + cardW / 2,
    y: chartTop + (5 - t.score) * LEVEL,
  }));

  const chart = (
    <Group key="~chart">
      {tasks.length > 0 &&
        [1, 2, 3, 4, 5].map((level) => {
          const y = chartTop + (5 - level) * LEVEL;

          return (
            <Group key={`level-${level}`}>
              <Shape
                geometry={line([left - 6, y], [total - PAD, y])}
                stroke={{ color: l.colors.line, width: 1, dash: [1, 4] }}
                opacity={0.5}
              />
              <Text font={l.font} size={l.small} fill={l.colors.muted} anchor="left" at={[PAD, y]}>
                {String(level)}
              </Text>
            </Group>
          );
        })}
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
      {sections.map((s, i) => {
        const index = sections.slice(0, i).reduce((n, p) => n + p.tasks.length, 0);
        const w = s.tasks.length * pitch - GAP;

        return s.label === "" ? null : (
          <Group key={`section-${i}`} offset={[left + index * pitch, bandTop]}>
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
      {actors.map((name, i) => {
        const p = legend[i]!;

        return (
          <Group key={`actor-${i}`}>
            <Shape
              key="dot"
              geometry={circle(5)}
              anchor="center"
              at={[p.x + 5, p.y]}
              fill={actorTint(name)}
            />
            <Text
              key="name"
              font={l.font}
              size={l.small}
              fill={l.colors.text}
              anchor="left"
              at={[p.x + 18, p.y]}
            >
              {name}
            </Text>
          </Group>
        );
      })}
    </Group>
  );

  const taskNode = (t: JourneyTask, i: number) => {
    const when: Span | undefined = beats.get(ids[i]!);
    const c = centers[i]!;
    const prev = centers[i - 1];
    const x0 = left + i * pitch;
    const mine = t.actors ?? [];
    const spacing = Math.min(13, (cardW - 16) / Math.max(mine.length, 1));

    const hop = prev && {
      from: { x: prev.x, y: prev.y },
      to: c,
    };

    return (
      <Group key={ids[i]} motion={when && enter(when)}>
        {hop &&
          (() => {
            const [dx, dy] = [hop.to.x - hop.from.x, hop.to.y - hop.from.y];
            const d = Math.hypot(dx, dy);
            const [ux, uy] = [dx / d, dy / d];

            return (
              <Edge
                key="path"
                look={l}
                head="none"
                points={[
                  { x: hop.from.x + ux * FACE, y: hop.from.y + uy * FACE },
                  { x: hop.to.x - ux * FACE, y: hop.to.y - uy * FACE },
                ]}
              />
            );
          })()}
        <Edge
          key="stem"
          look={l}
          head="none"
          color={edge}
          stroke={{ width: 1, dash: [2, 3] }}
          points={[
            { x: c.x, y: c.y + FACE },
            { x: c.x, y: cardsTop },
          ]}
        />
        <Group key="card" offset={[x0, cardsTop]}>
          <Shape
            key="box"
            geometry={rect(cardW, cardH, { radius: 6 })}
            fill={cardFill}
            stroke={{ color: edge, width: 1 }}
          />
          {rows[i]!.map((text, n) => (
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
          {mine.map((name, n) => (
            <Shape
              key={`actor-${n}`}
              geometry={circle(5)}
              anchor="center"
              at={[cardW / 2 + (n - (mine.length - 1) / 2) * spacing, cardH - 13]}
              fill={actorTint(name)}
              stroke={{ color: cardFill, width: 1 }}
            />
          ))}
        </Group>
        {face(c.x, c.y, t.score)}
      </Group>
    );
  };

  const handle = partsOf<string>(WHAT, new Map(ids.map((id) => [id, beats.get(id)])));

  const draw = (between?: Child) => (
    <Group ref={handle.ref}>
      {chart}
      {between}
      {tasks.map(taskNode)}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [total, height],
    span: extent([...beats.values()]),
    ...handle,
  };
}
