import type { SyntaxNode } from "@lezer/common";
import { parser as js } from "@lezer/javascript";
import { Effect, Result } from "effect";
import { InvalidValue, StaleSource } from "./errors.ts";
import { literalOf, parse } from "./source.ts";
import { isNumber, isString } from "./text.ts";
import type { Attribute, Edit, Files, Json, JsonObject } from "./types.ts";

/*
 * Signals: every constant a scene is written with, found in its source text and written back as the smallest edit.
 * Nothing here runs the scene, renders or serves. A host (the dev server, an editor, an agent) reads the signals,
 * composes them into controls, and turns a control's new value into text edits.
 */

const parser = js.configure({ dialect: "jsx ts" });

export type SignalKind = "number" | "color" | "text" | "boolean" | "ease" | "span";

/** Where a signal came from: a top-level `const`, the scene's `params`, a `span(…)` call or a literal JSX prop. */
export type Origin = "const" | "param" | "span" | "prop";

/** A `span(start, over)` written with two number literals. */
export interface Span {
  readonly start: number;
  readonly over: number;
}

export type SignalValue = number | string | boolean | Span;

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

/** One value the source is written with. Plain JSON. */
export interface Signal {
  readonly key: string;
  readonly kind: SignalKind;
  readonly value: SignalValue;
  readonly label: string;
  readonly origin: Origin;
  /** One site, or two for a span: its start, then its length. */
  readonly sites: readonly Site[];
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

type Draft = Omit<Signal, "label">;

const add = (found: Found, draft: Draft) => {
  const key = fresh(found, draft.key);

  found.set(key, { ...draft, key, label: key });
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
) => {
  const site = siteOf(file, src, node);

  add(found, {
    key,
    kind: "number",
    value,
    origin,
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
      sites: [site],
      file,
      line: lineOf(src, site.from),
      ...(constructor === "choice" &&
        Array.isArray(declared) && { options: declared.filter(isString) }),
    });
  }
};

/** A `span(0.2, 1.2)` of two number literals, as one signal with a site for each. False when it is not one. */
const spanSignal = (found: Found, file: string, src: string, call: SyntaxNode, key: string) => {
  const [startNode, overNode, extra] = itemsOf(call.getChild("ArgList"));
  const start = numberAt(src, startNode);
  const over = numberAt(src, overNode);

  if (!startNode || !overNode || extra || start === undefined || over === undefined) return false;

  add(found, {
    key,
    kind: "span",
    value: { start, over },
    origin: "span",
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

    spanSignal(found, file, src, call, bindingOf(src, call) ?? "span@" + lineOf(src, call.from));

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
        sites: [site],
        file: site.file,
        line: lineOf(src, site.from),
        ...(isNumber(value) && { range: guessRange(value, site.text) }),
      });
    }
};

/**
 * Every value a scene is written with that a control can turn, in this order: the entry's top-level `const`s
 * (numbers, colors, strings, booleans, eases, and each number of a short array, as `SIZE[0]`), the entry's
 * `params` written with literals, every `span(…)` in the entry of two number literals, then the literal props of
 * elements with an id in any of the files. Keys are the names as written: `BRASS`, `speed`, `swing` for
 * `const swing = span(0, 2)`, `span@12` for one bound to nothing, `card.opacity`. Nothing runs.
 */
export const discover = (files: Files, entry: string): Signals => {
  const src = files[entry] ?? "";
  const root = parser.parse(src).topNode;
  const found: Found = new Map();
  const consts: Found = new Map();

  for (const [name, value] of declarations(src, root)) {
    const key = src.slice(name.from, name.to);

    if (key === "params" && value.name === "ObjectExpression") continue;
    const items = value.name === "ArrayExpression" ? itemsOf(value) : [];

    if (
      items.length >= 2 &&
      items.length <= 4 &&
      items.every((item) => numberAt(src, item) !== undefined)
    ) {
      items.forEach((item, i) =>
        numberSignal(
          consts,
          entry,
          src,
          key + "[" + i + "]",
          "const",
          item,
          numberAt(src, item) ?? 0,
        ),
      );
      continue;
    }

    const scalar = scalarOf(src, value);

    if (!scalar) continue;

    if (isNum(scalar.value)) {
      numberSignal(consts, entry, src, key, "const", value, scalar.value);
      continue;
    }

    const site = siteOf(entry, src, value);

    add(consts, {
      key,
      kind: scalar.kind,
      value: scalar.value,
      origin: "const",
      sites: [site],
      file: entry,
      line: lineOf(src, site.from),
    });
  }

  for (const [key, signal] of consts) found.set(key, signal);

  for (const [name, value] of declarations(src, root))
    if (src.slice(name.from, name.to) === "params" && value.name === "ObjectExpression")
      paramSignals(found, entry, src, value);
  spanSignals(found, entry, src, root);
  propSignals(found, files);

  return Object.fromEntries(found);
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

const isPoint = (value: ControlValue): value is readonly [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(isNum);

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
      return isPoint(value) ? {} : { [control.key]: value };
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
    ...(control.origin === "pad" && {
      x: view(key + ".x", control.x, signals, values),
      y: view(key + ".y", control.y, signals, values),
    }),
  };
};
