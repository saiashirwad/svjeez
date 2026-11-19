import { gantt, type DiagramOptions, type Gantt } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type GanttTag = "done" | "active" | "crit" | "milestone";

export interface GanttDocTask {
  readonly id: string;
  readonly label: string;
  /** Epoch milliseconds, UTC. */
  readonly start: number;
  readonly end: number;
  readonly done: boolean;
  readonly active: boolean;
  readonly crit: boolean;
  readonly milestone: boolean;
}

export interface GanttDocSection {
  readonly label: string;
  readonly tasks: readonly GanttDocTask[];
}

export interface GanttDoc {
  readonly kind: "gantt";
  readonly source: Place;
  readonly title?: string;
  readonly dateFormat: string;
  readonly axisFormat?: string;
  readonly sections: readonly GanttDocSection[];
  /** Days off, as `[from, to]` epoch milliseconds, shaded on the chart. */
  readonly excluded: readonly (readonly [number, number])[];
}

const SUPPORTED =
  "Supported: `title`, `dateFormat`, `axisFormat`, `excludes weekends|monday|2024-01-01`, `weekend friday`, `section Name`, and tasks `Name :done|active|crit|milestone, id, start, end` where start is a date or `after id`, and end is a date, a duration like `3d`, or `until id`.";

const UNSUPPORTED = new Map<string, string>(
  (
    [
      ["todayMarker", "svjeez draws no today marker, so the chart stays the same on every day"],
      ["tickInterval", "svjeez picks the axis ticks itself; use `axisFormat` to shape the labels"],
      ["weekday", "svjeez draws a tick at each Monday"],
      ["includes", "svjeez only shades the days `excludes` names"],
      ["inclusiveEndDates", "svjeez reads an end date as the moment the task ends"],
      ["topAxis", "svjeez draws the axis below the chart"],
      ["displayMode", "svjeez draws one row per task"],
      ["click", "links and callbacks are not drawn by svjeez"],
      ["accTitle", "accessibility text is not drawn by svjeez"],
      ["accDescr", "accessibility text is not drawn by svjeez"],
    ] as const
  ).map(([word, why]) => [word, why] as const),
);

const DAY = 86_400_000;
const NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const TAGS: readonly string[] = ["done", "active", "crit", "milestone"];
const DURATION = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|M|y)$/;
const FORMAT_TOKEN = /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/y;
const AXIS_FORMAT = /^(?:[^%]|%[YymdeHIMSLbBaApj%])+$/s;
const ID = /^[\w-]+$/;
const GUARD = 100_000;

const isDate = (y: number, m: number, d: number): boolean => {
  const at = new Date(0);
  at.setUTCFullYear(y, m - 1, d);

  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
};

const validDay = (text: string): boolean => {
  const [y, m, d] = text.split("-").map(Number);

  return /^\d{4}-\d{2}-\d{2}$/.test(text) && isDate(y!, m!, d!);
};

type Reader = (text: string) => number | undefined;

/** Reads a dayjs-style format (YYYY YY MM M DD D HH H mm m ss s, or X and x for Unix time) as UTC. */
const readerOf = (l: Line, format: string): Reader => {
  if (format === "X" || format === "x") {
    const scale = format === "X" ? 1000 : 1;

    return (text) => (/^-?\d+$/.test(text) ? Number(text) * scale : undefined);
  }

  const fields: string[] = [];
  let pattern = "";
  let at = 0;

  while (at < format.length) {
    FORMAT_TOKEN.lastIndex = at;
    const token = FORMAT_TOKEN.exec(format)?.[0];

    if (token && format[at + token.length] !== token[0]) {
      fields.push(token);
      pattern += token.length === 1 ? "(\\d{1,2})" : `(\\d{${token.length}})`;
      at += token.length;
      continue;
    }

    const c = format[at]!;

    if (/[A-Za-z[\]]/.test(c) || token)
      fail(
        l,
        `the date format has "${c}", which svjeez cannot read. Use YYYY, YY, MM, DD, HH, mm, ss, or X for Unix seconds, joined by -, /, : or spaces.`,
      );
    pattern += c.replace(/[.*+?^${}()|\\]/g, "\\$&");
    at += 1;
  }

  const regex = new RegExp(`^${pattern}$`);

  if (!fields.some((f) => f === "YYYY" || f === "YY"))
    fail(l, "the date format needs a year, as in YYYY-MM-DD.");

  return (text) => {
    const found = regex.exec(text);

    if (!found) return undefined;

    const get = (...names: string[]): number | undefined => {
      const i = fields.findIndex((f) => names.includes(f));

      return i < 0 ? undefined : Number(found[i + 1]);
    };

    const year = get("YYYY") ?? 2000 + (get("YY") ?? 0);
    const [month, day] = [get("MM", "M") ?? 1, get("DD", "D") ?? 1];
    const [h, m, s] = [get("HH", "H") ?? 0, get("mm", "m") ?? 0, get("ss", "s") ?? 0];

    if (!isDate(year, month, day) || h > 23 || m > 59 || s > 59) return undefined;
    const at = new Date(0);
    at.setUTCFullYear(year, month - 1, day);
    at.setUTCHours(h, m, s, 0);

    return at.getTime();
  };
};

