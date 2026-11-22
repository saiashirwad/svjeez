import { Effect } from "effect";
import {
  DuplicateId,
  InvalidValue,
  NotEditable,
  StaleSource,
  UnknownId,
  type EditError,
} from "./errors.ts";
import { chainOf, elementOf, parse } from "./source.ts";
import { attributeValue, hash, PROTOTYPE_KEYS, unified } from "./text.ts";
import type {
  Attribute,
  Change,
  Edit,
  Element,
  Files,
  Id,
  Json,
  Parsed,
  Position,
  Ref,
} from "./types.ts";

interface TextEdit {
  readonly file: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

const PROP = /^[A-Za-z_$][\w$-]*$/;
const COMPONENT = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const LOCAL_ID = /^[A-Za-z0-9_-]+$/;

const applyText = (files: Files, edits: readonly TextEdit[]): Files => {
  const out = new Map(Object.entries(files));
  const sorted = [...edits].sort((a, b) => b.from - a.from);

  sorted.forEach((later, i) => {
    const earlier = sorted[i + 1];

    if (earlier && earlier.file === later.file && earlier.to > later.from)
      throw new Error(`Two edits overlap in ${later.file}, at ${later.from}.`);
  });

  for (const { file, from, to, text } of sorted) {
    const src = out.get(file) ?? "";

    out.set(file, src.slice(0, from) + text + src.slice(to));
  }

  return Object.fromEntries(out);
};

const isAfter = (at: Position): at is { readonly after: Id } => typeof at === "object";

const src = (parsed: Parsed, file: string) => parsed.files[file] ?? "";

const lineStart = (text: string, offset: number) => text.lastIndexOf("\n", offset - 1) + 1;

const indentAt = (text: string, offset: number) => {
  return /^[ \t]*/.exec(text.slice(lineStart(text, offset)))?.[0] ?? "";
};

/** Whether only whitespace sits between the start of the line and `offset`. */
const startsLine = (text: string, offset: number) =>
  /^[ \t]*$/.test(text.slice(lineStart(text, offset), offset));

const own = (props: Readonly<Record<string, Attribute>>, name: string): Attribute | undefined =>
  Object.hasOwn(props, name) ? props[name] : undefined;

/** The lines after the first lose `indent`, so the text can be placed at any depth. */
const dedent = (text: string, indent: string) =>
  text
    .split("\n")
    .map((line, i) => (i > 0 && line.startsWith(indent) ? line.slice(indent.length) : line))
    .join("\n");

/** The lines after the first gain `indent`; blank lines stay blank. */
const reindent = (text: string, indent: string) =>
  text
    .split("\n")
    .map((line, i) => (i > 0 && line ? indent + line : line))
    .join("\n");

const need = (parsed: Parsed, target: Id): Effect.Effect<Element, UnknownId | DuplicateId> => {
  const twice = parsed.duplicates.find((d) => d.id === target);

  if (twice) return Effect.fail(new DuplicateId({ id: twice.id, ranges: twice.ranges }));
  const found = elementOf(parsed, target);

  return found ? Effect.succeed(found) : Effect.fail(new UnknownId({ target }));
};

const checkProp = (target: Id, prop: string): Effect.Effect<void, InvalidValue | NotEditable> => {
  if (prop.startsWith("..."))
    return Effect.fail(new NotEditable({ target, prop, reason: "spread" }));

  if (PROTOTYPE_KEYS.has(prop))
    return Effect.fail(
      new InvalidValue({ target, prop, issue: `the prop name "${prop}" is not allowed` }),
    );

  if (!PROP.test(prop))
    return Effect.fail(new InvalidValue({ target, prop, issue: "this is not a prop name" }));

  if (prop === "id")
    return Effect.fail(new InvalidValue({ target, prop, issue: 'use "rename" to change an id' }));

  return Effect.void;
};

const written = (target: Id, prop: string, value: Json, previous?: Attribute) => {
  const out = attributeValue(value, previous);

  return "issue" in out
    ? Effect.fail(new InvalidValue({ target, prop, issue: out.issue }))
    : Effect.succeed(out.text);
};

/** Where and how a new attribute goes: after the last one, on its own line when that one is. */
const addAttribute = (parsed: Parsed, el: Element, text: string): TextEdit => {
  const file = el.range.file;
  const last = el.attributes.at(-1);
  const at = last ? last.range.to : el.nameEnd;
  const code = src(parsed, file);

  return {
    file,
    from: at,
    to: at,
    text:
      last && startsLine(code, last.range.from)
        ? `\n${indentAt(code, last.range.from)}${text}`
        : ` ${text}`,
  };
};

const setProp = (parsed: Parsed, e: Extract<Edit, { op: "set" }>) =>
  Effect.gen(function* () {
    const el = yield* need(parsed, e.target);

    yield* checkProp(e.target, e.prop);
    const existing = own(el.props, e.prop);

    if (existing && existing.kind !== "literal")
      return yield* Effect.fail(
        new NotEditable({ target: e.target, prop: e.prop, reason: existing.kind }),
      );
    const value = yield* written(e.target, e.prop, e.value, existing);
    const file = el.range.file;

    if (!existing) return applyText(parsed.files, [addAttribute(parsed, el, `${e.prop}${value}`)]);

    if (existing.kind === "literal" && existing.valueRange)
      return applyText(parsed.files, [
        { file, from: existing.valueRange.from, to: existing.valueRange.to, text: value.slice(1) },
      ]);

    return applyText(parsed.files, [
      { file, from: existing.range.to, to: existing.range.to, text: value },
    ]);
  });

const unsetProp = (parsed: Parsed, e: Extract<Edit, { op: "unset" }>) =>
  Effect.gen(function* () {
    const el = yield* need(parsed, e.target);

    yield* checkProp(e.target, e.prop);
    const existing = own(el.props, e.prop);

    if (!existing) return parsed.files;

    if (existing.kind !== "literal")
      return yield* Effect.fail(
        new NotEditable({ target: e.target, prop: e.prop, reason: existing.kind }),
      );
    const index = el.attributes.indexOf(existing);
    const before = el.attributes[index - 1];

    return applyText(parsed.files, [
      {
        file: el.range.file,
        from: before ? before.range.to : el.nameEnd,
        to: existing.range.to,
        text: "",
      },
    ]);
  });

const elementText = (
  component: string,
  id: string,
  props: Readonly<Record<string, Json>>,
  target: Id,
) =>
  Effect.gen(function* () {
    const parts = [`id="${id}"`];

    for (const [prop, value] of Object.entries(props)) {
      yield* checkProp(target, prop);
      parts.push(`${prop}${yield* written(target, prop, value)}`);
    }

    return `<${component} ${parts.join(" ")} />`;
  });

/** The edit that puts `text` (written for column 0) in `parent` at `at`. */
const place = (
  parsed: Parsed,
  parent: Element,
  at: Position,
  text: string,
  moving?: Id,
): Effect.Effect<TextEdit, UnknownId | InvalidValue> =>
  Effect.gen(function* () {
    const file = parent.range.file;
    const code = src(parsed, file);
    const parentIndent = indentAt(code, parent.range.from);
    const kids = parent.children.filter((id) => id !== moving);
    const first = kids[0] ? elementOf(parsed, kids[0]) : undefined;

    const unit =
      first && startsLine(src(parsed, first.range.file), first.range.from)
        ? indentAt(src(parsed, first.range.file), first.range.from).slice(parentIndent.length) ||
          "  "
        : "  ";

    const childIndent = parentIndent + unit;

    if (isAfter(at)) {
      const anchor = kids.includes(at.after) ? elementOf(parsed, at.after) : undefined;

      if (!anchor) return yield* Effect.fail(new UnknownId({ target: at.after }));
      const anchorCode = src(parsed, anchor.range.file);
      const own = startsLine(anchorCode, anchor.range.from);
      const indent = indentAt(anchorCode, anchor.range.from);

      return {
        file: anchor.range.file,
        from: anchor.range.to,
        to: anchor.range.to,
        text: own ? `\n${indent}${reindent(text, indent)}` : text,
      };
    }

    if (!Number.isInteger(at) || at < 0 || at > kids.length)
      return yield* Effect.fail(
        new InvalidValue({
          target: parent.id,
          prop: "",
          issue: `at must be a whole number from 0 to ${kids.length}`,
        }),
      );
    const anchor = kids[at] ? elementOf(parsed, kids[at]) : undefined;

    if (anchor) {
      const anchorCode = src(parsed, anchor.range.file);
      const indent = indentAt(anchorCode, anchor.range.from);
      const own = startsLine(anchorCode, anchor.range.from);

      return {
        file: anchor.range.file,
        from: anchor.range.from,
        to: anchor.range.from,
        text: own ? `${reindent(text, indent)}\n${indent}` : text,
      };
    }

    const body = reindent(text, childIndent);

    if (parent.selfClosing) {
      const last = parent.attributes.at(-1);
      const end = last ? last.range.to : parent.nameEnd;

      return {
        file,
        from: end,
        to: parent.open.to,
        text: `>\n${childIndent}${body}\n${parentIndent}</${parent.component}>`,
      };
    }

    const content = code.slice(parent.open.to, parent.closeStart);

    if (!content.trim())
      return {
        file,
        from: parent.open.to,
        to: parent.closeStart,
        text: `\n${childIndent}${body}\n${parentIndent}`,
      };
    const end = parent.open.to + content.trimEnd().length;

    return { file, from: end, to: end, text: `\n${childIndent}${body}` };
  });

const insertElement = (parsed: Parsed, e: Extract<Edit, { op: "insert" }>) =>
  Effect.gen(function* () {
    const parent = yield* need(parsed, e.parent);
    const { component, id, props = {} } = e.element;

    if (!COMPONENT.test(component))
      return yield* Effect.fail(
        new InvalidValue({ target: id, prop: "", issue: "this is not a component name" }),
      );

    if (!LOCAL_ID.test(id))
      return yield* Effect.fail(
        new InvalidValue({ target: id, prop: "id", issue: "an id is letters, digits, _ and -" }),
      );
    const full = parent.scope ? `${parent.scope}/${id}` : id;
    const clash = elementOf(parsed, full);

    if (clash)
      return yield* Effect.fail(new DuplicateId({ id: full, ranges: [clash.range, parent.range] }));
    const text = yield* elementText(component, id, props, full);

    return applyText(parsed.files, [yield* place(parsed, parent, e.at, text)]);
  });

/** The whole lines an element is alone on, else just the element. */
const removal = (parsed: Parsed, el: Element): TextEdit => {
  const code = src(parsed, el.range.file);
  const rest = /^[ \t]*(?:\r?\n|$)/.exec(code.slice(el.range.to));

  return startsLine(code, el.range.from) && rest
    ? {
        file: el.range.file,
        from: lineStart(code, el.range.from),
        to: el.range.to + rest[0].length,
        text: "",
      }
    : { file: el.range.file, from: el.range.from, to: el.range.to, text: "" };
};

const removeElement = (parsed: Parsed, e: Extract<Edit, { op: "remove" }>) =>
  Effect.gen(function* () {
    const el = yield* need(parsed, e.target);

    if (el.parent === undefined)
      return yield* Effect.fail(
        new InvalidValue({
          target: e.target,
          prop: "",
          issue: "an element with no parent can't be removed",
        }),
      );

    return applyText(parsed.files, [removal(parsed, el)]);
  });

const moveElement = (parsed: Parsed, e: Extract<Edit, { op: "move" }>) =>
  Effect.gen(function* () {
    const el = yield* need(parsed, e.target);
    const parent = yield* need(parsed, e.parent);

    const refuse = (issue: string) =>
      Effect.fail(new InvalidValue({ target: e.target, prop: "", issue }));

    if (el.parent === undefined) return yield* refuse("an element with no parent can't be moved");

    if (parent.scope !== el.scope)
      return yield* refuse("moving between components would change its id");

    for (
      let up: Element | undefined = parent;
      up;
      up = up.parent ? elementOf(parsed, up.parent) : undefined
    )
      if (up.id === el.id) return yield* refuse("an element can't move into itself");

    if (isAfter(e.at) && e.at.after === el.id)
      return yield* refuse("an element can't move after itself");
    const code = src(parsed, el.range.file);
    const text = dedent(code.slice(el.range.from, el.range.to), indentAt(code, el.range.from));
    const position = yield* place(parsed, parent, e.at, text, el.id);
    const removed = removal(parsed, el);

    // The removal and the insertion are in the same text, so both are made against the ranges as parsed.
    return applyText(parsed.files, [removed, position]);
  });

const renameElement = (parsed: Parsed, e: Extract<Edit, { op: "rename" }>) =>
  Effect.gen(function* () {
    const el = yield* need(parsed, e.target);

    if (!LOCAL_ID.test(e.to))
      return yield* Effect.fail(
        new InvalidValue({
          target: e.target,
          prop: "id",
          issue: "an id is letters, digits, _ and -",
        }),
      );

    if (e.to === el.local) return parsed.files;
    const full = el.scope ? `${el.scope}/${e.to}` : e.to;
    const clash = elementOf(parsed, full);

    if (clash)
      return yield* Effect.fail(new DuplicateId({ id: full, ranges: [clash.range, el.range] }));
    const code = src(parsed, el.idRange.file);

    const written =
      code[el.idRange.from] === "{"
        ? `{"${e.to}"}`
        : `${code[el.idRange.from]}${e.to}${code[el.idRange.from]}`;

    const edits: TextEdit[] = [{ ...el.idRange, text: written }];

    for (const ref of parsed.refs) {
      const rewritten = renamedRef(parsed, ref, el, full, e.to);

      if (rewritten === undefined) continue;
      const quote = src(parsed, ref.range.file)[ref.range.from] ?? '"';

      edits.push({ ...ref.range, text: `${quote}${rewritten}${quote}` });
    }

    return applyText(parsed.files, edits);
  });

/**
 * What a `ref` becomes when `el` is renamed, or undefined when it doesn't point at `el` or below it. A ref follows
 * core's lookup, innermost first: inside a component, a name that component has an element for means that element,
 * so renaming a scene element of the same name leaves it alone.
 */
const renamedRef = (
  parsed: Parsed,
  { id, scope }: Ref,
  el: Element,
  full: Id,
  to: string,
): string | undefined => {
  const head = id.split("/")[0] ?? "";
  const shadow = scope ? elementOf(parsed, `${scope}/${head}`) : undefined;

  if (!shadow && (id === el.id || id.startsWith(`${el.id}/`))) return full + id.slice(el.id.length);

  if (scope && scope === el.scope && (id === el.local || id.startsWith(`${el.local}/`)))
    return to + id.slice(el.local.length);

  // `card1/note` reaches `NoteCard/note` through the instance `card1`: only its last segment names `el`.
  const at = chainOf(parsed, scope, id)?.findIndex((step) => step === el) ?? -1;

  if (at > 0) return id.split("/").with(at, to).join("/");

  return undefined;
};

const applyOne = (parsed: Parsed, e: Edit): Effect.Effect<Files, EditError> => {
  switch (e.op) {
    case "set":
      return setProp(parsed, e);
    case "unset":
      return unsetProp(parsed, e);
    case "insert":
      return insertElement(parsed, e);
    case "remove":
      return removeElement(parsed, e);
    case "move":
      return moveElement(parsed, e);
    case "rename":
      return renameElement(parsed, e);
  }
};

const targetOf = (e: Edit): Id => (e.op === "insert" ? e.parent : e.target);

/**
 * Apply edits in order, each against the source the one before left. Only the text an edit names changes, so
 * everything else reprints byte for byte. Pass `current` (the files as they are now) to refuse edits planned
 * against source that has since changed.
 */
export const edit = (
  parsed: Parsed,
  edits: readonly Edit[],
  current?: Files,
): Effect.Effect<Change, EditError> =>
  Effect.gen(function* () {
    for (const [file, text] of Object.entries(current ?? {})) {
      const expected = parsed.hashes[file];
      const actual = hash(text);

      if (expected !== undefined && expected !== actual)
        return yield* Effect.fail(new StaleSource({ file, expected, actual }));
    }

    let state = parsed;

    for (const e of edits) {
      const files = yield* applyOne(state, e);

      state = yield* parse(files).pipe(
        Effect.mapError(
          (error) =>
            new InvalidValue({
              target: targetOf(e),
              prop: "",
              issue: `the edit would leave ${error.file} unparseable: line ${error.line}`,
            }),
        ),
      );
    }

    const diff = Object.keys(state.files)
      .map((file) => unified(file, parsed.files[file] ?? "", state.files[file] ?? ""))
      .join("");

    return { files: state.files, diff };
  });
