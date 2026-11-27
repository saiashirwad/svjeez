import type { SyntaxNode } from "@lezer/common";
import { parser as js } from "@lezer/javascript";
import { Effect, Result } from "effect";
import { InvalidValue, StaleSource } from "./errors.ts";
import { canonical, isRelative, resolveRelative } from "./paths.ts";
import { literalOf, parse } from "./source.ts";
import { isNumber, isString } from "./text.ts";
import type { Attribute, Edit, Files, Json, JsonObject } from "./types.ts";

/*
 * Signals: every constant a scene is written with, found in its source text and written back as the smallest edit.
 * Nothing here runs the scene, renders or serves. A host (the dev server, an editor, an agent) reads the signals,
 * composes them into controls, and turns a control's new value into text edits.
 */

const parser = js.configure({ dialect: "jsx ts" });

export type SignalKind = "number" | "color" | "text" | "boolean" | "ease" | "span" | "vec";

/**
 * Where a signal came from: a top-level `const`, the scene's `params`, a `span(…)` call, a literal JSX prop, a field
 * of an object or list const, a literal anywhere else, or a step of a `track(…)` chain.
 */
export type Origin = "const" | "param" | "span" | "prop" | "literal" | "field" | "chain";

/** Named: written with a name, or an id. Deep: a literal found anywhere else in the code. */
export type Prominence = "named" | "deep";

/** A point: `[x, y]`. */
export type Point = readonly [number, number];

/** A `span(start, over)` written with two number literals. */
export interface Span {
  readonly start: number;
  readonly over: number;
}

export type SignalValue = number | string | boolean | Span | Point;

/** A literal in the source: its offsets in UTF-16 code units, and its text as written. */
export interface Site {
  readonly file: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
  /** A JSX attribute string, `fill="#fff"`, which has entities in place of escapes. */
  readonly jsx?: boolean;
}

