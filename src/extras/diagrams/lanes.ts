import { el } from "../../el";
import { lanes as layout } from "../../layout/lanes";
import { ease, motion, type Seconds } from "../../motion";
import { enter } from "../../recipes";
import { travel } from "../timeline";
import { arrow, chip, labelOf, labelSize, look, lookup, placer, textWidth, tintOf, type Diagram, type DiagramOptions, type Labelled, type NodeRole } from "./kit";

export interface LaneSpan<L extends string> {
  readonly lane: L;
  readonly from: Seconds;
  readonly to: Seconds;
  readonly label?: string;
  readonly role?: NodeRole;
}

export interface LaneEvent<L extends string> {
  readonly lane: L;
  readonly at: Seconds;
  readonly label?: string;
  readonly role?: NodeRole;
}

export interface LaneLink<L extends string> {
  readonly from: L;
  readonly to: L;
  readonly at: Seconds;
}

export interface LanesOptions extends DiagramOptions {
  /** Pixels per second. */
  readonly scale: number;
  /** Play in real time from `at`, lane time 0 then: a playhead sweeps, spans grow as it passes, events pop, links fire. */
  readonly play?: { readonly at: Seconds };
}

export interface Lanes<L extends string> extends Diagram<L> {
  /** The x of time `t` on the lane axis. */
  x(t: Seconds): number;
}

const BAR = 18;

export function lanes<const L extends Record<string, Labelled>>(
  spec: {
    readonly lanes: L;
    readonly spans?: readonly LaneSpan<NoInfer<keyof L & string>>[];
    readonly events?: readonly LaneEvent<NoInfer<keyof L & string>>[];
    readonly links?: readonly LaneLink<NoInfer<keyof L & string>>[];
  },
  options: LanesOptions,
): Lanes<keyof L & string> {
  const { scale, play } = options;
  const l = look(options);
  const { theme, fontSize, font, small } = l;
  /** Scene time of lane time `t`. */
  const when = (t: Seconds) => (play?.at ?? 0) + t;
  const rows = Object.entries(spec.lanes as Record<string, Labelled>).map(([id, s]) => ({ id, ...labelOf(s) }));
  const [spans, events, links] = [spec.spans ?? [], spec.events ?? [], spec.links ?? []];
  const out = layout({
    lanes: rows.map((r) => ({ id: r.id, label: { w: textWidth(r.label, fontSize, font) + 16, h: fontSize } })),
    spans,
    events: events.map((e) => ({ ...e, label: e.label === undefined ? undefined : labelSize(e.label, small, font) })),
    links,
    scale,
    bar: BAR,
  });
  const at = placer(out.bounds, options);
  const boxes = new Map([...out.rows].map(([id, b]) => [id, at.box(b)]));
  const track = at.box(out.track);
  const x = (t: Seconds) => at.point({ x: out.x(t), y: 0 }).x;
  const role = (lane: string) => rows.find((r) => r.id === lane)!.role;

  const node = l.root([
    rows.map((r, i) => {
      const b = boxes.get(r.id)!;
      const label = at.point(out.labels.get(r.id)!);
      return el.g({}, [
        i % 2 === 0 && el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, fill: theme.base01, fillOpacity: 0.5 }),
        el.circle({ cx: label.x + 5, cy: label.y, r: 4, fill: tintOf(theme, r.role) }),
        el.text({ x: label.x + 16, y: label.y + fontSize * 0.35, fontSize, fill: theme.base05 }, r.label),
        el.path({ d: `M${track.x} ${b.center.y}H${track.x + track.w}`, stroke: theme.base02, strokeDasharray: "2 4" }),
      ]);
    }),
    out.ticks.map(({ t, x: tx }) => {
      const p = at.point({ x: tx, y: out.track.y + out.track.h });
      return el.g({}, [
        el.path({ d: `M${p.x} ${track.y}V${p.y + 4}`, stroke: theme.base02, strokeOpacity: 0.6 }),
        el.text({ x: p.x, y: p.y + 16, fontSize: small, textAnchor: "middle", fill: theme.base04 }, `${+t.toFixed(1)}s`),
      ]);
    }),
    spans.map((s, i) => {
      const b = at.box(out.spans[i]!);
      const tint = tintOf(theme, s.role ?? role(s.lane));
      return el.g({}, [
        el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, fill: tint, fillOpacity: 0.25, stroke: tint, animation: play ? motion({ width: 0 }).at(when(s.from)).to({ width: b.w }, s.to - s.from, ease.linear) : undefined }),
        s.label !== undefined && el.text({ x: b.x + 8, y: b.y + b.h + small + 3, fontSize: small, fill: theme.base04, animation: play ? enter({ at: when(s.from), over: 0.2 }) : undefined }, s.label),
      ]);
    }),
    links.map((link, i) => {
      const [a, b] = out.links[i]!;
      const [p, q] = [at.point(a), at.point(b)];
      return el.g({}, [
        arrow([p, q], { ...l, at: play ? when(link.at) : undefined, over: 0.3 }),
        play && el.circle({ r: 4, fill: theme.base09, animation: travel([p, q], { at: when(link.at), over: 0.3 }) }),
      ]);
    }),
    events.map((e, i) => {
      const { at: point, label } = out.events[i]!;
      const p = at.point(point);
      const tint = tintOf(theme, e.role ?? role(e.lane));
      const size = BAR / 2 + 1;
      return el.g({}, [
        el.path({
          d: `M${p.x} ${p.y - size}L${p.x + size} ${p.y}L${p.x} ${p.y + size}L${p.x - size} ${p.y}Z`,
          fill: tint,
          stroke: theme.base00,
          animation: play ? enter({ at: when(e.at), over: 0.3 }, { opacity: 0, scale: 0.3 }, ease.pop) : undefined,
        }),
        label && chip(at.box(label), e.label!, { ...l.smallLook, fill: theme.base05, ground: "none" }, play ? enter({ at: when(e.at), over: 0.25 }) : undefined),
      ]);
    }),
    play && el.path({ d: `M${track.x} ${track.y}V${track.y + track.h}`, stroke: theme.base09, strokeWidth: 1.5, animation: motion({ x: 0 }).at(when(0)).to({ x: track.w }, out.end, ease.linear) }),
  ]);
  return { node, bounds: at.bounds, get: lookup("lanes()", boxes), x };
}

