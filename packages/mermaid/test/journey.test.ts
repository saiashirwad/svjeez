import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawJourney, parseJourney, type JourneyDoc } from "../src/journey.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): JourneyDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "j.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseJourney(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseJourney() did not throw");
};

describe("parse journey", () => {
  test("reads the title, sections, scores and actors", () => {
    const doc = parse(`journey
      title My working day
      section Go to work
        Make tea: 5: Me
        Do work: 1: Me, Cat
        Wait: 3
        Nap: 2:
      section Go home
        Sit down: 5: Me, Me`);

    expect(doc.title).toBe("My working day");
    expect(doc.sections).toEqual([
      {
        label: "Go to work",
        tasks: [
          { label: "Make tea", score: 5, actors: ["Me"] },
          { label: "Do work", score: 1, actors: ["Me", "Cat"] },
          { label: "Wait", score: 3, actors: [] },
          { label: "Nap", score: 2, actors: [] },
        ],
      },
      { label: "Go home", tasks: [{ label: "Sit down", score: 5, actors: ["Me"] }] },
    ]);
    expect(doc.source).toEqual({ file: "j.mmd", line: 1 });
  });

  test("tasks before any section get an unnamed one, and a task may be named like a keyword", () => {
    const doc = parse("journey\nTitle page: 4: Me\nsection things: 2");

    expect(doc.sections[0]!.label).toBe("");
    expect(doc.sections[0]!.tasks.map((t) => t.label)).toEqual(["Title page", "section things"]);
  });
});

describe("journey errors", () => {
  test("name the line and what to write", () => {
    expect(message("journey\nMake tea")).toContain('j.mmd:2: "Make tea": cannot read this line.');
    expect(message("journey\nMake tea: x: Me")).toContain(
      'the score "x" must be a number from 1 to 5',
    );
    expect(message("journey\nMake tea: 7: Me")).toContain(
      'the score "7" must be a number from 1 to 5',
    );
    expect(message("journey\nMake tea:: Me")).toContain('the score ""');
    expect(message("journey\n: 3: Me")).toContain("a task needs a name");
    expect(message("journey\nA: 3: a, b: ignored")).toContain("only two colons fit");
    expect(message("journey\nsection")).toContain("a section needs a name");
    expect(message("journey\ntitle")).toContain("a title needs text");
    expect(message("journey\nsection Empty")).toContain("the journey has no tasks");
    expect(message("journey\naccTitle: Hello")).toContain("accTitle: accessibility text");
  });
});

describe("drawJourney", () => {
  test("draws the doc, and reveals tasks in order", () => {
    const doc = parse("journey\nsection S\nA: 5: Me\nB: 1: Me, Cat");
    const chart = drawJourney(doc, { font: mono, reveal: span(0, 0.5) });
    const markup = svg.emit(scene({ size: [900, 500], duration: 3, title: "j" }, () => chart.node));

    expect(markup).toContain("@keyframes");
    expect(chart.when("task-2")).toEqual(span(0.5, 0.5));
  });
});
