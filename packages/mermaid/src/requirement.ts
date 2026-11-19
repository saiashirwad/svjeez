import {
  requirementDiagram,
  type DiagramOptions,
  type RequirementDiagram,
  type RequirementLink,
  type RequirementNode,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type RequirementKind =
  | "requirement"
  | "functionalRequirement"
  | "interfaceRequirement"
  | "performanceRequirement"
  | "physicalRequirement"
  | "designConstraint";

export interface MermaidRequirement {
  readonly id: string;
  readonly kind: RequirementKind;
  /** The `id:` field. */
  readonly reqId: string;
  readonly text: string;
  readonly risk: string;
  readonly verifyMethod: string;
  readonly source: Place;
}

export interface MermaidRequirementElement {
  readonly id: string;
  readonly type: string;
  readonly docRef: string;
  readonly source: Place;
}

export interface MermaidRequirementRelation {
  readonly from: string;
  readonly to: string;
  readonly type: RequirementLink;
}

export interface RequirementDoc {
  readonly kind: "requirement";
  readonly source: Place;
  readonly direction: "TB" | "LR";
  readonly requirements: readonly MermaidRequirement[];
  readonly elements: readonly MermaidRequirementElement[];
  readonly relations: readonly MermaidRequirementRelation[];
}

const SUPPORTED =
  "Supported: `requirement name { id: 1 text: ... risk: high verifymethod: test }` (also functionalRequirement, interfaceRequirement, performanceRequirement, physicalRequirement, designConstraint), `element name { type: x docref: y }`, relationships `a - satisfies -> b` or `b <- satisfies - a` (contains, copies, derives, satisfies, verifies, refines, traces), and `direction TB` or `LR`.";

const TITLES: Readonly<Record<RequirementKind, string>> = {
  requirement: "Requirement",
  functionalRequirement: "Functional Requirement",
  interfaceRequirement: "Interface Requirement",
  performanceRequirement: "Performance Requirement",
  physicalRequirement: "Physical Requirement",
  designConstraint: "Design Constraint",
};

const RISKS = ["low", "medium", "high"];
const METHODS = ["analysis", "inspection", "test", "demonstration"];

const LINKS: readonly RequirementLink[] = [
  "contains",
  "copies",
  "derives",
  "satisfies",
  "verifies",
  "refines",
  "traces",
];

const NAME = String.raw`"[^"]+"|[^\s{}"<>-][^\s{}"<>]*`;
const KIND = new RegExp(String.raw`^(${Object.keys(TITLES).join("|")})\s+(${NAME})\s*(\{)?$`);
const ELEMENT = new RegExp(String.raw`^element\s+(${NAME})\s*(\{)?$`);
const FORWARD = new RegExp(String.raw`^(${NAME})\s+-\s*(\w+)\s*->\s*(${NAME})$`);
const BACKWARD = new RegExp(String.raw`^(${NAME})\s+<-\s*(\w+)\s*-\s+(${NAME})$`);
const FIELD = /^(\w+)\s*:\s*(.*)$/;

const UNSUPPORTED = new Map([
  ["style", "svjeez themes diagrams itself"],
  ["classDef", "svjeez themes diagrams itself"],
  ["class", "svjeez themes diagrams itself"],
  ["accTitle", "accessibility text is not read"],
  ["accDescr", "accessibility text is not read"],
  ["title", "a diagram has no title"],
]);

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

interface Open {
  readonly header: Line;
  readonly name: string;
  readonly kind: RequirementKind | "element";
  readonly fields: Map<string, string>;
}

const link = (l: Line, word: string): RequirementLink => {
  const found = LINKS.find((t) => t === word.toLowerCase());

  return (
    found ??
    fail(l, `${JSON.stringify(word)} is not a relationship. Use one of ${LINKS.join(", ")}.`)
  );
};

export const parseRequirement = (header: Line, body: readonly Line[]): RequirementDoc => {
  if (header.text !== "requirementDiagram")
    return fail(header, "a requirement diagram header is just `requirementDiagram`.");

  const requirements: MermaidRequirement[] = [];
  const elements: MermaidRequirementElement[] = [];
  const relations: [Line, MermaidRequirementRelation][] = [];
  const names = new Map<string, Line>();
  let direction: RequirementDoc["direction"] = "TB";
  let open: Open | undefined;
  let waiting: Open | undefined;

  const declare = (l: Line, raw: string, kind: Open["kind"], brace: boolean): void => {
    const name = unquote(raw);

    if (names.has(name))
      fail(l, `the name ${JSON.stringify(name)} is already used. Give each node its own name.`);

    if (name.includes("/")) fail(l, 'a name cannot contain "/".');
    names.set(name, l);
    const next: Open = { header: l, name, kind, fields: new Map() };

    if (brace) open = next;
    else waiting = next;
  };

  const close = (o: Open): void => {
    const at = sourceOf(o.header);

    const known = (allowed: readonly string[]): string[] =>
      [...o.fields.keys()].filter((k) => !allowed.includes(k));

    const check = (allowed: readonly string[]): void => {
      const bad = known(allowed)[0];

      if (bad !== undefined)
        fail(o.header, `${JSON.stringify(bad)} is not a field of this ${o.kind}. ${SUPPORTED}`);
    };

    const field = (key: string): string => o.fields.get(key) ?? "";

    if (o.kind === "element") {
      check(["type", "docref"]);
      elements.push({ id: o.name, type: field("type"), docRef: field("docref"), source: at });

      return;
    }

    check(["id", "text", "risk", "verifymethod"]);
    const risk = field("risk").toLowerCase();
    const method = field("verifymethod").toLowerCase();

    if (risk !== "" && !RISKS.includes(risk))
      fail(o.header, `risk ${JSON.stringify(field("risk"))} is not one of ${RISKS.join(", ")}.`);

    if (method !== "" && !METHODS.includes(method))
      fail(
        o.header,
        `verifymethod ${JSON.stringify(field("verifymethod"))} is not one of ${METHODS.join(", ")}.`,
      );
    requirements.push({
      id: o.name,
      kind: o.kind,
      reqId: field("id"),
      text: field("text"),
      risk: capital(risk),
      verifyMethod: capital(method),
      source: at,
    });
  };

  for (const l of body) {
    if (waiting) {
      if (l.text !== "{") fail(waiting.header, "a block needs `{` after its name.");
      open = waiting;
      waiting = undefined;
      continue;
    }

    if (open) {
      if (l.text === "}") {
        close(open);
        open = undefined;
        continue;
      }

      const m = FIELD.exec(l.text);

      if (!m) fail(l, "cannot read this field. Write `key: value`, one per line.");
      const key = m[1]!.toLowerCase();

      if (open.fields.has(key)) fail(l, `the field ${JSON.stringify(m[1])} is given twice.`);
      open.fields.set(key, clean(unquote(m[2]!)));
      continue;
    }

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir) {
      if (dir !== "TB" && dir !== "LR")
        fail(
          l,
          "svjeez lays requirement diagrams out top to bottom or left to right. Write `direction TB` or `direction LR`.",
        );
      direction = dir;
      continue;
    }

    if (l.text.includes(":::"))
      fail(l, "`:::` style classes are not supported: svjeez themes diagrams itself.");

    const kind = KIND.exec(l.text);

    if (kind) {
      // SAFETY: the pattern only matches the keys of TITLES.
      declare(l, kind[2]!, kind[1] as RequirementKind, kind[3] !== undefined);
      continue;
    }

    const el = ELEMENT.exec(l.text);

    if (el) {
      declare(l, el[1]!, "element", el[2] !== undefined);
      continue;
    }

    const forward = FORWARD.exec(l.text);
    const backward = forward ? undefined : BACKWARD.exec(l.text);

    if (forward || backward) {
      const [from, word, to] = forward
        ? [forward[1]!, forward[2]!, forward[3]!]
        : [backward![3]!, backward![2]!, backward![1]!];

      relations.push([l, { from: unquote(from), to: unquote(to), type: link(l, word) }]);
      continue;
    }

    const word = /^\w+/.exec(l.text)?.[0];
    const why = word && UNSUPPORTED.get(word);

    if (why) fail(l, `${word} is not supported: ${why}. ${SUPPORTED}`);

    fail(l, `cannot read this line. ${SUPPORTED}`);
  }

  if (waiting) fail(waiting.header, "a block needs `{` after its name.");

  if (open)
    fail(open.header, `${JSON.stringify(open.name)} is never closed. Add \`}\` after its fields.`);

  if (names.size === 0) fail(header, "the requirement diagram has no requirements or elements.");

  for (const [l, r] of relations)
    for (const end of [r.from, r.to])
      if (!names.has(end))
        fail(l, `${JSON.stringify(end)} is not a requirement or element. Declare it first.`);

  return {
    kind: "requirement",
    source: sourceOf(header),
    direction,
    requirements,
    elements,
    relations: relations.map(([, r]) => r),
  };
};

export interface RequirementDrawOptions extends DiagramOptions {
  readonly direction?: "TB" | "LR";
  readonly reveal?: Span;
}

export const drawRequirement = (
  doc: RequirementDoc,
  options: RequirementDrawOptions,
): RequirementDiagram<string> => {
  const { direction, ...rest } = options;

  const fields = (pairs: readonly (readonly [string, string])[]) =>
    pairs.filter(([, value]) => value !== "");

  const nodes: [string, RequirementNode][] = [
    ...doc.requirements.map((r): [string, RequirementNode] => [
      r.id,
      {
        stereotype: TITLES[r.kind],
        fields: fields([
          ["ID", r.reqId],
          ["Text", r.text],
          ["Risk", r.risk],
          ["Verification", r.verifyMethod],
        ]),
      },
    ]),
    ...doc.elements.map((e): [string, RequirementNode] => [
      e.id,
      {
        stereotype: "Element",
        kind: "element",
        fields: fields([
          ["Type", e.type],
          ["Doc Ref", e.docRef],
        ]),
      },
    ]),
  ];

  return requirementDiagram(
    { nodes: Object.fromEntries(nodes), relations: doc.relations },
    { ...rest, direction: direction ?? doc.direction },
  );
};
