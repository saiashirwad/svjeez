import { Effect } from "effect";
import type { StandardSchemaV1 } from "svjeez";
import { InvalidValue } from "./errors.ts";
import type { Program } from "./program.ts";
import { elementOf, registeredName } from "./source.ts";
import type { Edit, Json, Parsed } from "./types.ts";

type Issue = StandardSchemaV1.Issue;

const isSegment = (
  segment: PropertyKey | StandardSchemaV1.PathSegment,
): segment is StandardSchemaV1.PathSegment => typeof segment === "object";

const key = (segment: PropertyKey | StandardSchemaV1.PathSegment): string =>
  String(isSegment(segment) ? segment.key : segment);

/** Where an issue is, as `size.0`, or `""` for the value as a whole. */
export const issuePath = (issue: Issue): string => (issue.path ?? []).map(key).join(".");

/** An issue as one line: `size.0: Expected a number`. */
export const issueText = (issue: Issue): string => {
  const path = issuePath(issue);

  return path ? `${path}: ${issue.message}` : issue.message;
};

/** The first prop an issue is about, when it names one. */
const propOf = (issue: Issue): string | undefined => {
  const first = issue.path?.[0];

  return first === undefined ? undefined : key(first);
};

/**
 * Checks the props an edit writes against the component's props schema. The schema sees only the literal props known
 * here, so an issue counts only when it is about a prop the edit writes: a missing prop that is a param or an
 * expression in the source is none of its business. A schema that validates asynchronously is not consulted.
 */
const checkProps = (
  program: Program,
  target: string,
  component: string,
  known: Readonly<Record<string, Json>>,
  written: readonly string[],
): Effect.Effect<void, InvalidValue> => {
  const schema = Object.hasOwn(program.components, component)
    ? program.components[component]?.props
    : undefined;

  if (!schema) return Effect.void;
  const result = schema["~standard"].validate(known);

  if (result instanceof Promise || !result.issues) return Effect.void;

  const issue = result.issues.find((i) => {
    const prop = propOf(i);

    return prop !== undefined && written.includes(prop);
  });

  return issue
    ? Effect.fail(new InvalidValue({ target, prop: propOf(issue) ?? "", issue: issueText(issue) }))
    : Effect.void;
};

/** The literal props an element is written with. */
const literalsOf = (parsed: Parsed, id: string): Readonly<Record<string, Json>> => {
  const el = elementOf(parsed, id);

  return Object.fromEntries(
    Object.entries(el?.props ?? {}).flatMap(([name, attribute]) =>
      attribute.kind === "literal" ? [[name, attribute.value] as const] : [],
    ),
  );
};

/** The id an element has after `rename` gives it a new local id. */
const renamedTo = (target: string, to: string): string =>
  `${target.slice(0, target.lastIndexOf("/") + 1)}${to}`;

/**
 * Fails with `InvalidValue` when the props a batch writes are ones their component's props schema rejects. The check
 * reads the source the whole batch made, not the source each edit started from: a batch that moves `max` and then `min`
 * is fine in the end, an element an earlier edit inserted or renamed is checked under its new id, and an `unset` is
 * checked as a prop that is no longer there.
 */
export const checkEdits = (
  candidate: Parsed,
  program: Program,
  edits: readonly Edit[],
): Effect.Effect<void, InvalidValue> => {
  const written = new Map<string, Set<string>>();

  const note = (id: string, props: Iterable<string>) =>
    written.set(id, new Set([...(written.get(id) ?? []), ...props]));

  for (const e of edits) {
    if (e.op === "set" || e.op === "unset") note(e.target, [e.prop]);
    else if (e.op === "insert") {
      // The parent's scope is its id up to the last `/`, which holds even if an earlier edit renamed it.
      const cut = e.parent.lastIndexOf("/");

      note(
        cut < 0 ? e.element.id : `${e.parent.slice(0, cut)}/${e.element.id}`,
        Object.keys(e.element.props ?? {}),
      );
    } else if (e.op === "rename") {
      const props = written.get(e.target);

      if (props) {
        written.delete(e.target);
        note(renamedTo(e.target, e.to), props);
      }
    }
  }

  return Effect.forEach(
    written,
    ([id, props]) => {
      const el = elementOf(candidate, id);

      return el
        ? checkProps(program, id, registeredName(candidate, el), literalsOf(candidate, id), [
            ...props,
          ])
        : Effect.void;
    },
    { discard: true },
  );
};
