/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  line,
  polygon,
  rect,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { SceneError, type Child, type Spanned } from "svjeez/tools";
import { lanes as layout } from "./layout/lanes.ts";
import {
  Route,
  checkIds,
  drawChip,
  drawEdge,
  extent,
  known,
  labelOf,
  labelSize,
  look,
  mix,
  partsOf,
  pop,
  type Diagram,
  type DiagramOptions,
} from "./kit.tsx";
import type { LaneBar, LaneEvent, LaneLink, Labelled } from "./types.ts";

export interface LanesOptions extends DiagramOptions {
  readonly scale: number;
  readonly reveal?: {
    readonly start: number;
    readonly over?: number;
  };
}

export interface Lanes<L extends string> extends Diagram<L> {
  x(t: number): number;
}

const WHAT = "lanes()";
const BAR = 18;

export function lanes<const L extends Record<string, Labelled>>(
  spec: {
    readonly lanes: L;
    readonly spans?: readonly LaneBar<NoInfer<keyof L & string>>[];
    readonly events?: readonly LaneEvent<NoInfer<keyof L & string>>[];
    readonly links?: readonly LaneLink<NoInfer<keyof L & string>>[];
  },
  options: LanesOptions,
): Lanes<keyof L & string> {
  type Id = keyof L & string;

  const l = look(options, WHAT);
  const { scale, reveal } = options;

  if (!(scale > 0 && Number.isFinite(scale)))
    throw new SceneError(`${WHAT} needs a scale above 0, in pixels per second, got ${scale}.`);
  const rows = Object.entries<Labelled>(spec.lanes).map(([id, s]) => ({ id, ...labelOf(s) }));
  const ids = rows.map((r) => r.id);
  checkIds(ids, WHAT, "lane");
  const [bars, events, links] = [spec.spans ?? [], spec.events ?? [], spec.links ?? []];
  bars.forEach((s, i) => {
    known(s.lane, ids, WHAT, "lane", `span ${i + 1}`);

    if (!(s.at >= 0 && s.over > 0 && Number.isFinite(s.at + s.over)))
      throw new SceneError(
        `${WHAT} span ${i + 1} needs an at of 0 or later and an over above 0, got at ${s.at} and over ${s.over}.`,
      );
  });
  events.forEach((e, i) => {
    known(e.lane, ids, WHAT, "lane", `event ${i + 1}`);

    if (!(e.at >= 0 && Number.isFinite(e.at)))
      throw new SceneError(`${WHAT} event ${i + 1} needs an at of 0 or later, got ${e.at}.`);
  });
  links.forEach((k, i) => {
    known(k.from, ids, WHAT, "lane", `link ${i + 1}`);
    known(k.to, ids, WHAT, "lane", `link ${i + 1}`);

    if (k.from === k.to)
      throw new SceneError(
        `${WHAT} link ${i + 1} runs from "${k.from}" to itself.`,
        "Link two different lanes.",
      );

    if (!(k.at >= 0 && Number.isFinite(k.at)))
      throw new SceneError(`${WHAT} link ${i + 1} needs an at of 0 or later, got ${k.at}.`);
  });

  const out = layout({
    lanes: rows.map((r) => ({
      id: r.id,
      label: { w: l.measure(r.label, l.size, l.weight) + 16, h: l.size },
    })),
    spans: bars.map((s) => ({ lane: s.lane, from: s.at, to: s.at + s.over })),
    events: events.map((e) => ({
      ...e,
      label: e.label === undefined ? undefined : labelSize(l, e.label),
    })),
    links,
    scale,
    bar: BAR,
  });

  const [dx, dy] = [-out.bounds.x, -out.bounds.y];

  if (
    reveal !== undefined &&
    !(
      reveal.start >= 0 &&
      Number.isFinite(reveal.start) &&
      (reveal.over === undefined || reveal.over > 0)
    )
  )
    throw new SceneError(
      `${WHAT} reveal needs a start of 0 or later and an over above 0, got span(${reveal.start}, ${reveal.over}).`,
    );
  const rate = reveal?.over === undefined ? 1 : reveal.over / out.end;
  const when = (t: number): number => (reveal?.start ?? 0) + t * rate;
  const at = (t: number, over: number): Spanned => span(when(t), over * rate);
  const role = (lane: string) => rows.find((r) => r.id === lane)!.role;
  const area = { x: out.track.x + dx, y: out.track.y + dy, w: out.track.w, h: out.track.h };
  const stripe = mix(l.colors.line, l.colors.background, 0.08);

  const busy = (lane: string): Spanned | undefined =>
    reveal &&
    extent([
      ...bars.filter((s) => s.lane === lane).map((s) => at(s.at, s.over)),
      ...events.filter((e) => e.lane === lane).map((e) => at(e.at, 0.3)),
      ...links.filter((k) => k.from === lane || k.to === lane).map((k) => at(k.at, 0.3)),
    ]);

  const parts = new Map<string, Spanned | undefined>(ids.map((id) => [id, busy(id)]));
  const handle = partsOf<Id>(WHAT, options.name ?? "lanes", parts);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {rows.map((r, i) => {
        const b = out.rows.get(r.id)!;
        const label = out.labels.get(r.id)!;
        const mid = b.y + dy + b.h / 2;

        return (
          <Group key={r.id}>
            {i % 2 === 0 && (
              <Shape
                key="stripe"
                geometry={rect(b.w, b.h)}
                at={[b.x + dx, b.y + dy]}
                fill={stripe}
              />
            )}
            <Shape
              key="dot"
              geometry={circle(4)}
              anchor="center"
              at={[label.x + dx + 5, label.y + dy]}
              fill={l.tint(r.role)}
            />
            <Text
              key="label"
              font={l.font}
              size={l.size}
              weight={l.weight}
              fill={l.colors.text}
              anchor="left"
              at={[label.x + dx + 16, label.y + dy]}
            >
              {r.label}
            </Text>
            <Shape
              key="track"
              geometry={line([area.x, mid], [area.x + area.w, mid])}
              stroke={{ color: l.colors.line, width: 1, dash: [2, 4] }}
            />
          </Group>
        );
      })}
      {out.ticks.map(({ t, x }, i) => (
        <Group key={`tick-${i}`}>
          <Shape
            geometry={line([x + dx, area.y], [x + dx, area.y + area.h + 4])}
            stroke={{ color: l.colors.line, width: 1 }}
            opacity={0.4}
          />
          <Text
            font={l.font}
            size={l.small}
            fill={l.colors.muted}
            anchor="top"
            at={[x + dx, area.y + area.h + 6]}
          >{`${+t.toFixed(1)}s`}</Text>
        </Group>
      ))}
      {bars.map((s, i) => {
        const b = out.spans[i]!;
        const tint = l.tint(s.role ?? role(s.lane));

        return (
          <Group key={`span-${i + 1}`} at={[b.x + dx, b.y + dy]}>
            <Shape
              key="bar"
              geometry={
                reveal
                  ? track(rect(0, b.h, { radius: 4 })).to(
                      rect(b.w, b.h, { radius: 4 }),
                      at(s.at, s.over),
                      ease.linear,
                    )
                  : rect(b.w, b.h, { radius: 4 })
              }
              fill={mix(tint, l.colors.background, 0.25)}
              stroke={{ color: tint, width: 1 }}
            />
            {s.label !== undefined && (
              <Text
                key="label"
                font={l.font}
                size={l.small}
                fill={l.colors.muted}
                at={[8, b.h + 3]}
                motion={reveal && enter(at(s.at, 0.2))}
              >
                {s.label}
              </Text>
            )}
          </Group>
        );
      })}
      {links.map((k, i) => {
        const [a, b] = out.links[i]!;

        const points = [
          { x: a.x + dx, y: a.y + dy },
          { x: b.x + dx, y: b.y + dy },
        ];

        const fire = at(k.at, 0.3);

        return (
          <Group key={`link-${i + 1}`}>
            {drawEdge(l, { key: "arrow", points, drawn: reveal && fire })}
            {reveal && (
              <Shape
                key="pulse"
                geometry={circle(4)}
                anchor="center"
                fill={l.colors.highlight}
                at={new Route([points]).travel(fire)}
                opacity={track(0)
                  .set(1, fire.start)
                  .set(0, fire.start + fire.over)}
              />
            )}
          </Group>
        );
      })}
      {between}
      {events.map((e, i) => {
        const { at: p, label } = out.events[i]!;
        const tint = l.tint(e.role ?? role(e.lane));
        const r = BAR / 2 + 1;

        return (
          <Group key={`event-${i + 1}`}>
            <Shape
              key="mark"
              geometry={polygon([
                [0, -r],
                [r, 0],
                [0, r],
                [-r, 0],
              ])}
              anchor="center"
              at={[p.x + dx, p.y + dy]}
              fill={tint}
              stroke={{ color: l.colors.background, width: 1 }}
              motion={
                reveal &&
                enter(at(e.at, 0.3), { from: { opacity: 0, scale: 0.3 }, curve: ease.pop })
              }
            />
            {label &&
              drawChip(l, {
                key: "label",
                box: { x: label.x + dx, y: label.y + dy, w: label.w, h: label.h },
                text: e.label!,
                fill: l.colors.text,
                ground: "none",
                motion: reveal && pop(at(e.at, 0.25)),
              })}
          </Group>
        );
      })}
      {reveal && (
        <Shape
          key="playhead"
          geometry={line([0, 0], [0, area.h])}
          stroke={{ color: l.colors.highlight, width: 1.5 }}
          at={track([area.x, area.y]).to([area.x + area.w, area.y], at(0, out.end), ease.linear)}
        />
      )}
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(out.bounds.w), Math.ceil(out.bounds.h)],
    span: reveal && at(0, out.end),
    ...handle,
    x: (t) => out.x(t) + dx,
  };
}
