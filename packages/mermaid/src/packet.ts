import { packet, type DiagramOptions, type Packet } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface PacketFieldDoc {
  readonly label: string;
  /** First bit, counted from 0. */
  readonly from: number;
  /** Last bit, inclusive. */
  readonly to: number;
  readonly source: Place;
}

export interface PacketDoc {
  readonly kind: "packet";
  readonly source: Place;
  readonly title?: string;
  readonly fields: readonly PacketFieldDoc[];
}

const SUPPORTED =
  'Supported: `title Text`, then one field per line in bit order: `0-15: "Source Port"`, a single bit `106: "URG"`, or a length from the last bit `+16: "Field"`.';

const FIELD = /^(?:\+(\d+)|(\d+)(?:\s*-\s*(\d+))?)\s*:\s*(?:"([^"]*)"|'([^']*)')$/;
const UNSUPPORTED = /^(accTitle|accDescr)\b/;
const MAX_BITS = 32 * 1024;

export const parsePacket = (header: Line, body: readonly Line[]): PacketDoc => {
  if (header.text !== "packet-beta" && header.text !== "packet")
    return fail(header, "write just `packet-beta` on the first line.");
  let title: string | undefined;
  const fields: PacketFieldDoc[] = [];

  for (const l of body) {
    const t = /^title\s+(.+)$/.exec(l.text);

    if (t) {
      title = clean(t[1]!);
      continue;
    }

    if (UNSUPPORTED.test(l.text))
      return fail(l, "accessibility lines are not supported: svjeez draws the title and fields.");
    const m = FIELD.exec(l.text);

    if (!m) return fail(l, `cannot read this line as a field. ${SUPPORTED}`);
    const label = clean(m[4] ?? m[5] ?? "");
    const next = (fields.at(-1)?.to ?? -1) + 1;

    if (label === "") return fail(l, "a field needs a label inside its quotes.");
    let [from, to] = [next, next];

    if (m[1] !== undefined) {
      if (Number(m[1]) === 0)
        return fail(l, 'a relative field needs at least 1 bit. Write `+1: "Flag"` or more.');
      to = next + Number(m[1]) - 1;
    } else {
      from = Number(m[2]);
      to = m[3] === undefined ? from : Number(m[3]);

      if (to < from)
        return fail(
          l,
          `the field ends at bit ${to} before it starts at bit ${from}. Write ${to}-${from}.`,
        );

      if (from !== next)
        return fail(
          l,
          `the field starts at bit ${from}, but the last one ended at bit ${next - 1}. Fields run in order with no gaps, so start at ${next}, or write a length such as \`+${to - from + 1}\`.`,
        );
    }

    if (to >= MAX_BITS)
      return fail(l, `bit ${to} is past the ${MAX_BITS} bits svjeez draws. Check the numbers.`);
    fields.push({ label, from, to, source: sourceOf(l) });
  }

  if (fields.length === 0)
    return fail(header, 'the packet has no fields. Add lines such as `0-15: "Source Port"`.');

  return {
    kind: "packet",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    fields,
  };
};

export const drawPacket = (
  doc: PacketDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Packet<string> =>
  packet(
    {
      ...(doc.title !== undefined && { title: doc.title }),
      fields: Object.fromEntries(
        doc.fields.map((f, i) => [`field-${i + 1}`, { label: f.label, from: f.from, to: f.to }]),
      ),
    },
    options,
  );
