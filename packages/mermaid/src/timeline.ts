import { timeline, type DiagramOptions, type Timeline } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface TimelineDocPeriod {
  readonly label: string;
  readonly events: readonly string[];
}

export interface TimelineDocSection {
  /** Empty for periods written before any `section` line. */
  readonly label: string;
  readonly periods: readonly TimelineDocPeriod[];
}

export interface TimelineDoc {
  readonly kind: "timeline";
  readonly source: Place;
  readonly title?: string;
  readonly sections: readonly TimelineDocSection[];
}

const SUPPORTED =
  "Supported: `title History`, `section Early years`, periods `2021 : launch : press` and continuation lines `: more press`.";

const UNSUPPORTED = /^(accTitle|accDescr)\b/;

export const parseTimeline = (header: Line, body: readonly Line[]): TimelineDoc => {
  if (header.text !== "timeline")
    fail(
      header,
      "the timeline header takes no direction or other words. Write `timeline` on its own line.",
    );
  let title: string | undefined;
  const sections: { label: string; periods: { label: string; events: string[] }[] }[] = [];

  const current = () => {
    if (sections.length === 0) sections.push({ label: "", periods: [] });

    return sections.at(-1)!;
  };

  for (const l of body) {
    if (UNSUPPORTED.test(l.text))
      fail(l, "accessibility text is not drawn by svjeez. Remove the line.");
    const titled = /^title(?:\s+(.*))?$/.exec(l.text);

    if (titled) {
      title = clean(titled[1] ?? "");

      if (!title) fail(l, "a title needs text after it.");
      continue;
    }

    const sectioned = /^section(?:\s+(.*))?$/.exec(l.text);

    if (sectioned) {
      const label = clean(sectioned[1] ?? "");

      if (!label) fail(l, "a section needs a name.");
      sections.push({ label, periods: [] });
      continue;
    }

    const [first = "", ...rest] = l.text.split(":").map(clean);
    const continued = l.text.startsWith(":");

    if (!continued && !first) fail(l, `cannot read this line. ${SUPPORTED}`);

    if (rest.some((e) => e === ""))
      fail(l, "an event needs text between its colons. Remove the empty one.");

    if (continued) {
      const last = sections.at(-1)?.periods.at(-1);

      if (!last)
        fail(
          l,
          "a line starting with a colon adds events to the period above it, and there is none.",
        );
      last!.events.push(...rest);
    } else current().periods.push({ label: first, events: rest });
  }

  const filled = sections.filter((s) => s.periods.length > 0);

  if (filled.length === 0)
    return fail(header, "the timeline has no periods. Add lines such as `2021 : Launch`.");

  return {
    kind: "timeline",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    sections: filled,
  };
};

export const drawTimeline = (
  doc: TimelineDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Timeline => timeline({ title: doc.title, sections: doc.sections }, options);
