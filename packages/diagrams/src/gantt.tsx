/** @jsxImportSource svjeez */
import { Group, Shape, Text, ease, enter, line, polygon, rect, track, type Span } from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkIds,
  extent,
  look,
  mix,
  partsOf,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Look,
  type Reveal,
} from "./kit.tsx";

/** Times are milliseconds since the Unix epoch, read and drawn in UTC. */
export interface GanttTask {
  readonly id: string;
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly done?: boolean;
  readonly active?: boolean;
  readonly crit?: boolean;
  /** Drawn as a diamond in the middle of its span. */
  readonly milestone?: boolean;
}

export interface GanttSection {
  /** An empty label draws the section's rows with no name. */
  readonly label: string;
  readonly tasks: readonly GanttTask[];
}

export interface GanttSpec {
  readonly title?: string;
  readonly sections: readonly GanttSection[];
  /** d3 time format of the axis labels: `%Y %y %m %d %e %H %I %M %S %L %b %B %a %A %p %j %%`. Defaults to what fits the span. */
  readonly axisFormat?: string;
  /** Time ranges shaded as days off, `[from, to]` in epoch milliseconds. */
  readonly excluded?: readonly (readonly [number, number])[];
}

export interface GanttOptions extends DiagramOptions {
  /** Total width in pixels, default 800. */
  readonly width?: number;
  /** Tasks appear in order: bars grow, milestones pop. A span gives each task one beat. */
  readonly reveal?: Reveal<string>;
}

export interface Gantt extends Diagram<string> {
  /** The x of an epoch-millisecond time on the axis. */
  x(time: number): number;
}

const WHAT = "gantt()";
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const WEEK = 7 * DAY;
const PAD = 12;
const GAP = 8;

type Step = { readonly ms: number } | { readonly months: number };

