import type { SyntaxNode } from "@lezer/common";
import { parser as js } from "@lezer/javascript";
import { Effect } from "effect";
import { ParseError } from "./errors.ts";
import { entities, hash, isNumber, isString, unescape } from "./text.ts";
import type {
  Attribute,
  Duplicate,
  Element,
  Files,
  Id,
  Json,
  LiteralKind,
  Parsed,
  Range,
  Ref,
} from "./types.ts";

const parser = js.configure({ dialect: "jsx ts" });

const COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const COMMENTS = new Set(["LineComment", "BlockComment"]);
const PUNCTUATION = new Set(["(", ")", ",", "[", "]", "{", "}"]);

const TAG_NAMES = new Set([
  "JSXIdentifier",
  "JSXBuiltin",
  "JSXMemberExpression",
  "JSXNamespacedName",
]);

const textOf = (src: string, node: SyntaxNode | null | undefined) =>
  node ? src.slice(node.from, node.to) : "";

/** The children of a list, brackets, commas and comments left out. */
const items = (list: SyntaxNode): SyntaxNode[] => {
  const out: SyntaxNode[] = [];

  for (let at = list.firstChild; at; at = at.nextSibling)
    if (!PUNCTUATION.has(at.name) && !COMMENTS.has(at.name) && at.name !== "Spread") out.push(at);

  return out;
};

interface Literal {
  readonly value: Json;
  readonly lit: LiteralKind;
}

const keyOf = (src: string, property: SyntaxNode): string | undefined => {
  const key = property.firstChild;

  if (key?.name === "PropertyDefinition") return textOf(src, key);

  if (key?.name === "String") return unescape(textOf(src, key).slice(1, -1));

  return undefined;
};

const literalOf = (src: string, node: SyntaxNode): Literal | undefined => {
  switch (node.name) {
    case "String": {
      const value = unescape(textOf(src, node).slice(1, -1));

      return { value, lit: COLOR.test(value) ? "color" : "string" };
    }

    case "Number": {
      const value = Number(textOf(src, node).replaceAll("_", ""));

      return Number.isNaN(value) ? undefined : { value, lit: "number" };
    }

    case "UnaryExpression": {
      const sign = textOf(src, node.firstChild);
      const inner = node.lastChild;

      if ((sign !== "-" && sign !== "+") || inner?.name !== "Number") return undefined;
      const number = literalOf(src, inner);

      return number && isNumber(number.value)
        ? { value: sign === "-" ? -number.value : number.value, lit: "number" }
        : undefined;
    }

    case "BooleanLiteral":
      return { value: textOf(src, node) === "true", lit: "boolean" };
    case "null":
      return { value: null, lit: "null" };
    case "ParenthesizedExpression": {
      const inner = items(node)[0];

      return inner ? literalOf(src, inner) : undefined;
    }

    case "MemberExpression":
    case "CallExpression": {
      const text = textOf(src, node);

      return /^ease\.(?:linear|in|out|inOut|pop)$/.test(text) ||
        /^ease\.bezier\(\s*-?[\d.]+(?:\s*,\s*-?[\d.]+){3}\s*\)$/.test(text)
        ? { value: text, lit: "ease" }
        : undefined;
    }

    case "ArrayExpression": {
      const value: Json[] = [];

      for (const item of items(node)) {
        const inner = literalOf(src, item);

        if (!inner) return undefined;
        value.push(inner.value);
      }

      return { value, lit: "json" };
    }

    case "ObjectExpression": {
      const entries: [string, Json][] = [];

      for (const property of items(node)) {
        const key = property.name === "Property" ? keyOf(src, property) : undefined;
        const valueNode = property.lastChild;

        const inner =
          key !== undefined && valueNode && valueNode !== property.firstChild
            ? literalOf(src, valueNode)
            : undefined;

        if (key === undefined || !inner) return undefined;
        entries.push([key, inner.value]);
      }

      // Object.fromEntries defines "__proto__" as an own key; assigning it would change the prototype.
      return { value: Object.fromEntries(entries), lit: "json" };
    }

    default:
      return undefined;
  }
};

/** The `component({ name: "…" })` call the node is written inside, or `""` for scene code. */
const scopeOf = (src: string, node: SyntaxNode): string => {
  for (let at = node.parent; at; at = at.parent) {
    if (at.name !== "CallExpression" || textOf(src, at.firstChild) !== "component") continue;
    const object = at.getChild("ArgList")?.getChild("ObjectExpression");

    for (const property of object ? items(object) : []) {
      if (property.name !== "Property" || keyOf(src, property) !== "name") continue;
      const value = property.lastChild;

      if (value?.name === "String") return unescape(textOf(src, value).slice(1, -1));
    }
  }

  return "";
};

/** The names the functions around the node take as parameters, as `guest` in `({ guest }) => …`. */
const paramsAround = (src: string, node: SyntaxNode): ReadonlySet<string> => {
  const names = new Set<string>();

  for (let at = node.parent; at; at = at.parent) {
    const list = at.getChild("ParamList");

    if (!list) continue;
    list.cursor().iterate((inner) => {
      if (inner.name === "VariableDefinition") names.add(src.slice(inner.from, inner.to));
    });
  }

  return names;
};

