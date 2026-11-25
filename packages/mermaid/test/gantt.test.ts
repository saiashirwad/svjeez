import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawGantt, parseGantt, type GanttDoc } from "../src/gantt.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): GanttDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "g.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseGantt(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseGantt() did not throw");
};

const day = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d);
const DAY = 86_400_000;
const tasks = (doc: GanttDoc) => doc.sections.flatMap((s) => s.tasks);

describe("parse gantt", () => {
  test("reads sections, durations, after, and tags in UTC", () => {
    const doc = parse(`gantt
      title A Gantt Diagram
      dateFormat YYYY-MM-DD
      section Section
        A task          :a1, 2014-01-01, 30d
        Another task    :after a1, 20d
      section Another
        Task in Another :crit, done, 2014-01-12, 12d
        another task    :24d
        Launch          :milestone, m1, 2014-03-01, 0d`);

    expect(doc.title).toBe("A Gantt Diagram");
    expect(doc.sections.map((s) => s.label)).toEqual(["Section", "Another"]);
    const [a1, b, c, d, m] = tasks(doc);
    expect(a1).toMatchObject({ id: "a1", start: day(2014, 1, 1), end: day(2014, 1, 31) });
    expect(b).toMatchObject({ start: day(2014, 1, 31), end: day(2014, 2, 20) });
    expect(c).toMatchObject({ crit: true, done: true, active: false, end: day(2014, 1, 24) });
    expect(d).toMatchObject({ start: day(2014, 1, 24), end: day(2014, 2, 17) });
    expect(m).toMatchObject({ milestone: true, start: m!.end });
  });

  test("dates stay on their calendar day whatever the local timezone", () => {
    const doc = parse("gantt\nA :a, 2024-03-10, 1d");

    expect(new Date(tasks(doc)[0]!.start).toISOString()).toBe("2024-03-10T00:00:00.000Z");
    expect(new Date(tasks(doc)[0]!.end).toISOString()).toBe("2024-03-11T00:00:00.000Z");
  });

  test("units: hours, weeks, months, explicit end dates, and several after ids", () => {
    const doc = parse(`gantt
      A :a, 2024-01-31, 12h
      B :b, 2024-01-31, 1M
      C :c, 2024-01-01, 2w
      D :d, 2024-01-01, 2024-01-05
      E :e, after a b c, 1d
      F :f, 2024-01-01, until d c`);

    const [a, b, c, d, e, f] = tasks(doc);

    expect(a!.end - a!.start).toBe(DAY / 2);
    expect(b!.end).toBe(day(2024, 2, 29));
    expect(c!.end - c!.start).toBe(14 * DAY);
    expect(d!.end).toBe(day(2024, 1, 5));
    expect(e!.start).toBe(Math.max(a!.end, b!.end, c!.end));
    expect(f!.end).toBe(Math.min(d!.start, c!.start));
  });

  test("tasks may follow tasks written later", () => {
    const doc = parse("gantt\nB :b, after a, 2d\nA :a, 2024-01-01, 3d");

    expect(tasks(doc)[0]!.start).toBe(day(2024, 1, 4));
  });

  test("other date formats, and Unix seconds", () => {
    expect(
      tasks(parse("gantt\ndateFormat DD/MM/YYYY HH:mm\nA :a, 05/02/2024 13:30, 1h"))[0]!.start,
    ).toBe(Date.UTC(2024, 1, 5, 13, 30));
    expect(tasks(parse("gantt\ndateFormat X\nA :a, 86400, 3600000"))[0]).toMatchObject({
      start: DAY,
      end: 3_600_000_000,
    });
  });

  test("excludes weekends pushes a task's end out and shades the days", () => {
    const doc = parse(`gantt
      excludes weekends
      A :a, 2024-01-04, 3d
      B :b, 2024-01-04, 2024-01-08`);

    const [a, b] = tasks(doc);

    expect(a!.end).toBe(day(2024, 1, 9));
    expect(b!.end).toBe(day(2024, 1, 8));
    expect(doc.excluded).toEqual([[day(2024, 1, 6), day(2024, 1, 8)]]);
  });

  test("weekend friday, named weekdays, and dates", () => {
    const doc = parse(`gantt
      excludes weekends, 2024-01-02
      weekend friday
      A :a, 2024-01-01, 2d`);

    expect(tasks(doc)[0]!.end).toBe(day(2024, 1, 4));
    expect(doc.excluded[0]).toEqual([day(2024, 1, 2), day(2024, 1, 3)]);
    expect(parse("gantt\nexcludes monday\nA :a, 2024-01-01, 1d").excluded).toEqual([
      [day(2024, 1, 1), day(2024, 1, 2)],
    ]);
  });

  test("axisFormat is kept, and tasks before any section get an unnamed one", () => {
    const doc = parse(
      "gantt\naxisFormat %b %d\nA :a, 2024-01-01, 1d\nsection S\nB :b, 2024-01-01, 1d",
    );

    expect(doc.axisFormat).toBe("%b %d");
    expect(doc.sections.map((s) => [s.label, s.tasks.length])).toEqual([
      ["", 1],
      ["S", 1],
    ]);
  });
});

