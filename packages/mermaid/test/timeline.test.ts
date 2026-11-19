import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawTimeline, parseTimeline, type TimelineDoc } from "../src/timeline.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const parse = (text: string): TimelineDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "t.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseTimeline(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseTimeline() did not throw");
};

describe("parse timeline", () => {
  test("reads the title, sections, periods and continuation lines", () => {
    const doc = parse(`timeline
      title History of social media
      section Early
        2002 : LinkedIn
        2004 : Facebook : Google
             : Orkut
      section Later
        2010 : Instagram
        2030`);

    expect(doc.title).toBe("History of social media");
    expect(doc.sections).toEqual([
      {
        label: "Early",
        periods: [
          { label: "2002", events: ["LinkedIn"] },
          { label: "2004", events: ["Facebook", "Google", "Orkut"] },
        ],
      },
      {
        label: "Later",
        periods: [
          { label: "2010", events: ["Instagram"] },
          { label: "2030", events: [] },
        ],
      },
    ]);
    expect(doc.source).toEqual({ file: "t.mmd", line: 1 });
  });

  test("periods before any section get an unnamed one", () => {
    const doc = parse("timeline\nA : x\nB : y");

    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.label).toBe("");
  });
});

describe("timeline errors", () => {
  test("name the line and what to write", () => {
    expect(message("timeline LR\nA : x")).toContain("takes no direction");
    expect(message("timeline\n: x")).toContain("adds events to the period above");
    expect(message("timeline\nA : x :")).toContain("an event needs text");
    expect(message("timeline\nA ::")).toContain("an event needs text");
    expect(message("timeline\nsection")).toContain("a section needs a name");
    expect(message("timeline\ntitle")).toContain("a title needs text");
    expect(message("timeline\nsection Only")).toContain("the timeline has no periods");
    expect(message("timeline\naccTitle: Hi")).toContain("accessibility text");
    expect(message("timeline\n  : x")).toContain("adds events");
  });
});

describe("drawTimeline", () => {
  test("draws the doc, and reveals periods in order", () => {
    const doc = parse("timeline\ntitle T\nsection S\n2021 : a : b\n2022 : c");
    const chart = drawTimeline(doc, { font: mono, reveal: span(0, 0.5) });
    const markup = svg.emit(scene({ size: [900, 500], duration: 3, title: "t" }, () => chart.node));

    expect(markup).toContain("@keyframes");
    expect(chart.when("period-2")).toEqual(span(0.5, 0.5));
  });
});
