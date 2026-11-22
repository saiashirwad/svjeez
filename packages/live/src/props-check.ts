import { Effect } from "effect";
import type { StandardSchemaV1 } from "svjeez";
import { InvalidValue } from "./errors.ts";
import type { Program } from "./program.ts";
import { elementOf } from "./source.ts";
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

/** Fails with `InvalidValue` when a `set` or `insert` writes a prop value its component's props schema rejects. */
export const checkEdit = (
  parsed: Parsed,
  program: Program,
  e: Edit,
): Effect.Effect<void, InvalidValue> => {
  if (e.op === "set") {
    const el = elementOf(parsed, e.target);

    return el
      ? checkProps(
          program,
          e.target,
          el.component,
          { ...literalsOf(parsed, e.target), [e.prop]: e.value },
          [e.prop],
        )
      : Effect.void;
  }

  if (e.op === "insert") {
    const props = e.element.props ?? {};
    const parent = elementOf(parsed, e.parent);
    const full = parent?.scope ? `${parent.scope}/${e.element.id}` : e.element.id;

    return checkProps(program, full, e.element.component, props, Object.keys(props));
  }

  return Effect.void;
};
