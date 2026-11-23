import type { SyntaxNode } from "@lezer/common";
import { parser as js } from "@lezer/javascript";
import { Effect } from "effect";
import { ParseError } from "./errors.ts";
import { canonical, isRelative, resolveRelative } from "./paths.ts";
import { entities, hash, isNumber, isString, unescape } from "./text.ts";
import type {
  Attribute,
  Definition,
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

/**
 * Offsets of the line breaks inside a template literal, a multi-line string or a JSX attribute string. The spaces after
 * one are part of the value, so a move that re-indents the text around them must leave them alone.
 */
export const verbatimBreaks = (text: string): ReadonlySet<number> => {
  const breaks = new Set<number>();

  parser.parse(text).iterate({
    enter: ({ name, from, to }) => {
      if (name !== "TemplateString" && name !== "String" && name !== "JSXAttributeValue") return;

      for (let at = text.indexOf("\n", from); at !== -1 && at < to; at = text.indexOf("\n", at + 1))
        breaks.add(at);
    },
  });

  return breaks;
};

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

/** The items of an array literal, or undefined when it has a hole (`[1, , 3]`) or a spread, which no JSON value says. */
const arrayItems = (list: SyntaxNode): SyntaxNode[] | undefined => {
  const out: SyntaxNode[] = [];
  let wanted = true;

  for (let at = list.firstChild; at; at = at.nextSibling) {
    if (COMMENTS.has(at.name) || at.name === "[" || at.name === "]") continue;

    if (at.name === ",") {
      if (wanted) return undefined;
      wanted = true;
    } else if (at.name === "Spread") return undefined;
    else {
      out.push(at);
      wanted = false;
    }
  }

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
      const listed = arrayItems(node);

      if (!listed) return undefined;

      for (const item of listed) {
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

const DEFAULT = "default";

/** What a `component(…)` call is bound to: the `const` it initialises, or `default` for `export default component(…)`. Undefined when the node is no such call or is bound to nothing. */
const bindingOf = (src: string, call: SyntaxNode | null | undefined): string | undefined => {
  if (call?.name !== "CallExpression" || textOf(src, call.firstChild) !== "component")
    return undefined;
  const { parent } = call;

  if (parent?.name === "VariableDeclaration") {
    const local = parent.getChild("VariableDefinition");

    return local ? textOf(src, local) : undefined;
  }

  return parent?.name === "ExportDeclaration" ? DEFAULT : undefined;
};

/** `file#binding` of the `component(…)` the node is written inside, or `""` for scene code. */
const scopeOf = (src: string, file: string, node: SyntaxNode): string => {
  for (let at = node.parent; at; at = at.parent) {
    const binding = bindingOf(src, at);

    if (binding !== undefined) return `${file}#${binding}`;
  }

  return "";
};

/** What a file says about the names its components go by, before any other file is read. */
interface Facts {
  /** The local names bound to a `component(…)`. */
  readonly components: Set<string>;
  /** What the file exports: the exported name, and the local name it stands for. */
  readonly exports: Map<string, string>;
  /** `import { imported as local } from "from"`. `imported` is `*` for a namespace and `default` for a default import. */
  readonly imports: Map<string, { readonly imported: string; readonly from: string }>;
}

const factsOf = (src: string, root: SyntaxNode): Facts => {
  const facts: Facts = { components: new Set(), exports: new Map(), imports: new Map() };

  const visit = (node: SyntaxNode) => {
    if (node.name === "ImportDeclaration") {
      const from = node.getChild("String");
      const specifier = from ? unescape(textOf(src, from).slice(1, -1)) : undefined;

      if (specifier === undefined) return;

      for (let at = node.firstChild; at; at = at.nextSibling) {
        // A default import. The name after `* as` is a namespace, which the `Star` below takes.
        if (at.name === "VariableDefinition" && at.prevSibling?.name !== "as")
          facts.imports.set(textOf(src, at), { imported: DEFAULT, from: specifier });

        if (at.name === "Star") {
          const local = at.nextSibling?.nextSibling;

          if (local) facts.imports.set(textOf(src, local), { imported: "*", from: specifier });
        }

        if (at.name !== "ImportGroup") continue;
        let imported: string | undefined;

        for (let name = at.firstChild; name; name = name.nextSibling)
          if (name.name === "VariableName") imported = textOf(src, name);
          else if (name.name === "VariableDefinition") {
            facts.imports.set(textOf(src, name), {
              imported: imported ?? textOf(src, name),
              from: specifier,
            });
            imported = undefined;
          }
      }
    } else if (node.name === "VariableDeclaration") {
      const local = node.getChild("VariableDefinition");
      const binding = bindingOf(src, node.getChild("CallExpression"));

      if (local && binding !== undefined) {
        facts.components.add(binding);

        if (node.parent?.name === "ExportDeclaration")
          facts.exports.set(textOf(src, local), textOf(src, local));
      }
    } else if (node.name === "ExportDeclaration" && !node.getChild("from")) {
      const group = node.getChild("ExportGroup");

      if (group) {
        let names: string[] = [];

        const flush = () => {
          const [local, exported = local] = names;

          if (local !== undefined) facts.exports.set(exported ?? local, local);
          names = [];
        };

        for (let name = group.firstChild; name; name = name.nextSibling)
          if (name.name === "VariableName") names.push(textOf(src, name));
          else if (name.name === ",") flush();
        flush();
      } else if (node.getChild("default")) {
        const variable = node.getChild("VariableName");

        if (bindingOf(src, node.getChild("CallExpression")) !== undefined) {
          facts.components.add(DEFAULT);
          facts.exports.set(DEFAULT, DEFAULT);
        } else if (variable) facts.exports.set(DEFAULT, textOf(src, variable));
      }
    }
  };

  const cursor = root.cursor();

  do visit(cursor.node);
  while (cursor.next());

  return facts;
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

interface Read {
  readonly failure?: ParseError;
  readonly facts: Facts;
  /** The deepest nesting of JSX elements, ids or not. */
  readonly depth: number;
}

const parseFile = (file: string, src: string, found: Found[], refs: Ref[]): Read => {
  const tree = parser.parse(src);
  let failure: ParseError | undefined;
  let depth = 0;
  let deepest = 0;

  tree.iterate({
    leave: ({ name }) => {
      if (name === "JSXElement") depth--;
    },
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
            scope: scopeOf(src, file, node),
            range: { file, from: arg.from, to: arg.to },
          });

        return undefined;
      }

      if (node.name !== "JSXElement") return undefined;
      deepest = Math.max(deepest, ++depth);
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

      const written = [
        ...open.getChildren("JSXAttribute"),
        ...open.getChildren("JSXSpreadAttribute"),
      ]
        .sort((a, b) => a.from - b.from)
        .map((attr) => attributeOf(src, file, attr, params));

      // JSX takes the last of two attributes with one name, so that is the id.
      const idAttr = written.findLast((a) => a.name === "id");

      if (idAttr?.kind !== "literal" || !isString(idAttr.value) || !idAttr.valueRange)
        return undefined;
      const lastSpread = written.findLastIndex((a) => a.kind === "spread");

      // A `{...spread}` after a prop may carry the same name, so the literal is not what the prop will be.
      const attributes = written.map((attribute, i): Attribute =>
        attribute.kind === "literal" && attribute.name !== "id" && i < lastSpread
          ? {
              kind: "spread",
              name: attribute.name,
              text: src.slice(attribute.range.from, attribute.range.to),
              range: attribute.range,
            }
          : attribute,
      );

      const props = Object.fromEntries(
        attributes.flatMap((attribute) =>
          attribute.kind === "spread" && attribute.name === "..."
            ? []
            : [[attribute.name, attribute] as const],
        ),
      );

      const close = node.getChild("JSXCloseTag");
      const ancestors: number[] = [];

      for (let at = node.parent; at; at = at.parent)
        if (at.name === "JSXElement") ancestors.push(at.from);

      found.push({
        ancestors,
        element: {
          local: idAttr.value,
          scope: scopeOf(src, file, node),
          component: textOf(src, name),
          range: { file, from: node.from, to: node.to },
          open: { file, from: open.from, to: open.to },
          selfClosing: open.name === "JSXSelfClosingTag",
          nameEnd: name.to,
          closeStart: close?.from ?? node.to,
          idRange: idAttr.valueRange,
          childRanges: [...node.getChildren("JSXElement"), ...node.getChildren("JSXEscape")]
            .sort((a, b) => a.from - b.from)
            .map((child) => ({ file, from: child.from, to: child.to })),
          props,
          attributes,
        },
      });

      return undefined;
    },
  });

  return { ...(failure && { failure }), facts: factsOf(src, tree.topNode), depth: deepest };
};

