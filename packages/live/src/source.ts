import type { SyntaxNode, Tree } from "@lezer/common";
import { highlightTree, tagHighlighter, tags, type Tag } from "@lezer/highlight";
import { parser as js } from "@lezer/javascript";
import { ease, type Ease, type Hex } from "svjeez";

const parser = js.configure({ dialect: "jsx ts" });

export type Range = readonly [from: number, to: number];

export const KINDS = {
  keyword: [
    tags.keyword,
    tags.definitionKeyword,
    tags.moduleKeyword,
    tags.controlKeyword,
    tags.operatorKeyword,
  ],
  string: [tags.string, tags.regexp],
  number: [tags.number, tags.bool, tags.null],
  comment: [tags.comment, tags.lineComment, tags.blockComment],
  fn: [tags.function(tags.variableName), tags.function(tags.propertyName)],
  definition: [tags.definition(tags.variableName), tags.typeName, tags.className],
  tag: [tags.tagName, tags.angleBracket],
  attr: [tags.attributeName],
  punct: [tags.punctuation, tags.operator, tags.bracket, tags.separator],
} as const satisfies Record<string, readonly Tag[]>;

export type Kind = keyof typeof KINDS | "plain";

export interface Run {
  readonly range: Range;
  readonly kind: Kind;
}

const isKind = (cls: string): cls is keyof typeof KINDS => cls in KINDS;

const highlighter = tagHighlighter(
  Object.entries(KINDS).map(([kind, tag]) => ({ tag: [...tag], class: kind })),
);

const runsOf = (tree: Tree): Run[] => {
  const out: Run[] = [];

  highlightTree(tree, highlighter, (from, to, cls) =>
    out.push({ range: [from, to], kind: isKind(cls) ? cls : "plain" }),
  );

  return out;
};

export type Role =
  | { readonly kind: "attribute"; readonly name: string; readonly tag: string }
  | { readonly kind: "argument"; readonly callee: string; readonly index: number }
  | { readonly kind: "property"; readonly name: string }
  | { readonly kind: "const"; readonly name: string }
  | { readonly kind: "other" };

export type PathStep = string | number;

export type EaseName = "linear" | "in" | "out" | "inOut" | "pop";

interface LiteralBase {
  readonly key: string;
  readonly range: Range;
  readonly text: string;
  readonly role: Role;
  readonly path?: readonly PathStep[];
  readonly param?: { readonly key: string; readonly option?: string };
}

export type Literal =
  | (LiteralBase & { readonly kind: "number"; readonly value: number })
  | (LiteralBase & { readonly kind: "color"; readonly value: Hex; readonly jsx?: true })
  | (LiteralBase & {
      readonly kind: "string";
      /** What the string holds, escapes read, so `'a\\n'` holds a newline. A JSX attribute has no escapes, so it holds its text. */
      readonly value: string;
      /** Set for a JSX attribute's quoted value, `fill="red"`, whose text has no escapes. */
      readonly jsx?: true;
    })
  | (LiteralBase & {
      readonly kind: "ease";
      readonly value: Ease;
      readonly name: EaseName | "bezier";
    });

export type LiteralOf<K extends Literal["kind"]> = Extract<Literal, { kind: K }>;

const ARITHMETIC = new Set(["UnaryExpression", "BinaryExpression", "ParenthesizedExpression"]);
const PUNCTUATION = new Set(["(", ")", ",", "[", "]", "{", "}"]);
const NAMED_EASES = new Set<string>(["linear", "in", "out", "inOut", "pop"]);

const isNamedEase = (name: string): name is EaseName => NAMED_EASES.has(name);

const textOf = (src: string, node: SyntaxNode | null | undefined) =>
  node ? src.slice(node.from, node.to) : "";

const items = (list: SyntaxNode): SyntaxNode[] => {
  const out: SyntaxNode[] = [];

  for (let at = list.firstChild; at; at = at.nextSibling)
    if (!PUNCTUATION.has(at.name) && at.name !== "Spread") out.push(at);

  return out;
};

const calleeOf = (src: string, call: SyntaxNode) => {
  const callee = call.firstChild;

  return callee?.name === "MemberExpression" ? textOf(src, callee.lastChild) : textOf(src, callee);
};

const outer = (node: SyntaxNode) => {
  let at = node;

  while (at.parent && ARITHMETIC.has(at.parent.name)) at = at.parent;

  return at;
};