/** The range a control can sweep. Declared by a param, otherwise guessed from the value as written. */
export interface Hint {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** The literals a step of a track chain is written with, beside its span. */
export interface Step {
  /** The value the step goes to, when it is a number, a color or a string literal. */
  readonly target?: Site;
  /** The curve, when it is a literal `ease.x` or `ease.bezier(…)`. */
  readonly ease?: Site;
  /** Its place among the steps of its chain, from 0. */
  readonly index: number;
  /** The chain's name: the `const` it is bound to, else where it is written. */
  readonly chain: string;
}

/** One value the source is written with. Plain JSON. */
export interface Signal {
  readonly key: string;
  readonly kind: SignalKind;
  readonly value: SignalValue;
  readonly label: string;
  readonly origin: Origin;
  readonly prominence: Prominence;
  /** One site, or two for a span or a point: its start then its length, or x then y. */
  readonly sites: readonly Site[];
  /** Every place the source reads a named signal, not counting where it is written. */
  readonly uses?: readonly Site[];
  /** For a step of a track chain: its target and curve literals, and where it is. */
  readonly step?: Step;
  readonly file: string;
  /** The 1-based line of the first site. */
  readonly line: number;
  readonly range?: Hint;
  /** The values a `param.choice` may take. */
  readonly options?: readonly string[];
}

export type Signals = Readonly<Record<string, Signal>>;

/** The named curves a literal ease can be. `ease.bezier(…)` with literal numbers is one too. */
export const EASES: readonly string[] = [
  "ease.linear",
  "ease.in",
  "ease.out",
  "ease.inOut",
  "ease.pop",
];

const COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const BEZIER = /^ease\.bezier\(\s*-?[\d.]+(?:\s*,\s*-?[\d.]+){3}\s*\)$/;

export const isSpan = (value: ControlValue | undefined): value is Span =>
  typeof value === "object" && "start" in value && "over" in value;

const isNum = (value: ControlValue | undefined): value is number => typeof value === "number";

const isPoint = (value: ControlValue): value is Point =>
  Array.isArray(value) && value.length === 2 && value.every(isNum);

const isText = (value: ControlValue | undefined): value is string => typeof value === "string";

const isJsonObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lineOf = (text: string, offset: number): number => {
  let line = 1;

  for (let at = text.indexOf("\n"); at !== -1 && at < offset; at = text.indexOf("\n", at + 1))
    line++;

  return line;
};

const siteOf = (file: string, src: string, node: SyntaxNode): Site => ({
  file,
  from: node.from,
  to: node.to,
  text: src.slice(node.from, node.to),
});

const decimalsOf = (text: string): number => {
  const mantissa = text.replaceAll("_", "").split(/e/i)[0] ?? "";
  const dot = mantissa.indexOf(".");

  return dot === -1 ? 0 : mantissa.length - dot - 1;
};

/**
 * A range for a number nobody declared one for: zero to twice its size, or mirrored for a negative, in whole steps
 * for an integer and in steps as fine as it is written for a decimal, at least hundredths below 10.
 */
export const guessRange = (value: number, text = String(value)): Hint => {
  const size = Math.abs(value);
  const whole = Number.isInteger(value) && decimalsOf(text) === 0;
  const step = whole ? 1 : 10 ** -Math.max(decimalsOf(text), size < 10 ? 2 : 1);

  if (size === 0) return whole ? { min: -10, max: 10, step } : { min: -1, max: 1, step };

  return value > 0 ? { min: 0, max: 2 * size, step } : { min: -2 * size, max: 0, step };
};

/** The value of a number literal node, its sign included, or undefined. */
const numberAt = (src: string, node: SyntaxNode | null | undefined): number | undefined => {
  if (!node) return undefined;
  const literal = literalOf(src, node);

  return literal?.lit === "number" && isNumber(literal.value) ? literal.value : undefined;
};

/** The items of an argument list or an array literal, brackets, commas and comments left out. */
const itemsOf = (list: SyntaxNode | null): SyntaxNode[] => {
  const out: SyntaxNode[] = [];

  for (let at = list?.firstChild; at; at = at.nextSibling)
    if (!/^[()[\],]$/.test(at.name) && !at.type.isSkipped && !at.name.endsWith("Comment"))
      out.push(at);

  return out;
};

const calleeOf = (src: string, call: SyntaxNode): string =>
  call.firstChild ? src.slice(call.firstChild.from, call.firstChild.to) : "";

interface Scalar {
  readonly kind: SignalKind;
  readonly value: SignalValue;
}

/** A literal a control can edit, with its kind, or undefined for one none does (null, arrays, objects). */
const scalarOf = (src: string, node: SyntaxNode): Scalar | undefined => {
  const literal = literalOf(src, node);

  if (!literal) return undefined;
  const { lit, value } = literal;

  if (lit === "number" && isNumber(value)) return { kind: "number", value };

  if ((lit === "color" || lit === "string" || lit === "ease") && isString(value))
    return { kind: lit === "string" ? "text" : lit, value };

  if (lit === "boolean" && (value === true || value === false)) return { kind: "boolean", value };

  return undefined;
};

/** The signals found so far, in the order they were found. */
type Found = Map<string, Signal>;

/** A key nobody has taken yet: `key`, else `key.2`, `key.3`, … */
const fresh = (found: Found, key: string): string => {
  let unique = key;

  for (let n = 2; found.has(unique); n++) unique = key + "." + n;

  return unique;
};

type Draft = Omit<Signal, "label"> & { readonly label?: string };

const add = (found: Found, draft: Draft) => {
  const key = fresh(found, draft.key);

  found.set(key, { ...draft, key, label: draft.label ?? key });
};

const numberSignal = (
  found: Found,
  file: string,
  src: string,
  key: string,
  origin: Origin,
  node: SyntaxNode,
  value: number,
  range?: Hint,
  prominence: Prominence = "named",
) => {
  const site = siteOf(file, src, node);

  add(found, {
    key,
    kind: "number",
    value,
    origin,
    prominence,
    sites: [site],
    file,
    line: lineOf(src, site.from),
    range: range ?? guessRange(value, site.text),
  });
};

/** Each name a top-level `const` declares, with what it is initialised with. */
const declarations = (src: string, root: SyntaxNode): [SyntaxNode, SyntaxNode][] => {
  const out: [SyntaxNode, SyntaxNode][] = [];

  for (let statement = root.firstChild; statement; statement = statement.nextSibling) {
    const exported = statement.name === "ExportDeclaration";
    const declaration = exported ? statement.getChild("VariableDeclaration") : statement;

    if (
      declaration?.name !== "VariableDeclaration" ||
      src.slice(declaration.from, declaration.from + 5) !== "const"
    )
      continue;
    let name: SyntaxNode | undefined;

    for (let at = declaration.firstChild; at; at = at.nextSibling)
      if (at.name === "VariableDefinition") name = at;
      else if (at.name === "Equals") {
        const value = at.nextSibling;

        if (name && value) out.push([name, value]);
        name = undefined;
      }
  }

  return out;
};

/** The kind of signal each `param.*` constructor makes. Lists have no single literal, so they make none. */
const PARAMS = new Map<string, SignalKind>([
  ["number", "number"],
  ["count", "number"],
  ["seconds", "number"],
  ["color", "color"],
  ["easing", "ease"],
  ["text", "text"],
  ["choice", "text"],
]);

/** `export const params = { speed: param.number(1, { min: 0, max: 4 }) }`: a signal per param written with a literal. */
const paramSignals = (found: Found, file: string, src: string, object: SyntaxNode) => {
  for (let property = object.firstChild; property; property = property.nextSibling) {
    const name = property.firstChild;
    const call = property.lastChild;

    if (property.name !== "Property" || !name || call?.name !== "CallExpression") continue;
    const constructor = /^param\.(\w+)$/.exec(calleeOf(src, call))?.[1] ?? "";
    const kind = PARAMS.get(constructor);
    const [first, second] = itemsOf(call.getChild("ArgList"));
    const scalar = first && scalarOf(src, first);

    if (!kind || !first || !scalar) continue;
    const key = src.slice(name.from, name.to).replace(/^["']|["']$/g, "");
    const declared = second ? literalOf(src, second)?.value : undefined;

    if (kind === "number" && isNum(scalar.value)) {
      const given = isJsonObject(declared) ? declared : {};
      const guessed = guessRange(scalar.value, src.slice(first.from, first.to));
      const { min, max, step } = given;

      numberSignal(found, file, src, key, "param", first, scalar.value, {
        min: isNumber(min) ? min : constructor === "number" ? guessed.min : 0,
        max: isNumber(max) ? max : guessed.max,
        step: isNumber(step) ? step : constructor === "count" ? 1 : 0.01,
      });
      continue;
    }

    const site = siteOf(file, src, first);

    add(found, {
      key,
      kind,
      value: scalar.value,
      origin: "param",
      prominence: "named",
      sites: [site],
      file,
      line: lineOf(src, site.from),
      ...(constructor === "choice" &&
        Array.isArray(declared) && { options: declared.filter(isString) }),
    });
  }
};

/** A `span(0.2, 1.2)` of two number literals, as one signal with a site for each. False when it is not one. */
const spanSignal = (
  found: Found,
  file: string,
  src: string,
  call: SyntaxNode,
  key: string,
  prominence: Prominence,
) => {
  const [startNode, overNode, extra] = itemsOf(call.getChild("ArgList"));
  const start = numberAt(src, startNode);
  const over = numberAt(src, overNode);

  if (!startNode || !overNode || extra || start === undefined || over === undefined) return false;

  add(found, {
    key,
    kind: "span",
    value: { start, over },
    origin: "span",
    prominence,
    sites: [siteOf(file, src, startNode), siteOf(file, src, overNode)],
    file,
    line: lineOf(src, call.from),
    range: { min: 0, max: Math.max(2 * (start + over), 1), step: 0.01 },
  });

  return true;
};

/** The name a call is bound to by `const name = call`, anywhere in the file. */
const bindingOf = (src: string, call: SyntaxNode): string | undefined => {
  const equals = call.prevSibling;
  const name = equals?.name === "Equals" ? equals.prevSibling : null;

  return call.parent?.name === "VariableDeclaration" && name?.name === "VariableDefinition"
    ? src.slice(name.from, name.to)
    : undefined;
};

const spanSignals = (found: Found, file: string, src: string, root: SyntaxNode) =>
  root.cursor().iterate((ref) => {
    if (ref.name !== "CallExpression" || calleeOf(src, ref.node) !== "span") return undefined;
    const call = ref.node;

    const bound = bindingOf(src, call);

    spanSignal(
      found,
      file,
      src,
      call,
      bound ?? "span@" + lineOf(src, call.from),
      bound === undefined ? "deep" : "named",
    );

    return false;
  });

type Literal = Attribute & { readonly kind: "literal" };

/** The literal inside a prop's value: a string with its quotes, or what is between `{` and `}`. */
const propSite = (src: string, attribute: Literal): Site | undefined => {
  const range = attribute.valueRange;

  if (!range) return undefined;

  if (attribute.form === "string")
    return { ...range, text: src.slice(range.from, range.to), jsx: true };
  const inner = src.slice(range.from + 1, range.to - 1);
  const from = range.from + 1 + (inner.length - inner.trimStart().length);
  const to = range.to - 1 - (inner.length - inner.trimEnd().length);

  return { file: range.file, from, to, text: src.slice(from, to) };
};

const PROP_KINDS = new Map<string, SignalKind>([
  ["number", "number"],
  ["color", "color"],
  ["string", "text"],
  ["boolean", "boolean"],
  ["ease", "ease"],
]);

const propSignals = (found: Found, files: Files) => {
  const parsed = Effect.runSync(Effect.result(parse(files)));

  if (!Result.isSuccess(parsed)) return;
  const { order, elements } = parsed.success;

  for (const id of order)
    for (const attribute of elements[id]?.attributes ?? []) {
      if (attribute.kind !== "literal" || attribute.name === "id") continue;
      const src = files[attribute.range.file] ?? "";
      const site = propSite(src, attribute);
      const kind = PROP_KINDS.get(attribute.lit);
      const { value } = attribute;

      if (
        !site ||
        !kind ||
        !(isNumber(value) || isString(value) || value === true || value === false)
      )
        continue;

      add(found, {
        key: id + "." + attribute.name,
        kind,
        value,
        origin: "prop",
        prominence: "named",
        sites: [site],
        file: site.file,
        line: lineOf(src, site.from),
        ...(isNumber(value) && { range: guessRange(value, site.text) }),
      });
    }
};

const textOf = (src: string, node: SyntaxNode | null | undefined): string =>
  node ? src.slice(node.from, node.to) : "";

const sameNode = (a: SyntaxNode | null | undefined, b: SyntaxNode | null | undefined): boolean =>
  !!a && !!b && a.from === b.from && a.to === b.to;

/** What a declaration is initialised with, without its parentheses or a trailing `as const` or `satisfies T`. */
const unwrap = (node: SyntaxNode): SyntaxNode => {
  if (node.name === "ParenthesizedExpression") {
    const inner = itemsOf(node)[0];

    return inner ? unwrap(inner) : node;
  }

  if (node.name === "BinaryExpression") {
    for (let at = node.firstChild; at; at = at.nextSibling)
      if (at.name === "as" || at.name === "satisfies")
        return node.firstChild ? unwrap(node.firstChild) : node;
  }

  return node;
};

/** The 1-based line starts of a text, for finding a line and column without counting from the top each time. */
const lineStarts = (src: string): number[] => {
  const out = [0];

  for (let at = src.indexOf("\n"); at !== -1; at = src.indexOf("\n", at + 1)) out.push(at + 1);

  return out;
};

const lineAt = (starts: readonly number[], offset: number): number => {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);

    if ((starts[mid] ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }

  return low + 1;
};

/** The two number literals of a `[x, y]`, or undefined when the node is anything else. */
const pairOf = (src: string, node: SyntaxNode): [SyntaxNode, SyntaxNode] | undefined => {
  if (node.name !== "ArrayExpression") return undefined;
  const [x, y, extra] = itemsOf(node);

  return x && y && !extra && numberAt(src, x) !== undefined && numberAt(src, y) !== undefined
    ? [x, y]
    : undefined;
};

const rangeOfPair = (src: string, x: SyntaxNode, y: SyntaxNode): Hint => {
  const a = guessRange(numberAt(src, x) ?? 0, textOf(src, x));
  const b = guessRange(numberAt(src, y) ?? 0, textOf(src, y));

  return {
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
    step: Math.min(a.step, b.step),
  };
};

/** A point written as two number literals, one signal with a site for each: x, then y. */
const vecSignal = (
  found: Found,
  file: string,
  src: string,
  key: string,
  origin: Origin,
  [x, y]: readonly [SyntaxNode, SyntaxNode],
  prominence: Prominence,
  label?: string,
) => {
  add(found, {
    key,
    kind: "vec",
    value: [numberAt(src, x) ?? 0, numberAt(src, y) ?? 0],
    origin,
    prominence,
    sites: [siteOf(file, src, x), siteOf(file, src, y)],
    file,
    line: lineOf(src, x.from),
    range: rangeOfPair(src, x, y),
    ...(label !== undefined && { label }),
  });
};

/** A literal a control can edit, as one signal. False when the node is not one. */
const scalarSignal = (
  found: Found,
  file: string,
  src: string,
  key: string,
  origin: Origin,
  node: SyntaxNode,
): boolean => {
  const scalar = scalarOf(src, node);

  if (!scalar) return false;

  if (isNum(scalar.value)) {
    numberSignal(found, file, src, key, origin, node, scalar.value);

    return true;
  }

  const site = siteOf(file, src, node);

  add(found, {
    key,
    kind: scalar.kind,
    value: scalar.value,
    origin,
    prominence: "named",
    sites: [site],
    file,
    line: lineOf(src, site.from),
  });

  return true;
};

/** The name a property is written with: `x`, `"x"`. Undefined for a computed one. */
const keyText = (src: string, name: SyntaxNode): string | undefined =>
  name.name === "PropertyDefinition" || name.name === "String"
    ? textOf(src, name).replace(/^["']|["']$/g, "")
    : undefined;

/** The most items of a list that make a signal each, so a table of data is not a screen of controls. */
const MAX_ITEMS = 32;

/** The fields of an object, `WAVE.x`, and of an object inside it, `WAVE.size.width`: no deeper. */
const fieldSignals = (
  found: Found,
  file: string,
  src: string,
  prefix: string,
  object: SyntaxNode,
  depth: number,
) => {
  for (let property = object.firstChild; property; property = property.nextSibling) {
    const name = property.firstChild;
    const last = property.lastChild;

    if (property.name !== "Property" || !name || !last || sameNode(name, last)) continue;
    const field = keyText(src, name);

    if (field === undefined) continue;
    const key = prefix + "." + field;
    const value = unwrap(last);
    const pair = pairOf(src, value);

    if (pair) vecSignal(found, file, src, key, "field", pair, "named");
    else if (value.name === "ObjectExpression" && depth < 1)
      fieldSignals(found, file, src, key, value, depth + 1);
    else scalarSignal(found, file, src, key, "field", value);
  }
};

/** A top-level list: a point, a few numbers as `ORIGIN[0]`, or the literals of a longer list. */
const listSignals = (found: Found, file: string, src: string, key: string, list: SyntaxNode) => {
  const items = itemsOf(list);
  const pair = pairOf(src, list);

  if (pair) vecSignal(found, file, src, key, "const", pair, "named");

  if (
    items.length >= 2 &&
    items.length <= 4 &&
    items.every((item) => numberAt(src, item) !== undefined)
  ) {
    items.forEach((item, i) =>
      numberSignal(found, file, src, key + "[" + i + "]", "const", item, numberAt(src, item) ?? 0),
    );

    return;
  }

  if (items.length > MAX_ITEMS) return;

  items.forEach((item, i) => {
    const value = unwrap(item);
    const inner = pairOf(src, value);

    if (inner) vecSignal(found, file, src, key + "[" + i + "]", "field", inner, "named");
    else scalarSignal(found, file, src, key + "[" + i + "]", "field", value);
  });
};

/**
 * The signals one top-level `const` makes: a literal, a point or list, or the fields of an object. A
 * `tokens({ light: {…}, dark: {…} })` makes `name.blue` for the light value and `name.dark.blue` for the dark.
 */
const constSignals = (found: Found, file: string, src: string, key: string, node: SyntaxNode) => {
  const value = unwrap(node);

  switch (value.name) {
    case "ArrayExpression":
      return listSignals(found, file, src, key, value);
    case "ObjectExpression":
      return fieldSignals(found, file, src, key, value, 0);
    case "CallExpression": {
      const object =
        calleeOf(src, value) === "tokens" ? itemsOf(value.getChild("ArgList"))[0] : undefined;

      if (object?.name !== "ObjectExpression")
        return scalarSignal(found, file, src, key, "const", value);

      for (let side = object.firstChild; side; side = side.nextSibling) {
        const mode = side.firstChild ? keyText(src, side.firstChild) : undefined;
        const inner = side.lastChild && unwrap(side.lastChild);

        if (side.name === "Property" && inner?.name === "ObjectExpression")
          if (mode === "light") fieldSignals(found, file, src, key, inner, 1);
          else if (mode === "dark") fieldSignals(found, file, src, key + ".dark", inner, 1);
      }

      return undefined;
    }

    default:
      return scalarSignal(found, file, src, key, "const", value);
  }
};

/** The files discovery can read: by name, by canonical path, and each one's tree. */
class Loaded {
  readonly files: Files;
  readonly #names = new Map<string, string>();
  readonly #trees = new Map<string, SyntaxNode>();

  constructor(files: Files) {
    this.files = files;

    for (const name of Object.keys(files)) this.#names.set(canonical(name), name);
  }

  tree(file: string): SyntaxNode {
    const known = this.#trees.get(file);

    if (known) return known;
    const made = parser.parse(this.files[file] ?? "").topNode;

    this.#trees.set(file, made);

    return made;
  }

  /** The loaded file a relative import from `from` reaches. */
  resolve(from: string, specifier: string): string | undefined {
    if (!isRelative(specifier)) return undefined;
    const path = resolveRelative((each) => this.#names.has(each), canonical(from), specifier);

    return path === undefined ? undefined : this.#names.get(path);
  }
}

interface Binding {
  readonly local: string;
  readonly imported: string;
  readonly specifier: string;
}

const specifierOf = (src: string, statement: SyntaxNode): string => {
  const string = statement.getChild("String");

  return string ? textOf(src, string).slice(1, -1) : "";
};

/** Each name an `import { a, b as c } from "./x"` brings in: the name it has there, and the name it has here. */
const bindingsOf = (src: string, root: SyntaxNode): Binding[] => {
  const out: Binding[] = [];

  for (let statement = root.firstChild; statement; statement = statement.nextSibling) {
    const group = statement.name === "ImportDeclaration" ? statement.getChild("ImportGroup") : null;
    const specifier = specifierOf(src, statement);
    let imported: string | undefined;

    for (let at = group?.firstChild; at; at = at.nextSibling)
      if (at.name === "VariableName") imported = textOf(src, at);
      else if (at.name === "VariableDefinition") {
        out.push({ local: textOf(src, at), imported: imported ?? textOf(src, at), specifier });
        imported = undefined;
      }
  }

  return out;
};

/** The relative modules a file imports from, and the ones it only re-exports from, as written. */
export interface Imports {
  readonly imports: readonly string[];
  readonly reexports: readonly string[];
}

export const importsOf = (src: string): Imports => {
  const imports: string[] = [];
  const reexports: string[] = [];

  for (let at = parser.parse(src).topNode.firstChild; at; at = at.nextSibling) {
    const specifier = at.getChild("from") ? specifierOf(src, at) : "";

    if (!isRelative(specifier)) continue;
    (at.name === "ImportDeclaration" ? imports : reexports).push(specifier);
  }

  return { imports, reexports };
};

interface Ref {
  readonly file: string;
  readonly name: string;
}

/** The `const` an exported name stands for, in the file that declares it, following `export { a } from` and `export *`. */
const resolveExport = (loaded: Loaded, file: string, name: string, depth = 0): Ref | undefined => {
  const src = loaded.files[file];

  if (src === undefined || depth > 4) return undefined;
  const root = loaded.tree(file);

  if (declarations(src, root).some(([each]) => textOf(src, each) === name)) return { file, name };

  for (let statement = root.firstChild; statement; statement = statement.nextSibling) {
    const target = statement.getChild("from")
      ? loaded.resolve(file, specifierOf(src, statement))
      : undefined;

    if (statement.name !== "ExportDeclaration" || !target) continue;
    const group = statement.getChild("ExportGroup");

    if (!group) {
      const hit = resolveExport(loaded, target, name, depth + 1);

      if (hit) return hit;
      continue;
    }

    let original: string | undefined;

    for (let at = group.firstChild; at; at = at.nextSibling) {
      if (at.name !== "VariableName" && at.name !== "VariableDefinition") continue;
      const given = textOf(src, at);
      const alias = at.prevSibling?.name === "as";

      if (alias && original !== undefined && given === name)
        return resolveExport(loaded, target, original, depth + 1);

      if (!alias && at.nextSibling?.name !== "as" && given === name)
        return resolveExport(loaded, target, given, depth + 1);
      original = given;
    }
  }

  return undefined;
};

/** The signals of the consts the entry imports from the files it was loaded with, under the names it gives them. */
const importedSignals = (
  found: Found,
  loaded: Loaded,
  entry: string,
  src: string,
  root: SyntaxNode,
  defs: Map<string, string>,
) => {
  for (const { local, imported, specifier } of bindingsOf(src, root)) {
    const target = loaded.resolve(entry, specifier);
    const ref = target ? resolveExport(loaded, target, imported) : undefined;
    const from = ref && loaded.files[ref.file];

    if (!ref || from === undefined) continue;

    const declaration = declarations(from, loaded.tree(ref.file)).find(
      ([name]) => textOf(from, name) === ref.name,
    );

    if (!declaration) continue;
    defs.set(ref.file + "#" + ref.name, local);
    constSignals(found, ref.file, from, local, declaration[1]);
  }
};

/** Where an identifier is read: it, or the `.field` or `[0]` after it, for each signal made of that path. */
const usesIn = (
  found: Found,
  loaded: Loaded,
  file: string,
  refs: ReadonlyMap<string, string>,
  uses: Map<string, Site[]>,
) => {
  const src = loaded.files[file] ?? "";

  const note = (key: string, node: SyntaxNode) => {
    if (!found.has(key)) return;
    const list = uses.get(key) ?? [];

    if (!list.some((site) => site.file === file && site.from === node.from))
      uses.set(key, [...list, siteOf(file, src, node)]);
  };

  loaded
    .tree(file)
    .cursor()
    .iterate((ref) => {
      if (ref.name !== "VariableName") return undefined;
      const prefix = refs.get(src.slice(ref.from, ref.to));

      if (prefix === undefined || ref.node.parent?.name === "ImportGroup") return undefined;
      let node = ref.node;
      let path = prefix;
      let rest = "";

      note(path, node);

      for (let member = node.parent; member?.name === "MemberExpression"; member = node.parent) {
        if (!sameNode(member.firstChild, node)) break;
        const name = member.getChild("PropertyName");
        const open = member.getChild("[");
        const index = open?.nextSibling;

        const segment = name
          ? "." + textOf(src, name)
          : index?.name === "Number"
            ? "[" + textOf(src, index) + "]"
            : undefined;

        if (segment === undefined) break;
        path += segment;
        rest += segment;
        note(path, member);
        note(prefix + ".dark" + rest, member);
        node = member;
      }

      return undefined;
    });
};

/** The places each named signal is read: its identifier, or the member that reaches it, in every loaded file. */
const withUses = (found: Found, loaded: Loaded, defs: ReadonlyMap<string, string>): Found => {
  const uses = new Map<string, Site[]>();

  for (const file of Object.keys(loaded.files)) {
    const src = loaded.files[file] ?? "";
    const root = loaded.tree(file);
    const refs = new Map<string, string>();

    for (const [name] of declarations(src, root)) {
      const prefix = defs.get(file + "#" + textOf(src, name));

      if (prefix !== undefined) refs.set(textOf(src, name), prefix);
    }

    for (const { local, imported, specifier } of bindingsOf(src, root)) {
      const target = loaded.resolve(file, specifier);
      const ref = target ? resolveExport(loaded, target, imported) : undefined;
      const prefix = ref && defs.get(ref.file + "#" + ref.name);

      if (prefix !== undefined) refs.set(local, prefix);
    }

    if (refs.size > 0) usesIn(found, loaded, file, refs, uses);
  }

  const out: Found = new Map();

  for (const [key, signal] of found) {
    const sites = uses.get(key);

    out.set(key, sites && signal.prominence === "named" ? { ...signal, uses: sites } : signal);
  }

  return out;
};

/** What a chain does for each call it is made of, so a step can be told from a `loop` or a `map`. */
interface Call {
  readonly method: string;
  readonly call: SyntaxNode;
}

/** The `.to()`, `.set()` and `.rewind()` calls written after a `track(…)`, in order. */
interface Chain {
  readonly top: SyntaxNode;
  readonly calls: readonly Call[];
}

const chainOf = (src: string, start: SyntaxNode): Chain => {
  const calls: Call[] = [];
  let top = start;

  for (;;) {
    const member = top.parent;
    const call = member?.parent;

    if (
      member?.name !== "MemberExpression" ||
      call?.name !== "CallExpression" ||
      !sameNode(member.firstChild, top) ||
      !sameNode(call.firstChild, member)
    )
      break;
    calls.push({ method: textOf(src, member.getChild("PropertyName")), call });
    top = call;
  }

  return { top, calls };
};

/** The curve a step names with a literal: `ease.out` or `ease.bezier(…)`. */
const easeNode = (src: string, node: SyntaxNode | undefined): SyntaxNode | undefined =>
  node && literalOf(src, node)?.lit === "ease" ? node : undefined;

/** The value a step goes to, when it is a number, a color or a string written out. */
const targetNode = (src: string, node: SyntaxNode | undefined): SyntaxNode | undefined => {
  const kind = node && scalarOf(src, node)?.kind;

  return node && (kind === "number" || kind === "color" || kind === "text") ? node : undefined;
};

const rangeOfSpan = (start: number, over: number): Hint => ({
  min: 0,
  max: Math.max(2 * (start + over), 1),
  step: 0.01,
});

/**
 * A signal per step of a `track(…).to(v, span(a, b), ease.out).rewind(d)` and per frame of a `keyframes(…)`: a `to` or
 * `set` with a literal span is a span with the literal sites of its target and curve beside it, a `rewind` is its
 * duration, a frame is its time. A step with anything but literals for its time makes none.
 */
const chainSignals = (
  found: Found,
  file: string,
  src: string,
  root: SyntaxNode,
  starts: readonly number[],
) =>
  root.cursor().iterate((ref) => {
    const callee = ref.name === "CallExpression" ? calleeOf(src, ref.node) : "";

    if (callee !== "track" && callee !== "keyframes") return undefined;
    const { top, calls } = chainOf(src, ref.node);
    const line = lineAt(starts, ref.from);
    const bound = bindingOf(src, top);
    const column = ref.from - (starts[line - 1] ?? 0) + 1;
    const tag = bound === undefined ? "@" + line + ":" + column : "";
    const chain = bound ?? pathOf(src, top).path;
    const prominence: Prominence = bound === undefined ? "deep" : "named";
    let index = 0;

    const emit = (
      key: string,
      kind: SignalKind,
      value: SignalValue,
      sites: readonly SyntaxNode[],
      target: SyntaxNode | undefined,
      curve: SyntaxNode | undefined,
      range: Hint,
    ) => {
      const [first] = sites;

      if (!first) return;

      add(found, {
        key,
        kind,
        value,
        origin: "chain",
        prominence,
        sites: sites.map((site) => siteOf(file, src, site)),
        file,
        line: lineAt(starts, first.from),
        range,
        step: {
          index,
          chain: chain + tag,
          ...(target && { target: siteOf(file, src, target) }),
          ...(curve && { ease: siteOf(file, src, curve) }),
        },
      });
    };

    if (callee === "keyframes") {
      const frames = itemsOf(itemsOf(ref.node.getChild("ArgList"))[0] ?? null);

      frames.forEach((frame, i) => {
        const [time, value, curve] = itemsOf(frame);
        const seconds = numberAt(src, time);

        if (!time || seconds === undefined) return;
        index = i;
        emit(
          chain + ".frame" + i + tag,
          "number",
          seconds,
          [time],
          targetNode(src, value),
          easeNode(src, curve),
          rangeOfSpan(seconds, 0),
        );
      });
    }

    for (const { method, call } of calls) {
      const args = itemsOf(call.getChild("ArgList"));

      if (method === "rewind") {
        const [over, curve] = args;
        const seconds = numberAt(src, over);

        if (over && seconds !== undefined)
          emit(
            chain + ".step" + index + tag,
            "number",
            seconds,
            [over],
            undefined,
            easeNode(src, curve),
            rangeOfSpan(0, seconds),
          );
        index++;
      } else if (method === "to" || method === "set") {
        const [target, when, curve] = args;

        const [startNode, overNode, extra] =
          when?.name === "CallExpression" && calleeOf(src, when) === "span"
            ? itemsOf(when.getChild("ArgList"))
            : [];

        const start = numberAt(src, startNode);
        const over = numberAt(src, overNode);

        if (startNode && overNode && !extra && start !== undefined && over !== undefined)
          emit(
            chain + ".step" + index + tag,
            "span",
            { start, over },
            [startNode, overNode],
            targetNode(src, target),
            easeNode(src, curve),
            rangeOfSpan(start, over),
          );
        index++;
      }
    }

    return undefined;
  });

/** The names a call's arguments are known by, for a label: `circle(7)` sets a radius. */
const ARGS = new Map<string, readonly string[]>([
  ["circle", ["radius"]],
  ["rect", ["width", "height"]],
  ["ellipse", ["x radius", "y radius"]],
  ["line", ["start", "end"]],
  ["span", ["start", "length"]],
]);

interface Where {
  /** Where the literal sits, as a name: `Shape.circle[0]`, `stroke.width`, `bellGeometry`. */
  readonly path: string;
  readonly label: string;
}

interface Segment {
  readonly kind: "call" | "key" | "index";
  readonly text: string;
  readonly name: string;
  readonly at: number;
}

/** The name of the element a JSX attribute is on. */
const elementOf = (src: string, attribute: SyntaxNode): string => {
  const tag = attribute.parent;

  return textOf(src, tag?.getChild("JSXIdentifier")) || "element";
};

/**
 * Where a literal sits, from the nearest named thing around it: a call it is an argument of, a property it is the
 * value of, the JSX prop or the `const` it is inside. `circle(7)` on a `Shape` is `Shape.circle[0]`, a stroke's width
 * `stroke.width`, and a number in the body of `const bell = …` is `bell`.
 */
const pathOf = (src: string, node: SyntaxNode): Where => {
  const segments: Segment[] = [];
  let element = "";
  let attribute = "";
  let named = "";

  for (let at = node; at.parent && !element; at = at.parent) {
    const parent = at.parent;

    if (parent.name === "ArgList" && parent.parent) {
      const name = /([\w$]+)\s*$/.exec(calleeOf(src, parent.parent))?.[1] ?? "call";
      const index = itemsOf(parent).findIndex((item) => sameNode(item, at));

      segments.push({ kind: "call", text: name + "[" + index + "]", name, at: index });
    } else if (parent.name === "Property" && !sameNode(parent.firstChild, at)) {
      const key = parent.firstChild ? keyText(src, parent.firstChild) : undefined;

      if (key !== undefined) segments.push({ kind: "key", text: key, name: key, at: 0 });
    } else if (parent.name === "ArrayExpression") {
      const index = itemsOf(parent).findIndex((item) => sameNode(item, at));

      segments.push({ kind: "index", text: "[" + index + "]", name: "", at: index });
    } else if (parent.name === "JSXAttribute") {
      attribute = textOf(src, parent.firstChild);
      element = elementOf(src, parent);
    } else if (parent.name === "VariableDeclaration" || parent.name === "FunctionDeclaration") {
      named = textOf(src, parent.getChild("VariableDefinition")) || named;
    } else if (parent.name === "JSXElement") {
      element = textOf(src, parent.getChild("JSXOpenTag")?.getChild("JSXIdentifier")) || "element";
    }
  }

  const near: Segment[] = [];

  for (const segment of segments) {
    near.push(segment);

    if (segment.kind === "call") break;
  }

  const outer = near[near.length - 1];

  const root = attribute
    ? outer?.kind === "call"
      ? element
      : outer
        ? attribute
        : element + "." + attribute
    : element || named;

  const tail = [...near]
    .reverse()
    .map((s) => (s.kind === "index" ? s.text : "." + s.text))
    .join("");

  const path = (root + tail).replace(/^\./, "") || "literal";
  const inner = near[0];
  const above = near[1]?.text ?? root;
  const arg = inner?.kind === "call" ? ARGS.get(inner.name)?.[inner.at] : undefined;

  const label =
    inner?.kind === "call"
      ? inner.name + " " + (arg ?? "argument " + (inner.at + 1))
      : inner?.kind === "key" && above
        ? above + " " + inner.name
        : inner === undefined && attribute
          ? attribute + " of " + element
          : "";

  return { path, label: label || textOf(src, node) + " in " + (root || "the scene") };
};

const EASE_NAME = /^ease\.(?:linear|in|out|inOut|pop)$/;

/** Operators that shift or mask bits, which a literal beside is a mask or a seed, not a size. */
const BIT_OPS = /^(?:[&|^]|<<|>>>?)=?$/;

const isBitwise = (src: string, node: SyntaxNode): boolean => {
  for (let at = node.firstChild; at; at = at.nextSibling)
    if ((at.name === "BitOp" || at.name === "UpdateOp") && BIT_OPS.test(textOf(src, at)))
      return true;

  return false;
};

const isTypeNode = (name: string): boolean =>
  name.startsWith("Type") ||
  name.endsWith("Type") ||
  name === "ImportDeclaration" ||
  name === "InterfaceDeclaration";

/**
 * Every literal not named by now, each as a deep signal: numbers (a negative one with its sign), hex colors, `ease.x`
 * and `ease.bezier(…)` anywhere, and a pair of numbers as a point. Not in types or imports, not beside a bit
 * operator, not as an index, not in `params` (those are declared once, above).
 */
const deepSignals = (
  found: Found,
  covered: Set<string>,
  file: string,
  src: string,
  root: SyntaxNode,
  starts: readonly number[],
) => {
  const skipped = new Set<string>();

  const take = (node: SyntaxNode): boolean => {
    const id = node.from + ":" + node.to;

    if (covered.has(id)) return false;
    covered.add(id);

    return true;
  };

  const add1 = (
    node: SyntaxNode,
    kind: SignalKind,
    value: SignalValue,
    sites: readonly Site[],
    range?: Hint,
  ) => {
    const line = lineAt(starts, node.from);
    const column = node.from - (starts[line - 1] ?? 0) + 1;
    const where = pathOf(src, node);

    add(found, {
      key: where.path + "@" + line + ":" + column,
      kind,
      value,
      origin: "literal",
      prominence: "deep",
      sites,
      file,
      line,
      label: where.label,
      ...(range && { range }),
    });
  };

  for (const [name, value] of declarations(src, root))
    if (textOf(src, name) === "params") skipped.add(value.from + ":" + value.to);

  root.cursor().iterate((ref) => {
    const { name } = ref;

    if (isTypeNode(name) || skipped.has(ref.from + ":" + ref.to)) return false;

    switch (name) {
      case "ExportDeclaration":
        return ref.node.getChild("from") ? false : undefined;
      case "BinaryExpression":
      case "AssignmentExpression":
        return isBitwise(src, ref.node) ? false : undefined;
      case "MemberExpression": {
        const node = ref.node;
        const open = node.getChild("[");

        if (open?.nextSibling) {
          skipped.add(open.nextSibling.from + ":" + open.nextSibling.to);

          return undefined;
        }

        if (!EASE_NAME.test(textOf(src, node))) return undefined;

        if (take(node)) add1(node, "ease", textOf(src, node), [siteOf(file, src, node)]);

        return false;
      }

      case "CallExpression": {
        const node = ref.node;

        if (calleeOf(src, node) !== "ease.bezier" || !literalOf(src, node)) return undefined;

        if (take(node)) add1(node, "ease", textOf(src, node), [siteOf(file, src, node)]);

        return false;
      }

      case "ArrayExpression": {
        const node = ref.node;
        const pair = pairOf(src, node);

        if (!pair || covered.has(pair[0].from + ":" + pair[0].to)) return undefined;
        const [x, y] = pair;

        take(x);
        take(y);
        add1(
          node,
          "vec",
          [numberAt(src, x) ?? 0, numberAt(src, y) ?? 0],
          [siteOf(file, src, x), siteOf(file, src, y)],
          rangeOfPair(src, x, y),
        );

        return false;
      }

      case "UnaryExpression":
      case "Number": {
        const node = ref.node;
        const value = numberAt(src, node);

        if (value === undefined) return undefined;
        const site = siteOf(file, src, node);

        if (take(node)) add1(node, "number", value, [site], guessRange(value, site.text));

        return false;
      }

      case "String":
      case "JSXAttributeValue": {
        const body = src.slice(ref.from + 1, ref.to - 1);

        if (!COLOR.test(body)) return false;
        const node = ref.node;
        const site = siteOf(file, src, node);

        if (take(node))
          add1(node, "color", body, [name === "String" ? site : { ...site, jsx: true }]);

        return false;
      }

      default:
        return undefined;
    }
  });
};

/**
 * Every value a scene is written with that a control can turn. Named ones first, in this order: the entry's
 * top-level `const`s (numbers, colors, strings, booleans, eases, a pair as a point, the numbers of a short array as
 * `SIZE[0]`, the fields of an object as `WAVE.width`), the entry's `params` written with literals, every `span(…)` of two
 * number literals, the literal props of elements with an id, the consts and fields the entry imports from files in
 * `files` (`theme.blue`), and a signal for each step of a `track(…)` chain. Then the deep ones: every other number,
 * hex color, ease and point in the entry. Keys are the names as written: `BRASS`, `speed`, `swing` for
 * `const swing = span(0, 2)`, `span@12` for one bound to nothing, `card.opacity`, `Shape.circle[0]@56:28`. Nothing runs.
 */
export const discover = (files: Files, entry: string): Signals => {
  const src = files[entry] ?? "";
  const loaded = new Loaded(files);
  const root = loaded.tree(entry);
  const found: Found = new Map();
  const defs = new Map<string, string>();
  const starts = lineStarts(src);

  for (const [name, value] of declarations(src, root)) {
    const key = textOf(src, name);

    if (key === "params" && value.name === "ObjectExpression") continue;
    defs.set(entry + "#" + key, key);
    constSignals(found, entry, src, key, value);
  }

  for (const [name, value] of declarations(src, root))
    if (textOf(src, name) === "params" && value.name === "ObjectExpression")
      paramSignals(found, entry, src, value);
  spanSignals(found, entry, src, root);
  propSignals(found, files);
  importedSignals(found, loaded, entry, src, root, defs);
  chainSignals(found, entry, src, root, starts);

  const covered = new Set<string>();

  for (const signal of found.values())
    for (const site of [...signal.sites, signal.step?.target, signal.step?.ease])
      if (site?.file === entry) covered.add(site.from + ":" + site.to);

  deepSignals(found, covered, entry, src, root, starts);

  return Object.fromEntries(withUses(found, loaded, defs));
};

/** A text change: the source between `from` and `to`, which read `was` when it was planned, becomes `text`. */
export interface Splice {
  readonly file: string;
  readonly from: number;
  readonly to: number;
  readonly was: string;
  readonly text: string;
}

const invalid = (signal: Signal, issue: string) =>
  Effect.fail(new InvalidValue({ target: signal.key, prop: "", issue }));

/** A number written with as many decimals as the literal or the step, whichever has more, and no trailing zeros. */
export const formatNumber = (value: number, written: string, step?: number): string => {
  const places = Math.min(
    10,
    Math.max(decimalsOf(written), step === undefined ? 0 : decimalsOf(String(step))),
  );

  return String(Number(value.toFixed(places)));
};

/** A string literal in the quotes it was written with. */
const quoted = (site: Site, value: string): string => {
  const first = site.text[0] ?? "";
  const quote = first === "'" || first === "`" ? first : '"';

  if (site.jsx)
    return (
      quote +
      value.replaceAll("&", "&amp;").replaceAll(quote, quote === '"' ? "&quot;" : "&apos;") +
      quote
    );

  const body = JSON.stringify(value).slice(1, -1).replaceAll('\\"', '"');

  return (
    quote +
    (quote === '"' ? body.replaceAll('"', '\\"') : body.replaceAll(quote, "\\" + quote)) +
    quote
  );
};

/** A hex color in the case of the one it replaces. */
const cased = (before: string, after: string): string =>
  /[A-F]/.test(before) && !/[a-f]/.test(before) ? after.toUpperCase() : after.toLowerCase();

const splice = (site: Site, text: string): Splice => ({
  file: site.file,
  from: site.from,
  to: site.to,
  was: site.text,
  text,
});

/**
 * The smallest edits that make the source say `value` for `signal`: the literal is rewritten in place, written as
 * the old one was (decimals, hex case, quotes). Fails with InvalidValue when the value is not of the signal's kind.
 */
export const write = (
  signal: Signal,
  value: SignalValue,
): Effect.Effect<readonly Splice[], InvalidValue> => {
  const [site, second] = signal.sites;

  if (!site) return invalid(signal, "it has no place in the source to write to");

  switch (signal.kind) {
    case "number":
      return isNum(value) && Number.isFinite(value)
        ? Effect.succeed([splice(site, formatNumber(value, site.text, signal.range?.step))])
        : invalid(signal, "it takes a finite number");
    case "span":
      return isSpan(value) && second && Number.isFinite(value.start) && Number.isFinite(value.over)
        ? Effect.succeed([
            splice(site, formatNumber(value.start, site.text, 0.01)),
            splice(second, formatNumber(value.over, second.text, 0.01)),
          ])
        : invalid(signal, "it takes { start, over }, two finite numbers");
    case "vec":
      return isPoint(value) && second && value.every(Number.isFinite)
        ? Effect.succeed([
            splice(site, formatNumber(value[0], site.text, signal.range?.step)),
            splice(second, formatNumber(value[1], second.text, signal.range?.step)),
          ])
        : invalid(signal, "it takes [x, y], two finite numbers");
    case "boolean":
      return value === true || value === false
        ? Effect.succeed([splice(site, site.jsx ? "{" + value + "}" : String(value))])
        : invalid(signal, "it takes true or false");
    case "color":
      return isText(value) && COLOR.test(value)
        ? Effect.succeed([splice(site, quoted(site, cased(site.text, value)))])
        : invalid(signal, "it takes a hex color, #rgb, #rrggbb or #rrggbbaa");
    case "ease":
      return isText(value) && (EASES.includes(value) || BEZIER.test(value))
        ? Effect.succeed([splice(site, site.jsx ? "{" + value + "}" : value)])
        : invalid(signal, "it takes " + EASES.join(", ") + " or ease.bezier(a, b, c, d)");
    case "text":
      return isText(value) && (!signal.options || signal.options.includes(value))
        ? Effect.succeed([splice(site, quoted(site, value))])
        : invalid(
            signal,
            signal.options ? "it takes one of " + signal.options.join(", ") : "it takes a string",
          );
  }
};

/**
 * Applies splices to the files they were planned against. Fails with StaleSource when a file no longer reads what a
 * splice expected, so an edit planned before someone else saved never lands in the wrong place.
 */
export const applySplices = (
  files: Files,
  splices: readonly Splice[],
): Effect.Effect<Files, StaleSource> =>
  Effect.suspend(() => {
    const out = new Map(Object.entries(files));
    const sorted = [...splices].sort((a, b) => b.from - a.from);

    for (const { file, from, to, was, text } of sorted) {
      const src = out.get(file) ?? "";
      const actual = src.slice(from, to);

      if (actual !== was) return Effect.fail(new StaleSource({ file, expected: was, actual }));
      out.set(file, src.slice(0, from) + text + src.slice(to));
    }

    return Effect.succeed(Object.fromEntries(out));
  });

const NAME = /^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z][A-Za-z0-9]*)$/;

const RESERVED = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield undefined NaN Infinity".split(
    " ",
  ),
);

/** The node a signal is written as: its one site, or the array or call that holds its two. */
const writtenAs = (src: string, signal: Signal): { from: number; to: number } | undefined => {
  const [first, second] = signal.sites;

  if (!first) return undefined;

  if (signal.kind !== "vec" && signal.kind !== "span") return first;
  let hit: { from: number; to: number } | undefined;

  parser
    .parse(src)
    .topNode.cursor()
    .iterate((ref) => {
      if (hit || ref.to < first.to || ref.from > first.from) return false;
      const wanted = signal.kind === "vec" ? "ArrayExpression" : "CallExpression";

      if (ref.name !== wanted) return undefined;
      const [x, y] = itemsOf(signal.kind === "vec" ? ref.node : ref.node.getChild("ArgList"));

      if (x?.from === first.from && y?.from === second?.from) hit = { from: ref.from, to: ref.to };

      return undefined;
    });

  return hit;
};

/**
 * The edits that turn a deep literal into a named constant: the literal becomes `name`, and `const name = <literal>;`
 * goes after the imports of its file (before the first statement when there are none). Fails with InvalidValue when
 * the signal is already named or is a step of a chain, when `name` is not UPPER_SNAKE or camelCase, or when the file
 * already uses it.
 */
export const extract = (
  files: Files,
  signal: Signal,
  name: string,
): Effect.Effect<readonly Splice[], InvalidValue> =>
  Effect.suspend(() => {
    const src = files[signal.file];
    const place = src === undefined ? undefined : writtenAs(src, signal);

    if (signal.origin === "chain" || signal.origin === "param")
      return invalid(signal, "a " + signal.origin + " is edited where it is, not extracted");

    if (signal.prominence === "named" && signal.origin !== "prop")
      return invalid(signal, "it is already a named constant");

    if (!NAME.test(name) || RESERVED.has(name))
      return invalid(signal, name + " is not a name: use UPPER_SNAKE or camelCase");

    if (src === undefined || !place || !signal.sites[0])
      return invalid(signal, "it has no place in the source to extract from");
    const root = parser.parse(src).topNode;
    let taken = false;

    root.cursor().iterate((ref) => {
      if (
        ["VariableDefinition", "VariableName", "TypeDefinition", "TypeName"].includes(ref.name) &&
        src.slice(ref.from, ref.to) === name
      )
        taken = true;

      return !taken;
    });

    if (taken) return invalid(signal, name + " is already declared in " + signal.file);
    const literal = src.slice(place.from, place.to);
    const jsx = signal.sites[0].jsx === true;
    let after = -1;

    for (let at = root.firstChild; at; at = at.nextSibling)
      if (at.name === "ImportDeclaration") after = at.to;
    const line = "const " + name + " = " + literal + ";\n";
    const newline = src.indexOf("\n", after);

    const start =
      after === -1 ? (root.firstChild?.from ?? 0) : newline === -1 ? src.length : newline + 1;

    const insert: Splice =
      after === -1
        ? { file: signal.file, from: start, to: start, was: "", text: line + "\n" }
        : {
            file: signal.file,
            from: start,
            to: start,
            was: "",
            text:
              (newline === -1 ? "\n" : "") +
              "\n" +
              line +
              (start >= src.length || src[start] === "\n" ? "" : "\n"),
          };

    return Effect.succeed([
      {
        file: signal.file,
        from: place.from,
        to: place.to,
        was: literal,
        text: jsx ? "{" + name + "}" : name,
      },
      insert,
    ]);
  });

/** Splices as `replaceFile` edits, one per file they change, for a `Session`. */
export const asEdits = (
  files: Files,
  splices: readonly Splice[],
): Effect.Effect<readonly Edit[], StaleSource> =>
  Effect.map(applySplices(files, splices), (next) =>
    [...new Set(splices.map((s) => s.file))].map((file): Edit => ({
      op: "replaceFile",
      file,
      text: next[file] ?? "",
    })),
  );

/** Each signal's value by key. */
export type Values = Readonly<Record<string, SignalValue>>;

export const valuesOf = (signals: Signals): Values =>
  Object.fromEntries(Object.entries(signals).map(([key, signal]) => [key, signal.value]));

/**
 * A control made of other signals: `get` reads one value from theirs, `set` turns a new value back into theirs, in
 * the same order. A lens, so a scene can offer "rhythm" or "spread" in place of the numbers that make it.
 */
export interface Derived<V extends SignalValue = SignalValue> {
  readonly origin: "derived";
  readonly kind: SignalKind;
  readonly label: string;
  /** The keys of the signals it reads and writes. */
  readonly from: readonly string[];
  readonly range?: Hint;
  get(values: readonly SignalValue[]): V;
  set(value: V, values: readonly SignalValue[]): readonly SignalValue[];
}

/** Two number controls as one point to drag in 2D: `x` across, `y` down. */
export interface Pad {
  readonly origin: "pad";
  readonly kind: "pad";
  readonly label: string;
  readonly x: NumberControl;
  readonly y: NumberControl;
}

export type NumberControl = Signal | Derived<number>;

export type Control = Signal | Derived | Pad;

export type Controls = Readonly<Record<string, Control>>;

/** A control's value: a signal's or a derived control's, or `[x, y]` for a pad. */
export type ControlValue = SignalValue | readonly [number, number];

export interface DeriveOptions<V extends SignalValue> {
  readonly kind: SignalKind;
  readonly label: string;
  readonly range?: Hint;
  get(values: readonly SignalValue[]): V;
  set(value: V, values: readonly SignalValue[]): readonly SignalValue[];
}

/**
 * A control that reads several signals and writes them back together.
 *
 * ```ts
 * export const controls = (d) => ({
 *   ...d,
 *   rhythm: derive([d.STAGGER, d.DUR], {
 *     kind: "number",
 *     label: "total time",
 *     get: ([stagger, dur]) => stagger * 5 + dur,
 *     set: (total, [stagger, dur]) => [(stagger * total) / (stagger * 5 + dur), (dur * total) / (stagger * 5 + dur)],
 *   }),
 * });
 * ```
 */
export const derive = <V extends SignalValue>(
  signals: readonly (Signal | undefined)[],
  options: DeriveOptions<V>,
): Derived<V> => {
  const missing = signals.findIndex((signal) => signal === undefined);

  if (missing !== -1)
    throw new Error(
      'derive "' +
        options.label +
        '": signal ' +
        (missing + 1) +
        " is undefined. Is the constant still in the scene?",
    );

  return {
    origin: "derived",
    kind: options.kind,
    label: options.label,
    from: signals.flatMap((signal) => (signal ? [signal.key] : [])),
    ...(options.range && { range: options.range }),
    get: options.get,
    set: options.set,
  };
};

/** Two number controls dragged as one point. */
export const pad = (
  x: NumberControl | undefined,
  y: NumberControl | undefined,
  label?: string,
): Pad => {
  if (!x || !y)
    throw new Error("pad" + (label ? ' "' + label + '"' : "") + ": needs two number controls.");

  return { origin: "pad", kind: "pad", label: label ?? x.label + " × " + y.label, x, y };
};

const read = (values: Values, keys: readonly string[]): SignalValue[] =>
  keys.map((key) => values[key] ?? 0);

/** What a control reads now. */
export const valueOf = (control: Control, values: Values): ControlValue => {
  switch (control.origin) {
    case "derived":
      return control.get(read(values, control.from));
    case "pad": {
      const x = valueOf(control.x, values);
      const y = valueOf(control.y, values);

      return [isNum(x) ? x : 0, isNum(y) ? y : 0];
    }

    default:
      return values[control.key] ?? control.value;
  }
};

/** The signal values that make a control read `value`, by key. Only the signals it changes are listed. */
export const assign = (control: Control, value: ControlValue, values: Values): Values => {
  switch (control.origin) {
    case "derived": {
      if (isPoint(value)) return {};
      const next = control.set(value, read(values, control.from));

      return Object.fromEntries(
        control.from.flatMap((key, i) => (i < next.length ? [[key, next[i] ?? 0]] : [])),
      );
    }

    case "pad":
      return isPoint(value)
        ? { ...assign(control.x, value[0], values), ...assign(control.y, value[1], values) }
        : {};
    default:
      return isPoint(value) && control.kind !== "vec" ? {} : { [control.key]: value };
  }
};

/** The splices that write new values into the signals they belong to. */
export const writeAll = (
  signals: Signals,
  updates: Values,
): Effect.Effect<readonly Splice[], InvalidValue> =>
  Effect.map(
    Effect.forEach(Object.entries(updates), ([key, value]) => {
      const signal = signals[key];

      return signal
        ? write(signal, value)
        : Effect.fail(new InvalidValue({ target: key, prop: "", issue: "no signal has this key" }));
    }),
    (all) => all.flat(),
  );

/** The keys of the signals a control is made of. */
export const sourcesOf = (control: Control): readonly string[] => {
  switch (control.origin) {
    case "derived":
      return control.from;
    case "pad":
      return [...sourcesOf(control.x), ...sourcesOf(control.y)];
    default:
      return [control.key];
  }
};

/** A control as plain JSON for a renderer: what it is, what it reads now, its range and where it is written. */
export interface ControlView {
  readonly key: string;
  readonly origin: Control["origin"];
  readonly kind: SignalKind | "pad";
  readonly label: string;
  readonly value: ControlValue;
  readonly range?: Hint;
  readonly options?: readonly string[];
  /** The keys of the signals it is made of. */
  readonly from: readonly string[];
  readonly sites: readonly Site[];
  readonly line?: number;
  readonly prominence?: Prominence;
  readonly uses?: readonly Site[];
  readonly step?: Step;
  readonly x?: ControlView;
  readonly y?: ControlView;
}

const rangeOf = (control: Control, value: ControlValue): Hint | undefined => {
  if (control.origin === "pad") return undefined;

  if (control.range) return control.range;

  return isNum(value) ? guessRange(value) : undefined;
};

/** A control as JSON, its key given by the record it is in. */
export const view = (
  key: string,
  control: Control,
  signals: Signals,
  values: Values,
): ControlView => {
  const value = valueOf(control, values);
  const from = sourcesOf(control);
  const range = rangeOf(control, value);
  const sites = from.flatMap((source) => signals[source]?.sites ?? []);

  return {
    key,
    origin: control.origin,
    kind: control.kind,
    label: control.label,
    value,
    from,
    sites,
    ...(range && { range }),
    ...(control.origin !== "derived" &&
      control.origin !== "pad" &&
      control.options && { options: control.options }),
    ...(control.origin !== "derived" && control.origin !== "pad" && { line: control.line }),
    ...(control.origin !== "derived" &&
      control.origin !== "pad" && {
        prominence: control.prominence,
        ...(control.uses && { uses: control.uses }),
        ...(control.step && { step: control.step }),
      }),
    ...(control.origin === "pad" && {
      x: view(key + ".x", control.x, signals, values),
      y: view(key + ".y", control.y, signals, values),
    }),
  };
};
