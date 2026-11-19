import { sankey, type DiagramOptions, type Sankey } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface SankeyLinkDoc {
  readonly from: string;
  readonly to: string;
  readonly value: number;
}

export interface SankeyDoc {
  readonly kind: "sankey";
  readonly source: Place;
  /** In order of first appearance. */
  readonly nodes: readonly string[];
  readonly links: readonly SankeyLinkDoc[];
}

const SUPPORTED =
  'Supported: one `source,target,value` row per link, with a name in "double quotes" when it holds a comma.';

const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;

const fieldsOf = (text: string): string[] | undefined => {
  const fields: string[] = [];
  let i = 0;

  for (;;) {
    while (text[i] === " ") i++;
    let field = "";

    if (text[i] === '"') {
      i++;

      for (;;) {
        if (i >= text.length) return undefined;

        if (text[i] === '"' && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else field += text[i++];
      }

      while (text[i] === " ") i++;

      if (i < text.length && text[i] !== ",") return undefined;
    } else {
      const end = text.indexOf(",", i);
      field = text.slice(i, end < 0 ? undefined : end).trim();
      i = end < 0 ? text.length : end;
    }

    fields.push(field);

    if (i >= text.length) return fields;
    i++;
  }
};

export const parseSankey = (header: Line, body: readonly Line[]): SankeyDoc => {
  if (!/^sankey(?:-beta)?$/.test(header.text))
    return fail(header, `cannot read the sankey header. Write \`sankey-beta\`. ${SUPPORTED}`);
  const nodes: string[] = [];
  const links: SankeyLinkDoc[] = [];
  const after = new Map<string, string[]>();

  for (const l of body) {
    const fields = fieldsOf(l.text);

    if (!fields) return fail(l, `a quoted name is not closed. ${SUPPORTED}`);

    if (fields.length !== 3)
      return fail(
        l,
        `a link has 3 fields (source,target,value), found ${fields.length}. ${SUPPORTED}`,
      );
    const [from, to, raw] = [clean(fields[0]!), clean(fields[1]!), fields[2]!];

    if (from === "" || to === "") return fail(l, "a link needs a name for both ends.");

    if (!NUMBER.test(raw))
      return fail(
        l,
        raw.startsWith("-")
          ? `the value ${raw} is negative. A flow has a size, so write a number above 0.`
          : `the value ${JSON.stringify(raw)} is not a number. Write it as a plain number such as 42 or 4.5.`,
      );
    const value = Number(raw);

    if (!(value > 0)) return fail(l, "a flow of 0 draws nothing. Write a value above 0.");

    if (from === to)
      return fail(l, `"${from}" flows into itself. Sankey flows run between two different nodes.`);

    const seen = new Set<string>();
    const stack = [to];

    for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
      if (n === from)
        return fail(
          l,
          `this link closes a loop between "${from}" and "${to}". Sankey flows run one way: remove the link that leads back.`,
        );

      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...(after.get(n) ?? []));
    }

    for (const name of [from, to]) if (!nodes.includes(name)) nodes.push(name);
    after.set(from, [...(after.get(from) ?? []), to]);
    links.push({ from, to, value });
  }

  if (links.length === 0)
    return fail(header, "the sankey has no links. Add rows such as `Coal,Power,40`.");

  return { kind: "sankey", source: sourceOf(header), nodes, links };
};

export const drawSankey = (
  doc: SankeyDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Sankey => {
  const used = new Set(doc.nodes.filter((name) => !name.includes("/")));

  const ids = new Map(
    doc.nodes.map((name, i) => {
      let id = name.includes("/") ? `node-${i + 1}` : name;

      while (used.has(id) && id !== name) id += "'";
      used.add(id);

      return [name, id] as const;
    }),
  );

  return sankey(
    {
      nodes: Object.fromEntries(doc.nodes.map((name) => [ids.get(name)!, name])),
      links: doc.links.map((k) => [ids.get(k.from)!, ids.get(k.to)!, k.value] as const),
    },
    options,
  );
};