const nameOfProperty = (src: string, property: SyntaxNode) =>
  textOf(src, property.getChild("PropertyDefinition") ?? property.firstChild).replace(
    /^["']|["']$/g,
    "",
  );

const attributeRole = (src: string, attr: SyntaxNode): Role => {
  const tag = attr.parent?.getChild("JSXBuiltin") ?? attr.parent?.getChild("JSXIdentifier");

  return { kind: "attribute", name: textOf(src, attr.firstChild), tag: textOf(src, tag) };
};

const roleOf = (src: string, literal: SyntaxNode): Role => {
  const at = outer(literal);
  const context = at.parent;

  switch (context?.name) {
    case "VariableDeclaration":
      return { kind: "const", name: textOf(src, context.getChild("VariableDefinition")) };
    case "Property":
      return { kind: "property", name: nameOfProperty(src, context) };
    case "JSXAttribute":
      return attributeRole(src, context);
    case "JSXEscape":
      return context.parent?.name === "JSXAttribute"
        ? attributeRole(src, context.parent)
        : { kind: "other" };

    case "ArgList":
      return {
        kind: "argument",
        callee: calleeOf(src, context.parent!),
        index: items(context).findIndex((n) => n.from === at.from),
      };
    default:
      return { kind: "other" };
  }
};

const isTopLevel = (node: SyntaxNode) => {
  const up = node.parent?.name === "ExportDeclaration" ? node.parent : node;

  return !up.parent?.parent;
};

const pathOf = (src: string, literal: SyntaxNode): PathStep[] | undefined => {
  const path: PathStep[] = [];
  let at = outer(literal);

  for (;;) {
    const up = at.parent;

    if (!up) return undefined;

    if (up.name === "ArrayExpression") path.unshift(items(up).findIndex((n) => n.from === at.from));
    else if (up.name === "Property") path.unshift(nameOfProperty(src, up));
    else if (up.name === "VariableDeclaration") {
      if (!isTopLevel(up)) return undefined;
      path.unshift(textOf(src, up.getChild("VariableDefinition")));

      return path;
    } else if (up.name !== "ObjectExpression") return undefined;
    at = up;
  }
};

const paramsObject = (src: string, tree: Tree): SyntaxNode | undefined => {
  for (const exported of tree.topNode.getChildren("ExportDeclaration")) {
    const declaration = exported.getChild("VariableDeclaration");

    if (textOf(src, declaration?.getChild("VariableDefinition")) === "params")
      return declaration?.getChild("ObjectExpression") ?? undefined;
  }

  return undefined;
};

const paramOf = (src: string, literal: SyntaxNode, params: SyntaxNode | undefined) => {
  if (!params) return undefined;
  const at = outer(literal);
  let option: string | undefined;
  let arg = at;

  if (at.parent?.name === "Property" && at.parent.parent?.name === "ObjectExpression") {
    option = nameOfProperty(src, at.parent);
    arg = at.parent.parent;
  }

  const call = arg.parent?.name === "ArgList" ? arg.parent.parent : null;
  const entry = call?.parent;

  if (entry?.name !== "Property" || entry.parent?.from !== params.from) return undefined;
  const index = items(arg.parent!).findIndex((n) => n.from === arg.from);

  if (option === undefined ? index !== 0 : index === 0) return undefined;

  const key = nameOfProperty(src, entry);

  return option === undefined ? { key } : { key, option };
};

const signed = (src: string, num: SyntaxNode) =>
  num.parent?.name === "UnaryExpression" && textOf(src, num.parent.firstChild) === "-"
    ? num.parent
    : num;

const COLOR = /^(["'])#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\1$/;

const numberOf = (text: string) => Number(text.replaceAll("_", ""));

const COMMENTS = new Set(["LineComment", "BlockComment"]);

const NAMEABLE = /^[\w$]+(?:\.[\w$]+)*$/;

const anchorOf = (src: string, literal: SyntaxNode): string => {
  const path: PathStep[] = [];
  let at = outer(literal);

  for (let up = at.parent; up; at = up, up = up.parent) {
    if (up.name === "ArrayExpression") path.unshift(items(up).findIndex((n) => n.from === at.from));
    else if (up.name === "Property") path.unshift(nameOfProperty(src, up));
    else if (up.name === "ObjectExpression" || up.name === "JSXEscape") continue;
    else {
      if (up.name === "ArgList")
        path.unshift(
          calleeOf(src, up.parent!),
          items(up).findIndex((n) => n.from === at.from),
        );
      else if (up.name === "JSXAttribute") {
        const role = attributeRole(src, up);

        if (role.kind === "attribute") path.unshift(...[role.tag, role.name].filter(Boolean));
      } else if (up.name === "VariableDeclaration")
        path.unshift(textOf(src, up.getChild("VariableDefinition")));
      else return "";
      const anchor = path.join(".");

      return NAMEABLE.test(anchor) ? anchor : "";
    }
  }

  return "";
};

const placeOf = (statement: SyntaxNode) => {
  let n = 0;

  for (let at = statement.prevSibling; at; at = at.prevSibling) if (!COMMENTS.has(at.name)) n++;

  return n;
};

const scopeOf = (src: string, node: SyntaxNode): string => {
  let at = node;

  while (at.parent && at.parent.parent) at = at.parent;
  const declaration = at.name === "ExportDeclaration" ? at.lastChild : at;

  if (at.getChild("default")) return "default";
  const name = declaration?.getChild("VariableDefinition");

  return name ? textOf(src, name) : `@${placeOf(at)}`;
};

type Unkeyed = Literal extends infer L ? (L extends Literal ? Omit<L, "key"> : never) : never;

type Placed = Unkeyed & { readonly scope: string; readonly anchor: string };

const keyed = (literals: readonly Placed[]): Literal[] => {
  const seen = new Map<string, number>();

  const keyOf = ({ scope, anchor, param, path }: Placed) => {
    if (param) return ["params", param.key, param.option].filter(Boolean).join(".");

    if (path) return path.join(".");
    const named = anchor ? `${scope}:${anchor}` : scope;
    const n = seen.get(named) ?? 0;
    seen.set(named, n + 1);

    return anchor ? (n ? `${named}#${n}` : named) : `${named}#${n}`;
  };

  const taken = new Set<string>();

  const unique = (key: string) => {
    let free = key;

    for (let n = 1; taken.has(free); n++) free = `${key}#${n}`;
    taken.add(free);

    return free;
  };

  return literals.map((placed): Literal => {
    const { scope: _scope, anchor: _anchor, ...literal } = placed;

    return { ...literal, key: unique(keyOf(placed)) };
  });
};

const literalsOf = (src: string, tree: Tree): Literal[] => {
  const out: Placed[] = [];
  const params = paramsObject(src, tree);

  const base = (
    node: SyntaxNode,
  ): Omit<LiteralBase, "key"> & { readonly scope: string; readonly anchor: string } => {
    const path = pathOf(src, node);
    const param = paramOf(src, node, params);

    return {
      scope: scopeOf(src, node),
      anchor: path || param ? "" : anchorOf(src, node),
      range: [node.from, node.to],
      text: textOf(src, node),
      role: roleOf(src, node),
      ...(path && { path }),
      ...(param && { param }),
    };
  };

  tree.iterate({
    enter: ({ node }) => {
      const text = textOf(src, node);

      if (text.includes("\n")) return undefined;

      if (node.name === "String" || node.name === "JSXAttributeValue") {
        const jsx = node.name === "JSXAttributeValue" ? ({ jsx: true } as const) : {};

        if (COLOR.test(text))
          // SAFETY: COLOR matched a quoted `#` and three, six or eight hex digits, which is a Hex once the quotes are off.
          out.push({ ...base(node), ...jsx, kind: "color", value: text.slice(1, -1) as Hex });
        else
          out.push({
            ...base(node),
            ...jsx,
            kind: "string",
            value: jsx.jsx ? text.slice(1, -1) : unescape(text.slice(1, -1)),
          });

        return false;
      }

      if (node.name === "CallExpression" && textOf(src, node.firstChild) === "ease.bezier") {
        const args = items(node.getChild("ArgList")!).map((n) => numberOf(textOf(src, n)));

        const [x1, y1, x2, y2] = args;

        if (
          args.length !== 4 ||
          x1 === undefined ||
          y1 === undefined ||
          x2 === undefined ||
          y2 === undefined ||
          args.some(Number.isNaN)
        )
          return undefined;
        out.push({
          ...base(node),
          kind: "ease",
          value: ease.bezier(x1, y1, x2, y2),
          name: "bezier",
        });

        return false;
      }

      if (node.name === "MemberExpression" && textOf(src, node.firstChild) === "ease") {
        const name = textOf(src, node.lastChild);

        if (isNamedEase(name)) {
          out.push({ ...base(node), kind: "ease", value: ease[name], name });

          return false;
        }
      }

      if (node.name === "Number") {
        const literal = signed(src, node);
        out.push({ ...base(literal), kind: "number", value: numberOf(textOf(src, literal)) });
      }

      return undefined;
    },
  });

  return keyed(out.sort((a, b) => a.range[0] - b.range[0]));
};

export interface Attribute {
  readonly name: string;
  readonly range: Range;
  readonly value?: Range;
  readonly ref?: string;
}

/** A JSX element. Its key is the line it starts on, which is what `render({ sources: true })` writes on it. */
export interface Element {
  readonly key: string;
  readonly tag: string;
  readonly builtin: boolean;
  readonly range: Range;
  readonly open: Range;
  readonly openLines: readonly [number, number];
  readonly attributes: readonly Attribute[];
}

export interface Const {
  readonly name: string;
  readonly range: Range;
  readonly uses: readonly Range[];
}

export interface Source {
  readonly text: string;
  readonly tree: Tree;
  readonly literals: readonly Literal[];
  readonly elements: readonly Element[];
  readonly consts: readonly Const[];
  readonly runs: readonly Run[];
  readonly lineAt: (offset: number) => number;
  readonly lineStart: (n: number) => number;
}

const openTagOf = (el: SyntaxNode) => el.getChild("JSXOpenTag") ?? el.getChild("JSXSelfClosingTag");

const attributeOf = (src: string, attr: SyntaxNode): Attribute => {
  const escape = attr.getChild("JSXEscape");
  const inner = escape?.firstChild?.nextSibling;

  const ref =
    inner?.name === "VariableName"
      ? textOf(src, inner)
      : inner?.name === "MemberExpression"
        ? textOf(src, inner.lastChild)
        : undefined;

  return {
    name: textOf(src, attr.firstChild),
    range: [attr.from, attr.to],
    ...(escape && { value: [escape.from + 1, escape.to - 1] as const }),
    ...(ref && { ref }),
  };
};

export const parse = (text: string): Source => {
  const tree = parser.parse(text);
  const starts = [0];

  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) starts.push(i + 1);

  const lineAt = (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;

      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }

    return lo + 1;
  };

  const elements: Element[] = [];
  const declared = new Map<string, Range>();
  const names: { name: string; range: Range }[] = [];

  tree.iterate({
    enter: ({ node }) => {
      if (node.name === "VariableDefinition" && node.parent?.name === "VariableDeclaration")
        declared.set(textOf(text, node), [node.parent!.from, node.parent!.to]);

      if (node.name === "VariableName")
        names.push({ name: textOf(text, node), range: [node.from, node.to] });

      if (node.name !== "JSXElement") return;
      const open = openTagOf(node);

      if (!open) return;
      const builtin = open.getChild("JSXBuiltin");
      const tag = builtin ?? open.getChild("JSXIdentifier") ?? open.getChild("JSXMemberExpression");

      elements.push({
        key: String(lineAt(node.from)),
        tag: textOf(text, tag),
        builtin: !!builtin,
        range: [node.from, node.to],
        open: [open.from, open.to],
        openLines: [lineAt(open.from), lineAt(open.to)],
        attributes: open.getChildren("JSXAttribute").map((a) => attributeOf(text, a)),
      });
    },
  });

  const consts = [...declared].map(([name, range]) => ({
    name,
    range,
    uses: names.flatMap((n) => (n.name === name ? [n.range] : [])),
  }));

  return {
    text,
    tree,
    literals: literalsOf(text, tree),
    elements,
    consts,
    runs: runsOf(tree),
    lineAt,
    lineStart: (n) => starts[n - 1] ?? text.length,
  };
};

export type Piece =
  | { readonly kind: Kind; readonly start: number; readonly text: string }
  | {
      readonly kind: "literal";
      readonly start: number;
      readonly text: string;
      readonly literal: Literal;
    };

export interface Line {
  readonly n: number;
  readonly pieces: readonly Piece[];
}

/** The file as highlighted lines. Each literal `live` picks is a piece of its own, so a panel can make it a control. */
export const linesOf = (
  source: Source,
  live: (literal: Literal) => boolean = () => false,
): Line[] => {
  const { text, runs } = source;
  const flat: Piece[] = [];

  const paint = (from: number, to: number) => {
    let at = from;

    for (const { range, kind } of runs) {
      if (range[1] <= from) continue;

      if (range[0] >= to) break;
      const start = Math.max(range[0], from);

      if (start > at) flat.push({ kind: "plain", start: at, text: text.slice(at, start) });
      at = Math.min(range[1], to);
      flat.push({ kind, start, text: text.slice(start, at) });
    }

    if (to > at) flat.push({ kind: "plain", start: at, text: text.slice(at, to) });
  };

  let at = 0;

  for (const literal of source.literals.filter(live)) {
    paint(at, literal.range[0]);
    flat.push({ kind: "literal", start: literal.range[0], text: literal.text, literal });
    at = literal.range[1];
  }

  paint(at, text.length);
  const lines: { n: number; pieces: Piece[] }[] = [{ n: 1, pieces: [] }];

  for (const piece of flat) {
    let start = piece.start;

    piece.text.split("\n").forEach((part, k) => {
      if (k) lines.push({ n: lines.length + 1, pieces: [] });

      if (part) lines.at(-1)!.pieces.push({ ...piece, start, text: part });
      start += part.length + 1;
    });
  }

  return lines;
};

const numberText = (v: number, decimals: number, exact = false) => {
  const fixed = v.toFixed(decimals);
  const text = exact ? fixed : String(Number(fixed));

  return Number(text) === 0 ? text.replace("-", "") : text;
};

export const decimalsOf = (text: string) => {
  const plain = text.replaceAll("_", "");

  return /^-?\d*\.?\d+$/.test(plain) ? (plain.split(".")[1] ?? "").length : 0;
};

const ESCAPES = new Map(
  Object.entries({
    n: "\n",
    r: "\r",
    t: "\t",
    b: "\b",
    f: "\f",
    v: "\v",
    "0": "\0",
  }),
);

export const unescape = (body: string) =>
  body.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g,
    (all, braced?: string, four?: string, two?: string, one?: string) => {
      const code = braced ?? four ?? two;

      if (code !== undefined) {
        const point = Number.parseInt(code, 16);

        return point <= 0x10ffff ? String.fromCodePoint(point) : all;
      }

      return ESCAPES.get(one!) ?? one!;
    },
  );

