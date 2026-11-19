import { pie, type DiagramOptions, type Pie } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface PieSliceDoc {
  readonly label: string;
  readonly value: number;
}

export interface PieDoc {
  readonly kind: "pie";
  readonly source: Place;
  readonly title?: string;
  readonly showData: boolean;
  readonly slices: readonly PieSliceDoc[];
}

const SUPPORTED =
  'Supported: `pie` or `pie showData` (optionally `title Text` after it), `title Text` on its own line, and slices written `"Label" : 42`.';

const HEADER = /^pie(?:\s+(showData))?(?:\s+title\s+(.+))?$/;
const UNSUPPORTED = /^(accTitle|accDescr)\b/;
const SLICE = /^(?:"([^"]*)"|'([^']*)')\s*:\s*(\S+)$/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;

export const parsePie = (header: Line, body: readonly Line[]): PieDoc => {
  const head = HEADER.exec(header.text);

  if (!head) return fail(header, `cannot read the pie header. ${SUPPORTED}`);
  let title = head[2] === undefined ? undefined : clean(head[2]);
  const slices: PieSliceDoc[] = [];

  for (const l of body) {
    const t = /^title\s+(.+)$/.exec(l.text);

    if (t) {
      title = clean(t[1]!);
      continue;
    }

    if (UNSUPPORTED.test(l.text))
      return fail(l, "accessibility lines are not supported: svjeez draws the title and slices.");
    const s = SLICE.exec(l.text);

    if (!s) return fail(l, `cannot read this line as a slice. ${SUPPORTED}`);
    const label = clean(s[1] ?? s[2] ?? "");

    if (label === "") return fail(l, "a slice needs a label inside its quotes.");

    if (!NUMBER.test(s[3]!))
      return fail(
        l,
        s[3]!.startsWith("-")
          ? `the value ${s[3]} is negative. Slices share the circle by value, so write 0 or more.`
          : `the value ${JSON.stringify(s[3])} is not a number. Write it as a plain number such as 42 or 4.5.`,
      );

    if (slices.some((x) => x.label === label))
      return fail(
        l,
        `the slice ${JSON.stringify(label)} is already there. Give each slice its own label.`,
      );
    slices.push({ label, value: Number(s[3]) });
  }

  if (slices.length === 0)
    return fail(header, 'the pie has no slices. Add lines such as `"Dogs" : 386`.');

  if (!slices.some((s) => s.value > 0))
    return fail(
      header,
      "every slice is 0, so there is nothing to draw. Give a slice a value above 0.",
    );

  return {
    kind: "pie",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    showData: head[1] !== undefined,
    slices,
  };
};

const keyOf = (label: string, i: number): string =>
  /^\d+$|\//.test(label) ? `slice-${i + 1}` : label;

export const drawPie = (
  doc: PieDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Pie<string> =>
  pie(
    {
      ...(doc.title !== undefined && { title: doc.title }),
      showData: doc.showData,
      slices: Object.fromEntries(doc.slices.map((s, i) => [keyOf(s.label, i), s])),
    },
    options,
  );