const addMonths = (t: number, months: number): number => {
  const d = new Date(t);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));

  return d.getTime();
};

const UNIT_MS = new Map([
  ["ms", 1],
  ["s", 1000],
  ["m", 60_000],
  ["h", 3_600_000],
  ["d", DAY],
  ["w", 7 * DAY],
]);

type Start =
  | { readonly kind: "date"; readonly at: number }
  | { readonly kind: "after"; readonly ids: readonly string[] }
  | { readonly kind: "previous" };

type End =
  | { readonly kind: "date"; readonly at: number }
  | { readonly kind: "until"; readonly ids: readonly string[] }
  | { readonly kind: "duration"; readonly amount: number; readonly unit: string };

interface Pending {
  readonly line: Line;
  readonly id: string;
  readonly label: string;
  readonly section: number;
  readonly tags: ReadonlySet<string>;
  readonly start: Start;
  readonly end: End;
  readonly previous: string | undefined;
}

export const parseGantt = (header: Line, body: readonly Line[]): GanttDoc => {
  let title: string | undefined;

  let dateFormat = { value: "YYYY-MM-DD", line: header };

  let axisFormat: string | undefined;
  let weekend = "saturday";
  const excludes: { readonly line: Line; readonly words: readonly string[] }[] = [];
  const sections: string[] = [];

  const raw: {
    readonly line: Line;
    readonly name: string;
    readonly fields: string[];
    readonly section: number;
  }[] = [];

  for (const l of body) {
    const word = /^\w+/.exec(l.text)?.[0] ?? "";
    const rest = l.text.slice(word.length).trim();
    const keyword = /^\w+(?:\s|$)/.test(l.text);

    if (keyword && UNSUPPORTED.has(word))
      fail(l, `${word}: ${UNSUPPORTED.get(word)}. Remove the line.`);

    if (keyword && word === "title") {
      if (!rest) fail(l, "a title needs text after it.");
      title = clean(rest);
      continue;
    }

    if (keyword && word === "dateFormat") {
      if (!rest) fail(l, "dateFormat needs a format, as in `dateFormat YYYY-MM-DD`.");
      dateFormat = { value: rest, line: l };
      readerOf(l, rest);
      continue;
    }

    if (keyword && word === "axisFormat") {
      if (!AXIS_FORMAT.test(rest))
        fail(
          l,
          "axisFormat needs a d3 format of %Y %y %m %d %e %H %I %M %S %L %b %B %a %A %p %j or %%, as in `axisFormat %b %d`.",
        );
      axisFormat = rest;
      continue;
    }

    if (keyword && word === "section") {
      if (!rest) fail(l, "a section needs a name.");
      sections.push(clean(rest));
      continue;
    }

    if (keyword && word === "weekend") {
      if (rest !== "friday" && rest !== "saturday")
        fail(l, "weekend needs `friday` or `saturday`, the first day of the weekend.");
      weekend = rest;
      continue;
    }

    if (keyword && word === "excludes") {
      const words = rest
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);

      if (words.length === 0)
        fail(l, "excludes needs `weekends`, a weekday, or a date like 2024-01-01.");

      for (const w of words)
        if (w !== "weekends" && !NAMES.includes(w) && !validDay(w))
          fail(
            l,
            `excludes cannot read "${w}". Write \`weekends\`, a weekday such as monday, or a date as YYYY-MM-DD.`,
          );
      excludes.push({ line: l, words });
      continue;
    }

    const colon = l.text.indexOf(":");

    if (colon < 0) fail(l, `cannot read this line. ${SUPPORTED}`);
    const name = clean(l.text.slice(0, colon));

    const fields = l.text
      .slice(colon + 1)
      .split(",")
      .map((f) => f.trim());

    if (!name) fail(l, "a task needs a name before the colon.");
    raw.push({ line: l, name, fields, section: sections.length - 1 });
  }

  const read = readerOf(dateFormat.line, dateFormat.value);

  const asDate = (l: Line, text: string, what: string): number =>
    read(text) ??
    fail(l, `cannot read ${what} "${text}" as a date. The dateFormat is ${dateFormat.value}.`);

  const names = new Set<string>();
  const pending: Pending[] = [];

  for (const [index, r] of raw.entries()) {
    const { line: l, fields } = r;
    const tags = new Set<string>();

    while (fields.length > 0 && TAGS.includes(fields[0]!)) tags.add(fields.shift()!);

    if (fields[0] === "vert")
      fail(l, "the vert tag is not supported. Use a milestone task instead.");

    if (fields.length === 0 || fields.length > 3 || fields.some((f) => f === ""))
      fail(
        l,
        "a task is `Name :tags, id, start, end`. After the tags it takes an end, `start, end`, or `id, start, end`.",
      );
    const [first, second, third] = [fields.at(-3), fields.at(-2), fields.at(-1)];
    const id = fields.length === 3 ? first! : `task${index + 1}`;

    if (!ID.test(id)) fail(l, `the id "${id}" can only use letters, digits, _ and -.`);

    if (names.has(id)) fail(l, `two tasks are named "${id}". Give each task its own id.`);
    names.add(id);
    const startText = fields.length === 1 ? undefined : second!;
    const endText = third!;

    const dependsOn = (text: string, word: string): string[] | undefined => {
      const m = new RegExp(`^${word}\\s+(.+)$`).exec(text);

      return m ? m[1]!.split(/\s+/) : undefined;
    };

    const after = startText === undefined ? undefined : dependsOn(startText, "after");
    const until = dependsOn(endText, "until");
    const duration = DURATION.exec(endText);

    if (duration && /^[My]$/.test(duration[2]!) && duration[1]!.includes("."))
      fail(l, `the duration "${endText}" counts months or years, which must be whole numbers.`);
    const previous = pending.at(-1)?.id;

    if (startText === undefined && previous === undefined)
      fail(l, "the first task needs a start date, because there is no task before it to follow.");

    pending.push({
      line: l,
      id,
      label: r.name,
      section: r.section,
      tags,
      previous,
      start:
        startText === undefined
          ? { kind: "previous" }
          : after
            ? { kind: "after", ids: after }
            : { kind: "date", at: asDate(l, startText, "the start") },
      end: until
        ? { kind: "until", ids: until }
        : duration
          ? { kind: "duration", amount: Number(duration[1]), unit: duration[2]! }
          : { kind: "date", at: asDate(l, endText, "the end or duration") },
    });
  }

  if (pending.length === 0) fail(header, "the gantt chart has no tasks.");

  for (const p of pending)
    for (const id of [
      ...(p.start.kind === "after" ? p.start.ids : []),
      ...(p.end.kind === "until" ? p.end.ids : []),
    ])
      if (!names.has(id))
        fail(
          p.line,
          `it refers to "${id}", which is not a task id. The ids are ${[...names].join(", ")}.`,
        );

  const weekdays = new Set<number>();
  const dates = new Set<number>();

  for (const { words } of excludes)
    for (const w of words)
      if (w === "weekends")
        (weekend === "friday" ? [5, 6] : [6, 0]).forEach((d) => weekdays.add(d));
      else if (NAMES.includes(w)) weekdays.add(NAMES.indexOf(w));
      else dates.add(Date.parse(`${w}T00:00:00Z`));

  const off = (t: number): boolean => {
    const day = Math.floor(t / DAY) * DAY;

    return weekdays.has(new Date(day).getUTCDay()) || dates.has(day);
  };

  if (weekdays.size === 7)
    fail(excludes[0]!.line, "excludes covers every day of the week, so no task could ever finish.");

  const times = new Map<string, { start: number; end: number }>();

  for (let pass = 0; pass <= pending.length && times.size < pending.length; pass++)
    for (const p of pending) {
      if (times.has(p.id)) continue;
      const of = (ids: readonly string[]) => ids.map((id) => times.get(id));

      const start =
        p.start.kind === "date"
          ? p.start.at
          : p.start.kind === "previous"
            ? times.get(p.previous!)?.end
            : maxOf(of(p.start.ids).map((t) => t?.end));

      if (start === undefined) continue;
      let end: number | undefined;

      if (p.end.kind === "date") end = p.end.at;
      else if (p.end.kind === "until") end = minOf(of(p.end.ids).map((t) => t?.start));
      else {
        const { amount, unit } = p.end;
        end = /^[My]$/.test(unit)
          ? addMonths(start, amount * (unit === "y" ? 12 : 1))
          : start + amount * UNIT_MS.get(unit)!;

        if (/^[dwMy]$/.test(unit)) {
          let work = 0;

          for (let d = Math.floor(start / DAY) * DAY; d < end; d += DAY) {
            if (off(d)) end += DAY;

            if (++work > GUARD)
              fail(p.line, "the excluded days leave this task no room to finish.");
          }
        }
      }

      if (end === undefined) continue;

      if (end < start)
        fail(
          p.line,
          "the task ends before it starts. Check the dates, or the `after` and `until` ids.",
        );
      times.set(p.id, { start, end });
    }

  const stuck = pending.find((p) => !times.has(p.id));

  if (stuck)
    fail(
      stuck.line,
      "its start and end depend on each other in a loop through `after` and `until`.",
    );

  const tasks = pending.map((p): GanttDocTask & { readonly section: number } => ({
    id: p.id,
    label: p.label,
    ...times.get(p.id)!,
    section: p.section,
    done: p.tags.has("done"),
    active: p.tags.has("active"),
    crit: p.tags.has("crit"),
    milestone: p.tags.has("milestone"),
  }));

  const first = Math.min(...tasks.map((t) => t.start));
  const last = Math.max(...tasks.map((t) => t.end));
  const excluded: [number, number][] = [];

  if ((weekdays.size > 0 || dates.size > 0) && last - first <= 5 * 366 * DAY)
    for (let d = Math.floor(first / DAY) * DAY; d < last; d += DAY)
      if (off(d)) {
        const run = excluded.at(-1);

        if (run && run[1] === d) run[1] = d + DAY;
        else excluded.push([d, d + DAY]);
      }

  return {
    kind: "gantt",
    source: sourceOf(header),
    title,
    dateFormat: dateFormat.value,
    axisFormat,
    excluded,
    sections: [...new Set(tasks.map((t) => t.section))].map((s) => ({
      label: sections[s] ?? "",
      tasks: tasks.filter((t) => t.section === s),
    })),
  };
};

const known = (values: readonly (number | undefined)[]): number[] | undefined => {
  const found = values.flatMap((v) => (v === undefined ? [] : [v]));

  return found.length === values.length ? found : undefined;
};

const maxOf = (values: readonly (number | undefined)[]): number | undefined => {
  const all = known(values);

  return all && Math.max(...all);
};

const minOf = (values: readonly (number | undefined)[]): number | undefined => {
  const all = known(values);

  return all && Math.min(...all);
};

export const drawGantt = (
  doc: GanttDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Gantt =>
  gantt(
    {
      title: doc.title,
      axisFormat: doc.axisFormat,
      excluded: doc.excluded,
      sections: doc.sections,
    },
    options,
  );
