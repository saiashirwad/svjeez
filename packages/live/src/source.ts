// Scene source as data, from one Lezer TSX parse: the literals an editor can change and what each one means, the JSX
// elements, the consts and their uses, highlighting runs, and exact text edits that keep the rest of the file as it is.
import type { SyntaxNode, Tree } from "@lezer/common";
import { highlightTree, tagHighlighter, tags, type Tag } from "@lezer/highlight";
import { parser as js } from "@lezer/javascript";
import { ease, type Ease, type Hex } from "svjeez";
import type { NumberParam, Schema } from "svjeez/params";

const parser = js.configure({ dialect: "jsx ts" });

export type Range = readonly [from: number, to: number];

// ----- highlighting

/** The highlight classes, with the Lezer tags each covers. The most specific tag on a token wins. */
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

// ----- literals

/** Where a literal sits, read from the node around it. Arithmetic around it (`-70`, `0.8 + i`) still sits there. */
export type Role =
  | { readonly kind: "attribute"; readonly name: string; readonly tag: string }
  | { readonly kind: "argument"; readonly callee: string; readonly index: number }
  | { readonly kind: "property"; readonly name: string }
  | { readonly kind: "const"; readonly name: string }
  | { readonly kind: "other" };

/** One step from a const's name down to a literal inside its value: a property name or an array index. */
export type PathStep = string | number;

export type EaseName = "linear" | "in" | "out" | "inOut" | "pop";

interface LiteralBase {
  readonly range: Range;
  /** The literal as written, quotes and sign included. */
  readonly text: string;
  readonly role: Role;
  /** From the const it sits in down to it, as in `["legs", 0, "over"]`, when only objects and arrays are in between. */
  readonly path?: readonly PathStep[];
  /** The `export const params` entry it declares: its value, or `option` for one of its options. */
  readonly param?: { readonly key: string; readonly option?: string };
}

export type Literal =
  | (LiteralBase & { readonly kind: "number"; readonly value: number })
  | (LiteralBase & { readonly kind: "color"; readonly value: Hex })
  | (LiteralBase & { readonly kind: "string"; readonly value: string })
  | (LiteralBase & {
      readonly kind: "ease";
      readonly value: Ease;
      /** `bezier` for `ease.bezier(…)`, or the named ease. */
      readonly name: EaseName | "bezier";
    });

export type LiteralOf<K extends Literal["kind"]> = Extract<Literal, { kind: K }>;

const ARITHMETIC = new Set(["UnaryExpression", "BinaryExpression", "ParenthesizedExpression"]);
const PUNCTUATION = new Set(["(", ")", ",", "[", "]", "{", "}"]);
const NAMED_EASES = new Set<string>(["linear", "in", "out", "inOut", "pop"]);

const isNamedEase = (name: string): name is EaseName => NAMED_EASES.has(name);

const textOf = (src: string, node: SyntaxNode | null | undefined) =>
  node ? src.slice(node.from, node.to) : "";

/** The children of a list node that are values, not brackets or commas. */
const items = (list: SyntaxNode): SyntaxNode[] => {
  const out: SyntaxNode[] = [];

  for (let at = list.firstChild; at; at = at.nextSibling)
    if (!PUNCTUATION.has(at.name) && at.name !== "Spread") out.push(at);

  return out;
};

/** The name a call is to: `to` for `motion(…).to(…)`, `count` for `count(…)`. */
const calleeOf = (src: string, call: SyntaxNode) => {
  const callee = call.firstChild;

  return callee?.name === "MemberExpression" ? textOf(src, callee.lastChild) : textOf(src, callee);
};

/** The node a literal stands in for: itself, or the arithmetic it is part of. */
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