describe("gantt errors", () => {
  test("name the line and what to write", () => {
    expect(message("gantt\nsection")).toContain('g.mmd:2: "section": a section needs a name.');
    expect(message("gantt\nA :a, 2024-01-01, soon")).toContain(
      'cannot read the end or duration "soon" as a date. The dateFormat is YYYY-MM-DD.',
    );
    expect(message("gantt\nA :a, 2024-02-30, 1d")).toContain('cannot read the start "2024-02-30"');
    expect(message("gantt\nA :1d")).toContain("the first task needs a start date");
    expect(message("gantt\nA :a, 2024-01-01, 1d\nB :a, after a, 1d")).toContain(
      'two tasks are named "a"',
    );
    expect(message("gantt\nA :a, after zzz, 1d")).toContain(
      'refers to "zzz", which is not a task id',
    );
    expect(message("gantt\nA :a, after b, 1d\nB :b, after a, 1d")).toContain("in a loop");
    expect(message("gantt\nA :a, 2024-01-05, 2024-01-01")).toContain("ends before it starts");
    expect(message("gantt\nA")).toContain("cannot read this line. Supported:");
    expect(message("gantt\ntitle")).toContain("a title needs text");
    expect(message("gantt")).toContain("has no tasks");
    expect(message("gantt\nA :a, 2024-01-01, 1d, 5d")).toContain(
      "a task is `Name :tags, id, start, end`",
    );
    expect(message("gantt\nA :a, 2024-01-01, 1.5M")).toContain("whole numbers");
  });

  test("reject rare syntax with a reason", () => {
    expect(message("gantt\ntodayMarker off")).toContain(
      "todayMarker: svjeez draws no today marker",
    );
    expect(message("gantt\ntickInterval 1week")).toContain("tickInterval:");
    expect(message("gantt\ntopAxis")).toContain("topAxis:");
    expect(message("gantt\nincludes 2024-01-01")).toContain("includes:");
    expect(message("gantt\nA :vert, v, 2024-01-01, 0d")).toContain("the vert tag is not supported");
    expect(message("gantt\nexcludes everything")).toContain('excludes cannot read "everything"');
    expect(
      message(
        "gantt\nexcludes monday tuesday wednesday thursday friday saturday sunday\nA :a, 2024-01-01, 1d",
      ),
    ).toContain("every day of the week");
    expect(message("gantt\ndateFormat MMM D YYYY")).toContain("svjeez cannot read");
    expect(message("gantt\ndateFormat HH:mm")).toContain("needs a year");
    expect(message("gantt\naxisFormat %Q")).toContain("axisFormat needs a d3 format");
  });
});

describe("drawGantt", () => {
  test("draws the doc, and reveals tasks in order", () => {
    const doc = parse("gantt\nsection S\nA :a, 2024-01-01, 5d\nB :b, after a, 5d");
    const chart = drawGantt(doc, { font: mono, reveal: span(0, 0.5) });
    const markup = svg.emit(scene({ size: [900, 300], duration: 3, title: "g" }, () => chart.node));

    expect(markup).toContain("@keyframes");
    expect(chart.when("b")).toEqual(span(0.5, 0.5));
  });
});