const fullId = (scope: string, local: string): Id => (scope ? `${scope}/${local}` : local);

/** What each tag stands for in each file, for the tags that name a component: where it is defined, and the key of its export in `Program.components`. */
const definitionsOf = (
  files: ReadonlyMap<string, Facts>,
  tags: ReadonlyMap<string, ReadonlySet<string>>,
): Parsed["definitions"] => {
  const paths = new Map([...files.keys()].map((file) => [canonical(file), file] as const));

  const exported = (file: string, from: string, name: string): Definition => {
    const other = isRelative(from)
      ? paths.get(resolveRelative((path) => paths.has(path), canonical(file), from) ?? "")
      : undefined;

    if (other === undefined) return { key: `${from}#${name}` };
    const facts = files.get(other);
    const binding = facts?.exports.get(name);

    return {
      key: `${canonical(other)}#${name}`,
      ...(binding !== undefined &&
        facts?.components.has(binding) && { scope: `${other}#${binding}` }),
    };
  };

  return Object.fromEntries(
    [...tags].map(([file, used]) => {
      const facts = files.get(file);

      const found = [...used].flatMap((tag): [string, Definition][] => {
        const [head = "", member] = tag.split(/\.(.*)/s);
        const space = member === undefined ? undefined : facts?.imports.get(head);

        if (space?.imported === "*" && member !== undefined)
          return [[tag, exported(file, space.from, member)]];

        if (facts?.components.has(tag)) {
          const name = [...facts.exports].find(([, local]) => local === tag)?.[0] ?? tag;

          return [[tag, { key: `${canonical(file)}#${name}`, scope: `${file}#${tag}` }]];
        }

        const use = facts?.imports.get(tag);

        return use ? [[tag, exported(file, use.from, use.imported)]] : [];
      });

      return [file, Object.fromEntries(found)] as const;
    }),
  );
};