const attributeOf = (
  src: string,
  file: string,
  attr: SyntaxNode,
  params: ReadonlySet<string>,
): Attribute => {
  const range = { file, from: attr.from, to: attr.to };
  const text = textOf(src, attr);

  if (attr.name === "JSXSpreadAttribute") return { kind: "spread", name: "...", text, range };
  const name = textOf(src, attr.firstChild);
  const value = attr.firstChild?.nextSibling?.nextSibling;

  if (!value)
    return {
      kind: "literal",
      name,
      lit: "boolean",
      form: "shorthand",
      value: true,
      text: "",
      range,
    };
  const valueRange = { file, from: value.from, to: value.to };
  const valueText = textOf(src, value);

  if (
    value.name === "JSXAttributeValue" &&
    (valueText.startsWith('"') || valueText.startsWith("'"))
  ) {
    const body = entities(valueText.slice(1, -1));

    return {
      kind: "literal",
      name,
      lit: COLOR.test(body) ? "color" : "string",
      form: "string",
      value: body,
      text: valueText,
      range,
      valueRange,
    };
  }

  const inner = value.name === "JSXEscape" ? value.firstChild?.nextSibling : undefined;
  const literal = inner ? literalOf(src, inner) : undefined;

  if (literal)
    return {
      kind: "literal",
      name,
      ...literal,
      form: "expression",
      text: valueText,
      range,
      valueRange,
    };

  const used = [...params].find((param) =>
    new RegExp(`(?<![\\w$.])${param.replaceAll("$", "\\$")}(?![\\w$])`).test(valueText),
  );

  return used === undefined
    ? { kind: "expression", name, text: valueText, range }
    : { kind: "param", name, text: valueText, range, param: used };
};

interface Found {
  readonly element: Omit<Element, "children" | "id" | "parent">;
  /** Where each enclosing element starts, nearest first. */
  readonly ancestors: readonly number[];
}

const lineCol = (text: string, offset: number) => {
  const before = text.slice(0, offset);

  return { line: before.split("\n").length, col: offset - before.lastIndexOf("\n") };
};

const parseFile = (
  file: string,
  src: string,
  found: Found[],
  refs: Ref[],
): ParseError | undefined => {
  const tree = parser.parse(src);
  let failure: ParseError | undefined;

  tree.iterate({
    enter: ({ node, type }) => {
      if (failure) return false;

      if (type.isError) {
        failure = new ParseError({
          file,
          ...lineCol(src, node.from),
          message: "This is not valid TSX.",
        });

        return false;
      }

      if (node.name === "CallExpression" && textOf(src, node.firstChild) === "ref") {
        const arg = node.getChild("ArgList")?.firstChild?.nextSibling;

        if (arg?.name === "String")
          refs.push({
            id: unescape(textOf(src, arg).slice(1, -1)),
            scope: scopeOf(src, node),
            range: { file, from: arg.from, to: arg.to },
          });

        return undefined;
      }

      if (node.name !== "JSXElement") return undefined;
      const open = node.getChild("JSXOpenTag") ?? node.getChild("JSXSelfClosingTag");

      if (!open) return undefined;
      let name: SyntaxNode | undefined;

      for (let at = open.firstChild; at; at = at.nextSibling)
        if (TAG_NAMES.has(at.name)) {
          name = at;
          break;
        }

      if (!name) return undefined;
      const params = paramsAround(src, node);

      const attributes = [
        ...open.getChildren("JSXAttribute"),
        ...open.getChildren("JSXSpreadAttribute"),
      ]
        .sort((a, b) => a.from - b.from)
        .map((attr) => attributeOf(src, file, attr, params));

      const idAttr = attributes.findLast((a) => a.kind === "literal" && a.name === "id");

      if (idAttr?.kind !== "literal" || !isString(idAttr.value) || !idAttr.valueRange)
        return undefined;
      const props: Record<string, Attribute> = {};

      for (const attribute of attributes)
        if (attribute.kind !== "spread") props[attribute.name] = attribute;
      const close = node.getChild("JSXCloseTag");
      const ancestors: number[] = [];

      for (let at = node.parent; at; at = at.parent)
        if (at.name === "JSXElement") ancestors.push(at.from);

      found.push({
        ancestors,
        element: {
          local: idAttr.value,
          scope: scopeOf(src, node),
          component: textOf(src, name),
          range: { file, from: node.from, to: node.to },
          open: { file, from: open.from, to: open.to },
          selfClosing: open.name === "JSXSelfClosingTag",
          nameEnd: name.to,
          closeStart: close?.from ?? node.to,
          idRange: idAttr.valueRange,
          props,
          attributes,
        },
      });

      return undefined;
    },
  });

  return failure;
};

const fullId = (scope: string, local: string): Id => (scope ? `${scope}/${local}` : local);