const STEPS: readonly Step[] = [
  { ms: 1000 },
  { ms: 5000 },
  { ms: 15_000 },
  { ms: 30_000 },
  { ms: MINUTE },
  { ms: 5 * MINUTE },
  { ms: 15 * MINUTE },
  { ms: 30 * MINUTE },
  { ms: HOUR },
  { ms: 3 * HOUR },
  { ms: 6 * HOUR },
  { ms: 12 * HOUR },
  { ms: DAY },
  { ms: 2 * DAY },
  { ms: WEEK },
  { ms: 2 * WEEK },
  { months: 1 },
  { months: 3 },
  { months: 6 },
  { months: 12 },
  { months: 24 },
  { months: 60 },
  { months: 120 },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const two = (n: number): string => String(n).padStart(2, "0");

const pieces = (t: number, c: string): string => {
  const d = new Date(t);
  const hour12 = d.getUTCHours() % 12 || 12;

  switch (c) {
    case "Y":
      return String(d.getUTCFullYear());
    case "y":
      return two(d.getUTCFullYear() % 100);
    case "m":
      return two(d.getUTCMonth() + 1);
    case "d":
      return two(d.getUTCDate());
    case "e":
      return String(d.getUTCDate());
    case "H":
      return two(d.getUTCHours());
    case "I":
      return two(hour12);
    case "M":
      return two(d.getUTCMinutes());
    case "S":
      return two(d.getUTCSeconds());
    case "L":
      return String(d.getUTCMilliseconds()).padStart(3, "0");
    case "b":
      return MONTHS[d.getUTCMonth()]!.slice(0, 3);
    case "B":
      return MONTHS[d.getUTCMonth()]!;
    case "a":
      return WEEKDAYS[d.getUTCDay()]!.slice(0, 3);
    case "A":
      return WEEKDAYS[d.getUTCDay()]!;
    case "p":
      return d.getUTCHours() < 12 ? "AM" : "PM";
    case "j":
      return String(Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1).padStart(
        3,
        "0",
      );
    case "%":
      return "%";
    default:
      throw new SceneError(
        `${WHAT} axisFormat uses "%${c}", which it does not know.`,
        "Use %Y %y %m %d %e %H %I %M %S %L %b %B %a %A %p %j or %%.",
      );
  }
};

export const formatTime = (format: string, t: number): string =>
  format.replace(/%(.)/gs, (_, c: string) => pieces(t, c));

const monthStart = (index: number): number => {
  const d = new Date(0);
  d.setUTCFullYear(Math.floor(index / 12), index % 12, 1);

  return d.getTime();
};

const MANY = 80;

const ticksOf = (step: Step, min: number, max: number): number[] => {
  const out: number[] = [];
  const unit = "ms" in step ? step.ms : step.months * 28 * DAY;

  if ((max - min) / unit > MANY) return out;

  if ("ms" in step) {
    const origin = step.ms % WEEK === 0 ? 4 * DAY : 0;

    for (let t = origin + Math.ceil((min - origin) / step.ms) * step.ms; t <= max; t += step.ms)
      out.push(t);

    return out;
  }

  const first = new Date(min);
  const base = first.getUTCFullYear() * 12 + first.getUTCMonth();

  for (let i = Math.floor(base / step.months) * step.months; monthStart(i) <= max; i += step.months)
    if (monthStart(i) >= min) out.push(monthStart(i));

  return out;
};

const defaultFormat = (step: Step): string => {
  if ("months" in step) return step.months >= 12 ? "%Y" : "%b %Y";

  if (step.ms < MINUTE) return "%H:%M:%S";

  if (step.ms < DAY) return "%H:%M";

  return "%Y-%m-%d";
};

const axisOf = (
  l: Look,
  min: number,
  max: number,
  width: number,
  format: string | undefined,
): { readonly ticks: readonly number[]; readonly format: string } => {
  const options = STEPS.map((step) => {
    const ticks = ticksOf(step, min, max);
    const text = format ?? defaultFormat(step);
    const widest = Math.max(0, ...ticks.map((t) => l.measure(formatTime(text, t), l.small)));

    return {
      ticks,
      format: text,
      fits: ticks.length < 2 || width / (ticks.length - 1) >= widest + 18,
    };
  });

  return (
    options.find((o) => o.fits && o.ticks.length > 0) ??
    options.findLast((o) => o.ticks.length > 0) ??
    options.at(-1)!
  );
};

export function gantt(spec: GanttSpec, options: GanttOptions): Gantt {
  const l = look(options, WHAT);
  const { width = 800, reveal } = options;

  if (!(width > 0 && Number.isFinite(width)))
    throw new SceneError(`${WHAT} needs a width above 0, got ${width}.`);
  const sections = spec.sections.filter((s) => s.tasks.length > 0);
  const tasks = sections.flatMap((s) => s.tasks);
  const ids = tasks.map((t) => t.id);
  checkIds(ids, WHAT, "task");

  ids.forEach((id, i) => {
    if (id.startsWith("~"))
      throw new SceneError(`${WHAT} has a task named "${id}".`, 'Name it without a leading "~".');

    if (ids.indexOf(id) !== i)
      throw new SceneError(`${WHAT} has two tasks named "${id}".`, "Give each task its own id.");
  });

  for (const t of tasks)
    if (!(Number.isFinite(t.start) && Number.isFinite(t.end) && t.end >= t.start))
      throw new SceneError(
        `${WHAT} task "${t.id}" needs a start and an end that is not before it, got ${t.start} and ${t.end}.`,
      );

  const first = Math.min(...tasks.map((t) => t.start));
  const last = Math.max(...tasks.map((t) => t.end));
  const [min, max] = last > first ? [first, last] : [first, first + DAY];
  const beats = schedule(reveal, ids, WHAT);

  const bar = Math.round(l.size * 1.7);
  const row = bar + 6;

  const sectionWidth = Math.max(
    0,
    ...sections.map((s) => (s.label === "" ? 0 : l.measure(s.label, l.small) + 20)),
  );

  const sample = l.measure(
    spec.axisFormat ? formatTime(spec.axisFormat, min) : "0000-00-00",
    l.small,
  );

  const left = PAD + Math.max(sectionWidth, sample / 2);
  const right = PAD + sample / 2;
  const plot = Math.max(240, width - left - right);
  const total = left + plot + right;
  const x = (t: number): number => left + ((t - min) / (max - min)) * plot;
  const axis = axisOf(l, min, max, plot, spec.axisFormat);

  const head = spec.title === undefined ? 0 : Math.round(l.size * 1.6) + 8;
  const top = PAD + head;
  const bottom = top + tasks.length * row;
  const height = Math.ceil(bottom + 10 + l.small * 1.3 + PAD);

  const band = mix(l.colors.line, l.colors.background, 0.1);
  const off = mix(l.colors.line, l.colors.background, 0.18);
  const doneFill = mix(l.colors.line, l.colors.background, 0.35);
  const rowOf = new Map(ids.map((id, i) => [id, i]));

  const parts = new Map<string, Span | undefined>(ids.map((id) => [id, beats.get(id)]));
  const handle = partsOf<string>(WHAT, parts);

  const look_ = (t: GanttTask) => {
    const base = t.crit ? l.colors.highlight : l.colors.accent;

    if (t.done)
      return {
        fill: doneFill,
        stroke: t.crit ? l.colors.highlight : l.colors.line,
        ink: l.colors.text,
      };

    if (t.active)
      return { fill: mix(base, l.colors.background, 0.25), stroke: base, ink: l.colors.text };

    return { fill: base, stroke: base, ink: l.colors.background };
  };

  let offset = 0;

  const chart = (
    <Group key="~chart">
      {sections.map((s, i) => {
        const y = top + offset * row;
        const h = s.tasks.length * row;
        offset += s.tasks.length;

        return (
          <Group key={`section-${i}`}>
            {i % 2 === 0 && <Shape key="band" geometry={rect(total, h)} at={[0, y]} fill={band} />}
            {s.label !== "" && (
              <Text
                key="label"
                font={l.font}
                size={l.small}
                weight={l.weight}
                fill={l.colors.text}
                anchor="left"
                at={[PAD, y + h / 2]}
              >
                {s.label}
              </Text>
            )}
          </Group>
        );
      })}
      {(spec.excluded ?? []).flatMap(([a, b], i) => {
        const [from, to] = [Math.max(a, min), Math.min(b, max)];

        return to > from
          ? [
              <Shape
                key={`off-${i}`}
                geometry={rect(x(to) - x(from), bottom - top)}
                at={[x(from), top]}
                fill={off}
              />,
            ]
          : [];
      })}
      {axis.ticks.map((t, i) => (
        <Group key={`tick-${i}`}>
          <Shape
            geometry={line([x(t), top], [x(t), bottom + 4])}
            stroke={{ color: l.colors.line, width: 1, dash: [1, 3] }}
            opacity={0.7}
          />
          <Text
            font={l.font}
            size={l.small}
            fill={l.colors.muted}
            anchor="top"
            at={[x(t), bottom + 8]}
          >
            {formatTime(axis.format, t)}
          </Text>
        </Group>
      ))}
      <Shape
        key="axis"
        geometry={line([left, bottom], [left + plot, bottom])}
        stroke={{ color: l.colors.line, width: 1 }}
      />
      {spec.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={Math.round(l.size * 1.2)}
          weight={l.weight}
          fill={l.colors.text}
          anchor="top-left"
          at={[PAD, PAD]}
        >
          {spec.title}
        </Text>
      )}
    </Group>
  );

  const taskNode = (t: GanttTask) => {
    const when = beats.get(t.id);
    const y = top + rowOf.get(t.id)! * row + (row - bar) / 2;
    const c = look_(t);
    const text = l.measure(t.label, l.small, l.weight);

    if (t.milestone) {
      const [cx, r] = [x((t.start + t.end) / 2), bar / 2];
      const fits = cx + r + GAP + text <= total - PAD;

      return (
        <Group key={t.id}>
          <Shape
            key="mark"
            geometry={polygon([0, -r], [r, 0], [0, r], [-r, 0])}
            anchor="center"
            at={[cx, y + bar / 2]}
            fill={c.fill}
            stroke={{ color: c.stroke, width: 1.5 }}
            motion={when && enter(when, { from: { opacity: 0, scale: 0.3 }, curve: ease.pop })}
          />
          <Text
            key="label"
            font={l.font}
            size={l.small}
            weight={l.weight}
            fill={l.colors.text}
            anchor={fits ? "left" : "right"}
            at={[fits ? cx + r + GAP : cx - r - GAP, y + bar / 2]}
            motion={when && enter(when)}
          >
            {t.label}
          </Text>
        </Group>
      );
    }

    const [x0, w] = [x(t.start), Math.max(x(t.end) - x(t.start), 3)];
    const inside = text + 16 <= w;
    const right_ = x0 + w + GAP + text <= total - PAD;
    const shape = (width_: number) => rect(width_, bar, { radius: 4 });

    return (
      <Group key={t.id}>
        <Shape
          key="bar"
          geometry={when ? track(shape(0)).to(shape(w), when, ease.linear) : shape(w)}
          at={[x0, y]}
          fill={c.fill}
          stroke={{ color: c.stroke, width: 1 }}
        />
        <Text
          key="label"
          font={l.font}
          size={l.small}
          weight={l.weight}
          fill={inside ? c.ink : l.colors.text}
          anchor={inside ? "center" : right_ ? "left" : "right"}
          at={[inside ? x0 + w / 2 : right_ ? x0 + w + GAP : x0 - GAP, y + bar / 2]}
          motion={when && enter(when)}
        >
          {t.label}
        </Text>
      </Group>
    );
  };

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
    size: [Math.ceil(total), height],
    span: extent([...beats.values()]),
    ...handle,
    x,
  };
}