/**
 * Read files into elements, props and refs. Lezer does the reading, so no code runs. An element is listed when it has
 * a literal `id`; its id is `file#binding/id` inside a `component(…)` bound to `binding` and just `id` in scene code. A prop is
 * a literal (JSON, `ease.out`, a hex color) or read-only: `param`, `expression` or `spread`.
 */
export const parse = (files: Files): Effect.Effect<Parsed, ParseError> =>
  Effect.suspend(() => {
    const found: Found[] = [];
    const refs: Ref[] = [];
    const facts = new Map<string, Facts>();
    let maxDepth = 0;

    for (const [file, src] of Object.entries(files)) {
      const read = parseFile(file, src, found, refs);

      if (read.failure) return Effect.fail(read.failure);
      facts.set(file, read.facts);
      maxDepth = Math.max(maxDepth, read.depth);
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

    const tags = new Map<string, Set<string>>();

    for (const row of found) {
      const file = row.element.range.file;

      tags.set(file, (tags.get(file) ?? new Set()).add(row.element.component));
    }

    return Effect.succeed({
      files,
      maxDepth,
      definitions: definitionsOf(facts, tags),
      hashes: Object.fromEntries(Object.entries(files).map(([file, src]) => [file, hash(src)])),
      order: kept.map((row) => row.id),
      elements,
      refs,
      duplicates,
    });
  });

/** What the tag an element is written with stands for: the key of its component in `Program.components`, and the scope its elements' ids have when its source is among the files. */
export const definitionOf = (
  parsed: Parsed,
  element: Pick<Element, "component" | "range">,
): Definition | undefined => {
  const file = parsed.definitions[element.range.file];

  return file && Object.hasOwn(file, element.component) ? file[element.component] : undefined;
};

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
    const inside: string | undefined = definitionOf(parsed, current)?.scope;

    current = inside === undefined ? undefined : elementOf(parsed, `${inside}/${segment}`);

    if (!current) return undefined;
    chain.push(current);
  }

  return chain;
};

/**
 * The source range of the element a rendered node came from. `svgId` is a `data-svz-id`: an element's id, or a
 * path through component instances (`card1/note`, the `note` inside the component `card1` is an instance of).
 * Undefined when a segment of the path names no element, rather than a guess at the last one.
 */
export const locate = (parsed: Parsed, svgId: string): Range | undefined =>
  (elementOf(parsed, svgId) ?? chainOf(parsed, "", svgId)?.at(-1))?.range;

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