/**
 * Read files into elements, props and refs. Lezer does the reading, so no code runs. An element is listed when it has
 * a literal `id`; its id is `scope/id` inside a `component({ name: "scope" })` and just `id` in scene code. A prop is
 * a literal (JSON, `ease.out`, a hex color) or read-only: `param`, `expression` or `spread`.
 */
export const parse = (files: Files): Effect.Effect<Parsed, ParseError> =>
  Effect.suspend(() => {
    const found: Found[] = [];
    const refs: Ref[] = [];

    for (const [file, src] of Object.entries(files)) {
      const failure = parseFile(file, src, found, refs);

      if (failure) return Effect.fail(failure);
    }

    // The same file's elements are in source order already, and files keep their order of insertion.
    const owner = new Map<string, Id>();
    const rows = found.map((f) => ({ ...f, id: fullId(f.element.scope, f.element.local) }));

    for (const row of rows)
      owner.set(`${row.element.range.file}:${row.element.range.from}`, row.id);
    const seen = new Map<Id, (typeof rows)[number]>();
    const duplicates: Duplicate[] = [];
    const kept: typeof rows = [];

    for (const row of rows) {
      const first = seen.get(row.id);

      if (first) duplicates.push({ id: row.id, ranges: [first.element.range, row.element.range] });
      else {
        seen.set(row.id, row);
        kept.push(row);
      }
    }

    const parentOf = (row: (typeof rows)[number]): Id | undefined => {
      // The nearest enclosing element that has an id, through any id-less wrappers.
      for (const from of row.ancestors) {
        const id = owner.get(`${row.element.range.file}:${from}`);

        if (id !== undefined) return id;
      }

      return undefined;
    };

    const parents = new Map(kept.map((row) => [row.id, parentOf(row)] as const));
    const children = new Map<Id, Id[]>();

    for (const [id, parent] of parents)
      if (parent !== undefined) children.set(parent, [...(children.get(parent) ?? []), id]);

    const elements = Object.fromEntries(
      kept.map((row) => {
        const parent = parents.get(row.id);

        return [
          row.id,
          {
            ...row.element,
            id: row.id,
            ...(parent !== undefined && { parent }),
            children: children.get(row.id) ?? [],
          } satisfies Element,
        ] as const;
      }),
    );

    return Effect.succeed({
      files,
      hashes: Object.fromEntries(Object.entries(files).map(([file, src]) => [file, hash(src)])),
      order: kept.map((row) => row.id),
      elements,
      refs,
      duplicates,
    });
  });

export const elementOf = (parsed: Parsed, id: Id): Element | undefined =>
  Object.hasOwn(parsed.elements, id) ? parsed.elements[id] : undefined;

/**
 * The elements an id written in `scope` walks through. `card1/note` is `card1`, then `note` inside the component
 * `card1` is an instance of (the element `NoteCard/note`), and so on through nested instances. The first segment
 * is looked up in `scope` before the scene, as core does. Undefined when a segment names no element.
 */
export const chainOf = (
  parsed: Parsed,
  scope: string,
  id: string,
): readonly Element[] | undefined => {
  const [head = "", ...rest] = id.split("/");

  let current =
    (scope ? elementOf(parsed, `${scope}/${head}`) : undefined) ?? elementOf(parsed, head);

  if (!current) return undefined;

  const chain = [current];

  for (const segment of rest) {
    current = elementOf(parsed, `${current.component}/${segment}`);

    if (!current) return undefined;
    chain.push(current);
  }

  return chain;
};

/**
 * The source range of the element a rendered node came from. `svgId` is a `data-svz-id`: an element's id, or a
 * path through component instances (`card1/note`, the `note` inside the component `card1` is an instance of). A
 * path that does not resolve that way falls back to its last segment, when only one element has that id.
 */
export const locate = (parsed: Parsed, svgId: string): Range | undefined => {
  const exact = elementOf(parsed, svgId);

  if (exact) return exact.range;
  const chain = chainOf(parsed, "", svgId);

  if (chain) return chain.at(-1)?.range;
  const last = svgId.slice(svgId.lastIndexOf("/") + 1);
  const matches = parsed.order.map((id) => elementOf(parsed, id)).filter((e) => e?.local === last);

  return matches.length === 1 ? matches[0]?.range : undefined;
};

/** The id of the innermost element that holds `offset` in `file`. */
export const elementAt = (parsed: Parsed, file: string, offset: number): Id | undefined => {
  const here = parsed.order
    .map((id) => elementOf(parsed, id))
    .filter((e) => e?.range.file === file);

  const smallest = (inside: (e: Element) => boolean) =>
    here
      .filter((e): e is Element => !!e && inside(e))
      .sort((a, b) => a.range.to - a.range.from - (b.range.to - b.range.from))[0];

  return (
    smallest((e) => e.range.from <= offset && offset < e.range.to) ??
    smallest((e) => e.range.from <= offset && offset <= e.range.to)
  )?.id;
};
