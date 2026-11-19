import { journey, type DiagramOptions, type Journey } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface JourneyDocTask {
  readonly label: string;
  readonly score: number;
  readonly actors: readonly string[];
}

export interface JourneyDocSection {
  /** Empty for tasks written before any `section` line. */
  readonly label: string;
  readonly tasks: readonly JourneyDocTask[];
}

export interface JourneyDoc {
  readonly kind: "journey";
  readonly source: Place;
  readonly title?: string;
  readonly sections: readonly JourneyDocSection[];
}

const SUPPORTED =
  "Supported: `title My day`, `section Go to work`, and tasks `Make tea: 5: Me, Cat` (a score from 1 to 5, then optional actors).";

const UNSUPPORTED = new Map<string, string>([
  ["accTitle", "accessibility text is not drawn by svjeez"],
  ["accDescr", "accessibility text is not drawn by svjeez"],
]);

export const parseJourney = (header: Line, body: readonly Line[]): JourneyDoc => {
  let title: string | undefined;
  const sections: { label: string; tasks: JourneyDocTask[] }[] = [];

  for (const l of body) {
    const word = /^\w+(?=\s|:|$)/.exec(l.text)?.[0] ?? "";

    if (UNSUPPORTED.has(word)) fail(l, `${word}: ${UNSUPPORTED.get(word)}. Remove the line.`);
    const titled = /^title(?:\s+([^:]*))?$/.exec(l.text);

    if (titled) {
      title = clean(titled[1] ?? "");

      if (!title) fail(l, "a title needs text after it.");
      continue;
    }

    const sectioned = /^section(?:\s+([^:]*))?$/.exec(l.text);

    if (sectioned) {
      const label = clean(sectioned[1] ?? "");

      if (!label) fail(l, "a section needs a name.");
      sections.push({ label, tasks: [] });
      continue;
    }

    const [name = "", score, actors, ...extra] = l.text.split(":").map((f) => f.trim());

    if (score === undefined) fail(l, `cannot read this line. ${SUPPORTED}`);

    if (!clean(name)) fail(l, "a task needs a name before the first colon.");

    if (extra.length > 0)
      fail(
        l,
        "a task is `Name: score: actor, actor`, so only two colons fit. Remove the extra one.",
      );

    if (!/^\d+(?:\.\d+)?$/.test(score) || Number(score) < 1 || Number(score) > 5)
      fail(
        l,
        `the score "${score}" must be a number from 1 to 5, as in \`${clean(name)}: 4: Me\`.`,
      );

    if (sections.length === 0) sections.push({ label: "", tasks: [] });
    sections.at(-1)!.tasks.push({
      label: clean(name),
      score: Number(score),
      actors: [
        ...new Set(
          (actors ?? "")
            .split(",")
            .map(clean)
            .filter((a) => a !== ""),
        ),
      ],
    });
  }

  const filled = sections.filter((s) => s.tasks.length > 0);

  if (filled.length === 0) fail(header, "the journey has no tasks.");

  return { kind: "journey", source: sourceOf(header), title, sections: filled };
};

export const drawJourney = (
  doc: JourneyDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Journey => journey({ title: doc.title, sections: doc.sections }, options);
