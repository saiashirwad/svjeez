import { erDiagram, type DiagramOptions, type ErCard, type ErDiagram } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, isDirection, sourceOf, unquote, type Line } from "./errors.ts";
import type { MermaidDirection, Place } from "./types.ts";

export interface MermaidErAttribute {
  readonly type: string;
  readonly name: string;
  readonly keys: readonly ("PK" | "FK" | "UK")[];
  readonly comment?: string;
}

export interface MermaidErEntity {
  readonly id: string;
  readonly label: string;
  readonly attributes: readonly MermaidErAttribute[];
}

export interface MermaidErRelation {
  readonly from: string;
  readonly to: string;
  readonly fromCard: ErCard;
  readonly toCard: ErCard;
  readonly line: "solid" | "dashed";
  readonly label?: string;
}

export interface ErDoc {
  readonly kind: "er";
  readonly source: Place;
  readonly direction: MermaidDirection;
  readonly entities: readonly MermaidErEntity[];
  readonly relations: readonly MermaidErRelation[];
}

const SUPPORTED =
  'Supported: `ENTITY`, `ENTITY { type name PK "comment" }`, `ENTITY["Alias"]`, quoted "entity names", relationships `A ||--o{ B : label` with cardinalities `||` `|o` `o|` `}|` `|{` `}o` `o{` and `--` or `..` lines, and `direction TB`, `LR`, `BT` or `RL`.';

const CARDS = new Map<string, ErCard>([
  ["||", "one"],
  ["|o", "zero-one"],
  ["o|", "zero-one"],
  ["}|", "one-many"],
  ["|{", "one-many"],
  ["}o", "zero-many"],
  ["o{", "zero-many"],
]);

const NAME = String.raw`"[^"]+"|[\w-]+`;
const CARD = String.raw`\|\||\|o|o\||\}\||\|\{|\}o|o\{`;

const RELATION = new RegExp(
  String.raw`^(${NAME})\s+(${CARD})(--|\.\.|\.-|-\.)(${CARD})\s+(${NAME})\s*(?::\s*(.*))?$`,
);

const ENTITY = new RegExp(String.raw`^(${NAME})(?:\s*\[\s*("[^"]*"|[^\]]*)\s*\])?\s*(\{)?$`);
const ATTRIBUTE = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/i;

const UNSUPPORTED = new Map([
  ["style", "svjeez themes diagrams itself"],
  ["classDef", "svjeez themes diagrams itself"],
  ["class", "svjeez themes diagrams itself"],
  ["subgraph", "svjeez does not group entities"],
  ["accTitle", "accessibility text is not read"],
  ["accDescr", "accessibility text is not read"],
  ["title", "a diagram has no title"],
]);

interface Mutable {
  readonly id: string;
  label: string;
  readonly attributes: MermaidErAttribute[];
}

const generics = (text: string): string => text.replace(/~([^~]+)~/g, "<$1>");

export const parseEr = (header: Line, body: readonly Line[]): ErDoc => {
  if (header.text !== "erDiagram") fail(header, "an ER diagram header is just `erDiagram`.");

  const entities = new Map<string, Mutable>();
  const relations: MermaidErRelation[] = [];
  let direction: ErDoc["direction"] = "TB";
  let open: { readonly entity: Mutable; readonly line: Line } | undefined;

  const touch = (name: string): Mutable => {
    const id = unquote(name);
    let e = entities.get(id);

    if (!e) {
      e = { id, label: id, attributes: [] };
      entities.set(id, e);
    }

    return e;
  };

  for (const l of body) {
    if (open) {
      if (l.text === "}") {
        open = undefined;
        continue;
      }

      const m = ATTRIBUTE.exec(l.text);

      if (!m)
        fail(
          l,
          'cannot read this attribute. Write `type name`, optionally followed by PK, FK or UK and a "comment", one per line.',
        );
      open.entity.attributes.push({
        type: generics(m[1]!),
        name: m[2]!,
        keys: (m[3] ?? "")
          .split(",")
          .map((k) => k.trim().toUpperCase())
          .flatMap((k) => (k === "PK" || k === "FK" || k === "UK" ? [k] : [])),
        ...(m[4] && { comment: clean(m[4]) }),
      });
      continue;
    }

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir) {
      if (!isDirection(dir)) fail(l, `direction ${dir} is not one of TB, LR, BT or RL.`);
      direction = dir;
      continue;
    }

    const rel = RELATION.exec(l.text);

    if (rel) {
      const [, from, left, dots, right, to, label] = rel;

      if (label === undefined)
        fail(l, "a relationship needs a label after `:`, as in `A ||--o{ B : places`.");
      const text = clean(unquote(label));
      touch(from!);
      touch(to!);
      relations.push({
        from: unquote(from!),
        to: unquote(to!),
        fromCard: CARDS.get(left!)!,
        toCard: CARDS.get(right!)!,
        line: dots === "--" ? "solid" : "dashed",
        ...(text && { label: text }),
      });
      continue;
    }

    const word = /^\w+/.exec(l.text)?.[0];

    const why = word && UNSUPPORTED.get(word);

    if (why && /^\w+(\s|:)/.test(l.text)) fail(l, `${word} is not supported: ${why}. ${SUPPORTED}`);

    if (l.text.includes(":::"))
      fail(l, "`:::` style classes are not supported: svjeez themes diagrams itself.");

    if (/\s(to|optionally to)\s/.test(l.text))
      fail(
        l,
        `word cardinalities such as \`one or more\` are not supported. Use the symbols \`||\` \`|o\` \`}|\` \`}o\` \`|{\` \`o{\` \`o|\`. ${SUPPORTED}`,
      );

    const decl = ENTITY.exec(l.text);

    if (decl) {
      const [, name, alias, brace] = decl;
      const e = touch(name!);

      if (alias !== undefined) e.label = clean(unquote(alias)) || e.id;

      if (brace) open = { entity: e, line: l };
      continue;
    }

    fail(l, `cannot read this line. ${SUPPORTED}`);
  }

  if (open)
    fail(
      open.line,
      `entity ${JSON.stringify(open.entity.id)} is never closed. Add \`}\` after its attributes.`,
    );

  if (entities.size === 0) fail(header, "the ER diagram has no entities.");

  return {
    kind: "er",
    source: sourceOf(header),
    direction,
    entities: [...entities.values()],
    relations,
  };
};

export interface ErDrawOptions extends DiagramOptions {
  readonly direction?: MermaidDirection;
  readonly reveal?: Span;
}

export const drawEr = (doc: ErDoc, options: ErDrawOptions): ErDiagram<string> => {
  const { direction, ...rest } = options;

  return erDiagram(
    {
      entities: Object.fromEntries(
        doc.entities.map((e) => [e.id, { label: e.label, attributes: e.attributes }]),
      ),
      relations: doc.relations,
    },
    { ...rest, direction: direction ?? doc.direction },
  );
};
