import {
  architecture,
  type Architecture,
  type ArchitectureIcon,
  type DiagramOptions,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type ArchitectureSideDoc = "L" | "R" | "T" | "B";

export interface ArchitectureGroupDoc {
  readonly id: string;
  readonly icon?: ArchitectureIcon;
  readonly title?: string;
  readonly in?: string;
}

export interface ArchitectureServiceDoc {
  readonly id: string;
  readonly icon?: ArchitectureIcon;
  readonly title: string;
  readonly in?: string;
}

export interface ArchitectureJunctionDoc {
  readonly id: string;
  readonly in?: string;
}

export interface ArchitectureEdgeDoc {
  readonly from: string;
  readonly fromSide: ArchitectureSideDoc;
  readonly to: string;
  readonly toSide: ArchitectureSideDoc;
  readonly label?: string;
  /** Where the arrow head goes. */
  readonly head: "none" | "to" | "from" | "both";
}

export interface ArchitectureDoc {
  readonly kind: "architecture";
  readonly source: Place;
  readonly groups: readonly ArchitectureGroupDoc[];
  readonly services: readonly ArchitectureServiceDoc[];
  readonly junctions: readonly ArchitectureJunctionDoc[];
  readonly edges: readonly ArchitectureEdgeDoc[];
}

const ICONS = new Map<string, ArchitectureIcon>([
  ["cloud", "cloud"],
  ["database", "database"],
  ["disk", "disk"],
  ["internet", "internet"],
  ["server", "server"],
]);

const SUPPORTED =
  "Supported: `group id(icon)[Title]`, `service id(icon)[Title] in group`, `junction id`, and edges `a:R -- L:b`, `a:R --> L:b`, `a:R <-- L:b`, `a:R <--> L:b` or `a:R -[text]- L:b` between the sides L, R, T and B. Icons are cloud, database, disk, internet and server.";

const UNSUPPORTED = /^(title|accTitle|accDescr|align)\b/;
const BLOCK = /^(group|service)\s+([\w-]+)(?:\(([^)]*)\))?(?:\[([^\]]*)\])?(?:\s+in\s+([\w-]+))?$/;
const JUNCTION = /^junction\s+([\w-]+)(?:\s+in\s+([\w-]+))?$/;

const EDGE =
  /^([\w-]+?)(\{group\})?:([LRTB])\s*(<)?(?:--|-\[([^\]]*)\]-)(>)?\s*([LRTB]):([\w-]+?)(\{group\})?$/;

export const parseArchitecture = (header: Line, body: readonly Line[]): ArchitectureDoc => {
  if (header.text !== "architecture-beta")
    return fail(
      header,
      `cannot read the architecture header. Write \`architecture-beta\`. ${SUPPORTED}`,
    );
  const groups: ArchitectureGroupDoc[] = [];
  const services: ArchitectureServiceDoc[] = [];
  const junctions: ArchitectureJunctionDoc[] = [];
  const edges: ArchitectureEdgeDoc[] = [];
  const kinds = new Map<string, "group" | "node">();

  const declare = (l: Line, kind: "group" | "node", id: string, parent: string | undefined) => {
    if (kinds.has(id))
      return fail(
        l,
        `the id ${id} is already used. Give each group, service and junction its own.`,
      );

    if (parent !== undefined && kinds.get(parent) !== "group")
      return fail(
        l,
        kinds.has(parent)
          ? `${parent} is a service, not a group, so nothing can sit in it.`
          : `the group ${parent} does not exist yet. Declare it before the lines that use it.`,
      );
    kinds.set(id, kind);
  };

  for (const l of body) {
    if (UNSUPPORTED.test(l.text))
      return fail(
        l,
        `${l.text.split(/\s/)[0]} is not supported: svjeez positions and themes diagrams itself. ${SUPPORTED}`,
      );

    const block = BLOCK.exec(l.text);

    if (block) {
      const [, word, id, name, raw, parent] = block;
      const icon = name === undefined ? undefined : ICONS.get(name.trim());

      if (name !== undefined && icon === undefined)
        return fail(
          l,
          `the icon ${JSON.stringify(name)} is not available. Use cloud, database, disk, internet or server, or leave the icon out.`,
        );
      const title = raw === undefined ? undefined : clean(unquote(raw));
      declare(l, word === "group" ? "group" : "node", id!, parent);

      if (word === "group")
        groups.push({
          id: id!,
          ...(icon && { icon }),
          ...(title && { title }),
          ...(parent && { in: parent }),
        });
      else
        services.push({
          id: id!,
          ...(icon && { icon }),
          title: title || id!,
          ...(parent && { in: parent }),
        });
      continue;
    }

    const junction = JUNCTION.exec(l.text);

    if (junction) {
      declare(l, "node", junction[1]!, junction[2]);
      junctions.push({ id: junction[1]!, ...(junction[2] && { in: junction[2] }) });
      continue;
    }

    const edge = EDGE.exec(l.text);

    if (!edge) return fail(l, `cannot read this line. ${SUPPORTED}`);
    const [, from, fromGroup, fromSide, back, raw, forward, toSide, to, toGroup] = edge;

    if (fromGroup || toGroup)
      return fail(
        l,
        "edges that start or end on a group border ({group}) are not supported: join the services inside the groups.",
      );

    for (const id of [from!, to!])
      if (kinds.get(id) !== "node")
        return fail(
          l,
          kinds.has(id)
            ? `${id} is a group. Join the services inside it instead.`
            : `${id} is not declared. Declare the service or junction before the edge that joins it.`,
        );

    if (from === to)
      return fail(l, `${from} is joined to itself. Edges join two different blocks.`);
    const label = raw === undefined ? undefined : clean(unquote(raw));

    // SAFETY: EDGE only matches the letters L, R, T and B for a side.
    edges.push({
      from: from!,
      fromSide: fromSide as ArchitectureSideDoc,
      to: to!,
      toSide: toSide as ArchitectureSideDoc,
      ...(label && { label }),
      head: back && forward ? "both" : back ? "from" : forward ? "to" : "none",
    });
  }

  if (services.length === 0)
    return fail(
      header,
      "the architecture has no services. Add a line such as `service api(server)[API]`.",
    );

  return { kind: "architecture", source: sourceOf(header), groups, services, junctions, edges };
};

export const drawArchitecture = (
  doc: ArchitectureDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Architecture =>
  architecture(
    {
      groups: Object.fromEntries(
        doc.groups.map((g) => [g.id, { label: g.title, icon: g.icon, in: g.in }]),
      ),
      services: Object.fromEntries(
        doc.services.map((s) => [s.id, { label: s.title, icon: s.icon, in: s.in }]),
      ),
      junctions: Object.fromEntries(doc.junctions.map((j) => [j.id, { in: j.in }])),
      edges: doc.edges.map(
        (e) => [e.from, e.fromSide, e.to, e.toSide, { label: e.label, head: e.head }] as const,
      ),
    },
    options,
  );