const escape = (value: string, quote: string) =>
  value.replace(/[\\\n\r\u2028\u2029'"]/g, (c) =>
    c === quote || c === "\\"
      ? `\\${c}`
      : c === "\n"
        ? "\\n"
        : c === "\r"
          ? "\\r"
          : c === "\u2028" || c === "\u2029"
            ? `\\u${c.charCodeAt(0).toString(16)}`
            : c,
  );

const quoted = (literal: LiteralOf<"string" | "color">) => {
  const value: string = literal.value;
  const quote = literal.text[0]!;

  if (!literal.jsx) return `${quote}${escape(value, quote)}${quote}`;

  if (!value.includes(quote)) return `${quote}${value}${quote}`;
  const other = quote === '"' ? "'" : '"';

  return value.includes(other) ? `{"${escape(value, '"')}"}` : `${other}${value}${other}`;
};

/** An ease as code: `ease.name` when it is that very ease, else `ease.bezier(…)` to two decimals. */
export const easeText = (value: Ease): string => {
  const name = [...NAMED_EASES].find((n) => isNamedEase(n) && ease[n] === value);

  if (name) return `ease.${name}`;

  if (value.kind !== "bezier")
    throw new Error(`Only a bezier ease is written as ease.bezier(…), got ease ${value.kind}.`);

  return `ease.bezier(${value.points.map((n) => numberText(n, 2)).join(", ")})`;
};

/**
 * How a literal is written with its value: a number to its own decimals (or exactly `decimals`), a color or string in
 * its own quotes, an ease through `easeText`. Pass `{ ...literal, value }` to write a new value.
 */
export const write = (literal: Literal, decimals?: number): string => {
  switch (literal.kind) {
    case "number":
      return decimals === undefined
        ? numberText(literal.value, decimalsOf(literal.text))
        : numberText(literal.value, decimals, true);
    case "color":
    case "string":
      return quoted(literal);
    case "ease":
      return easeText(literal.value);
  }
};

export interface Edit {
  readonly range: Range;
  readonly text: string;
}

/** The text with every edit applied. Ranges are into `text` as given, and must not overlap. */
export const apply = (text: string, edits: readonly Edit[]): string => {
  let out = text;

  for (const { range, text: next } of [...edits].sort((a, b) => b.range[0] - a.range[0]))
    out = out.slice(0, range[0]) + next + out.slice(range[1]);

  return out;
};

/** The file with `literal` written as it now holds, as in `set(source, { ...literal, value: 9 })`, and nothing else changed. */
export const set = (source: Source, literal: Literal): string =>
  apply(source.text, [{ range: literal.range, text: write(literal) }]);

/** The literal at `path` from a const's name, as in `["legs", 0, "over"]`. */
export const literalAt = (source: Source, path: readonly PathStep[]): Literal | undefined =>
  source.literals.find(
    (l) => l.path?.length === path.length && l.path.every((step, i) => step === path[i]),
  );

export const paramLiteral = (source: Source, key: string): Literal | undefined =>
  source.literals.find((l) => l.param?.key === key && l.param.option === undefined);

const own = (source: Source, node: SyntaxNode) =>
  source.elements.filter((e) => e.builtin && e.range[0] >= node.from && e.range[1] <= node.to);

const outermost = (source: Source, node: SyntaxNode) => {
  const inside = own(source, node);

  return inside.filter(
    (e) => !inside.some((o) => o !== e && o.range[0] <= e.range[0] && o.range[1] >= e.range[1]),
  );
};

const paramEntry = (source: Source, node: SyntaxNode, params: SyntaxNode | undefined) => {
  if (!params) return undefined;

  for (let at: SyntaxNode | null = node; at; at = at.parent)
    if (at.name === "Property" && at.parent?.from === params.from)
      return nameOfProperty(source.text, at);

  return undefined;
};

const made = (source: Source, node: SyntaxNode, seen: Set<string>): Element[] => {
  const params = paramsObject(source.text, source.tree);
  const key = paramEntry(source, node, params);

  if (key !== undefined) {
    if (seen.has(`params.${key}`)) return [];
    seen.add(`params.${key}`);
    const out: Element[] = [];

    source.tree.iterate({
      enter: ({ node: n }) => {
        if (
          n.name === "MemberExpression" &&
          textOf(source.text, n.lastChild) === key &&
          n.from > params!.to
        )
          out.push(...made(source, n, seen));
      },
    });

    return out;
  }

  for (let at: SyntaxNode | null = node; at; at = at.parent) {
    if (at.name === "JSXElement") {
      const element = source.elements.find((e) => e.range[0] === at!.from);

      if (element?.builtin) return [element];
    }

    if (at.name === "JSXEscape" || at.name === "ArrowFunction") {
      const made = outermost(source, at);

      if (made.length) return made;
    }

    if (at.name === "VariableDeclaration") {
      const name = textOf(source.text, at.getChild("VariableDefinition"));

      if (seen.has(name)) return [];
      seen.add(name);

      return (source.consts.find((c) => c.name === name)?.uses ?? []).flatMap((range) =>
        made(source, source.tree.resolveInner(range[0], 1), seen),
      );
    }
  }

  return [];
};

export const madeBy = (source: Source, offset: number): Element[] => [
  ...new Set(made(source, source.tree.resolveInner(offset, 1), new Set())),
];

const nameAt = (call: SyntaxNode) => call.firstChild!.lastChild!.from;

export const callsIn = (source: Source, element: Element, method: string): Range[] => {
  const attr = element.attributes.find((a) => a.name === "animation");

  if (!attr?.value) return [];
  const named = source.text.slice(...attr.value).trim() === attr.ref;
  const declared = named ? source.consts.find((c) => c.name === attr.ref) : undefined;
  const [from, to] = declared?.range ?? attr.value;
  const out: SyntaxNode[] = [];

  source.tree.iterate({
    from,
    to,
    enter: ({ node }) => {
      if (
        node.name === "CallExpression" &&
        node.from >= from &&
        node.to <= to &&
        calleeOf(source.text, node) === method
      )
        out.push(node);
    },
  });

  return out.sort((a, b) => nameAt(a) - nameAt(b)).map((call) => [nameAt(call), call.to] as const);
};