const roleOf = (src: string, literal: SyntaxNode): Role => {
  const at = outer(literal);
  const context = at.parent;

  switch (context?.name) {
    case "VariableDeclaration":
      return { kind: "const", name: textOf(src, context.getChild("VariableDefinition")) };
    case "Property":
      return { kind: "property", name: nameOfProperty(src, context) };
    case "JSXEscape": {
      const attr = context.parent;

      if (attr?.name !== "JSXAttribute") return { kind: "other" };
      const tag = attr.parent?.getChild("JSXBuiltin") ?? attr.parent?.getChild("JSXIdentifier");

      return { kind: "attribute", name: textOf(src, attr.firstChild), tag: textOf(src, tag) };
    }

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

const pathOf = (src: string, literal: SyntaxNode): PathStep[] | undefined => {
  const path: PathStep[] = [];
  let at = outer(literal);

  for (;;) {
    const up = at.parent;

    if (!up) return undefined;

    if (up.name === "ArrayExpression") path.unshift(items(up).findIndex((n) => n.from === at.from));
    else if (up.name === "Property") path.unshift(nameOfProperty(src, up));
    else if (up.name === "VariableDeclaration") {
      path.unshift(textOf(src, up.getChild("VariableDefinition")));

      return path;
    } else if (up.name !== "ObjectExpression") return undefined;
    at = up;
  }
};

/** The object `export const params = {…}` declares, if the file has one. */
const paramsObject = (src: string, tree: Tree): SyntaxNode | undefined => {
  for (const exported of tree.topNode.getChildren("ExportDeclaration")) {
    const declaration = exported.getChild("VariableDeclaration");

    if (textOf(src, declaration?.getChild("VariableDefinition")) === "params")
      return declaration?.getChild("ObjectExpression") ?? undefined;
  }

  return undefined;
};

/** Which params entry a literal declares: the first argument of the entry's call, or a property of its options. */
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

/** A number with its sign, so `-70` is one literal. */
const signed = (src: string, num: SyntaxNode) =>
  num.parent?.name === "UnaryExpression" && textOf(src, num.parent.firstChild) === "-"
    ? num.parent
    : num;

const COLOR = /^(["'])#[0-9A-Fa-f]{6}\1$/;

/** Every literal in the file, in order. An ease call is one literal, so its numbers are not also numbers. */
const literalsOf = (src: string, tree: Tree): Literal[] => {
  const out: Literal[] = [];
  const params = paramsObject(src, tree);

  const base = (node: SyntaxNode): LiteralBase => {
    const path = pathOf(src, node);
    const param = paramOf(src, node, params);

    return {
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
        if (COLOR.test(text))
          // SAFETY: COLOR matched a quoted `#` and six hex digits, which is a Hex once the quotes are off.
          out.push({ ...base(node), kind: "color", value: text.slice(1, -1) as Hex });
        else out.push({ ...base(node), kind: "string", value: text.slice(1, -1) });

        return false;
      }

      if (node.name === "CallExpression" && textOf(src, node.firstChild) === "ease.bezier") {
        const args = items(node.getChild("ArgList")!).map((n) => Number(textOf(src, n)));

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
        out.push({ ...base(literal), kind: "number", value: Number(textOf(src, literal)) });
      }

      return undefined;
    },
  });

  return out.sort((a, b) => a.range[0] - b.range[0]);
};

// ----- elements and consts

export interface Attribute {
  readonly name: string;
  readonly range: Range;
  /** What `{…}` holds, without the braces. */
  readonly value?: Range;
  /** The last name in a `{name}` or `{p.name}` value. */
  readonly ref?: string;
}

/** A JSX element. Its key is the line it starts on, which is what `render({ sources: true })` writes on it. */
export interface Element {
  readonly key: string;
  readonly tag: string;
  /** An SVG tag, which writes an element of its own, rather than a component or a fragment. */
  readonly builtin: boolean;
  readonly range: Range;
  readonly open: Range;
  /** The first and last line of the opening tag. */
  readonly openLines: readonly [number, number];
  readonly attributes: readonly Attribute[];
}

export interface Const {
  readonly name: string;
  readonly range: Range;
  /** Every other place the name is read. One file, no shadowing: a name means the const. */
  readonly uses: readonly Range[];
}

export interface Source {
  readonly text: string;
  readonly tree: Tree;
  readonly literals: readonly Literal[];
  readonly elements: readonly Element[];
  readonly consts: readonly Const[];
  readonly runs: readonly Run[];
  /** The line, from 1, that `offset` is on. */
  readonly lineAt: (offset: number) => number;
  /** Where line `n` starts. */
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

// ----- lines for a code panel

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

/**
 * The file as highlighted lines. Each literal `live` picks is one piece of its own, so a panel can make it a control;
 * the rest is highlighting runs with unhighlighted gaps as plain text.
 */
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

// ----- writing values back

const numberText = (v: number, decimals: number) => {
  const text = String(Number(v.toFixed(decimals)));

  return text === "-0" ? "0" : text;
};

const decimalsOf = (text: string) => (text.split(".")[1] ?? "").length;

/** An ease as code: `ease.name` when it is that very ease, else `ease.bezier(…)` to two decimals. */
export const easeText = (value: Ease): string => {
  const name = [...NAMED_EASES].find((n) => isNamedEase(n) && ease[n] === value);

  if (name) return `ease.${name}`;

  if (value.kind !== "bezier")
    throw new Error(`Only a bezier ease is written as ease.bezier(…), got ease ${value.kind}.`);

  return `ease.bezier(${value.points.map((n) => numberText(n, 2)).join(", ")})`;
};

/**
 * How a literal is written with the value it holds: a number to as many decimals as its text had (or `decimals`), a
 * color or string in its own quotes, an ease through `easeText`. Pass `{ ...literal, value }` to write a new value.
 */
export const write = (literal: Literal, decimals?: number): string => {
  switch (literal.kind) {
    case "number":
      return numberText(literal.value, decimals ?? decimalsOf(literal.text));
    case "color":
    case "string":
      return `${literal.text[0]}${literal.value}${literal.text[0]}`;
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

/** The literal that declares `params[key]`. */
export const paramLiteral = (source: Source, key: string): Literal | undefined =>
  source.literals.find((l) => l.param?.key === key && l.param.option === undefined);

// ----- linking code to the elements it shapes

const own = (source: Source, node: SyntaxNode) =>
  source.elements.filter((e) => e.builtin && e.range[0] >= node.from && e.range[1] <= node.to);

/** The built-in elements inside `node` that no other built-in element inside it holds. */
const outermost = (source: Source, node: SyntaxNode) => {
  const inside = own(source, node);

  return inside.filter(
    (e) => !inside.some((o) => o !== e && o.range[0] <= e.range[0] && o.range[1] >= e.range[1]),
  );
};

/** The `params` entry a node sits in, if it does. */
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

  // A param is used wherever the scene reads `p.key`.
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

/**
 * The built-in elements the code at `offset` shapes: the element whose tag or body it is in, the elements an arrow
 * function or a `{…}` child makes, or, for a const or a param, whatever every use of it shapes.
 */
export const madeBy = (source: Source, offset: number): Element[] => [
  ...new Set(made(source, source.tree.resolveInner(offset, 1), new Set())),
];

// ----- an element's motion

/** Where a call's name sits: every call in a chain starts where the chain does, so this orders them. */
const nameAt = (call: SyntaxNode) => call.firstChild!.lastChild!.from;

/** The calls to `.method(…)` in the element's `animation`, following `animation={name}` to its const, in source order. */
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

// ----- what a drag on a number does

const labelOf = (role: Role) => {
  switch (role.kind) {
    case "attribute":
    case "const":
    case "property":
      return role.name;
    case "argument":
      return `${role.callee}()`;
    case "other":
      return "";
  }
};

/**
 * The param a control for this number edits: the one `schema` declares for it, else a range around its value with a
 * step as fine as it is written, named for where it sits.
 */
export const paramFor = (literal: LiteralOf<"number">, schema: Schema = {}): NumberParam => {
  const declared = literal.param && !literal.param.option ? schema[literal.param.key] : undefined;

  if (declared?.kind === "number") return { ...declared, value: literal.value };
  const v = literal.value;
  const decimals = decimalsOf(literal.text);

  return {
    kind: "number",
    value: v,
    min: Math.min(0, v * 3),
    max: Math.max(10, v * 3),
    step: decimals ? 10 ** -decimals : 1,
    label: labelOf(literal.role),
  };
};
