import { SceneError } from "../model/scene-error";
import type { Child, NodeElement, SceneElement } from "./nodes";
import type { StandardSchemaV1, Unparsed } from "./standard";

/** What a registered component is: the name that survives minification, and the schema of its props, if it has one. */
export interface ComponentMeta {
  readonly name: string;
  readonly props?: StandardSchemaV1;
}

type AnyComponent = (props: never) => SceneElement;

const registered = new WeakMap<AnyComponent, ComponentMeta>();

/** The name and props schema `component()` gave a function, or undefined for any other function. */
export const componentMeta = (fn: AnyComponent): ComponentMeta | undefined => registered.get(fn);

export const isComponent = (fn: AnyComponent): boolean => registered.has(fn);

/** What every component takes beside its own props. */
export interface Slots {
  readonly children?: Child;
}

export interface ComponentOptions<Input, Output> {
  /** Stable across minification, unlike the function's own name. It names the component in errors and to `@svjeez/live`. */
  readonly name: string;
  /** A Standard Schema (Zod, Valibot, ArkType, …) for the props. The props the JSX gives are checked against it, and `render` gets its output. */
  readonly props?: StandardSchemaV1<Input, Output>;
  readonly render: (props: Output & Slots) => SceneElement;
}

interface PathSegment {
  readonly key: PropertyKey;
}

const isSegment = (step: PropertyKey | PathSegment): step is PathSegment =>
  typeof step === "object";

const pathOf = (path: readonly (PropertyKey | PathSegment)[] | undefined): string =>
  path && path.length > 0
    ? `${path.map((step) => String(isSegment(step) ? step.key : step)).join(".")}: `
    : "";

const checked = <Output>(
  schema: StandardSchemaV1<unknown, Output>,
  name: string,
  given: Unparsed,
): Output => {
  const result = schema["~standard"].validate(given);

  if (result instanceof Promise)
    throw new SceneError(
      `The props schema of <${name}> validates asynchronously, but a scene is built in one step.`,
      "Use a schema that validates synchronously.",
    );

  if (result.issues)
    throw new SceneError(
      `<${name}> got props its schema rejects: ${result.issues.map((issue) => `${pathOf(issue.path)}${issue.message}`).join("; ")}.`,
      "Pass props the schema accepts.",
    );

  return result.value;
};

const SLOTS: ReadonlySet<string> = new Set(["id", "key", "children"]);

const childrenOf = (given: Slots): Slots =>
  given.children === undefined ? {} : { children: given.children };

/**
 * A component with a name that survives minification and, optionally, a Standard Schema for its props. It is called
 * from JSX like any function component, and also takes `id` and `children`: an `id` scopes the ids written inside it
 * (`<NoteCard id="card1">` holding `<Text id="note">` makes `card1/note`).
 */
export const component = <Input = {}, Output = {}>(
  options: ComponentOptions<Input, Output>,
): ((props: Input & Slots & { readonly id?: string }) => SceneElement) => {
  const { name, props: schema, render } = options;

  if (name === "")
    throw new SceneError(
      'component() needs a name, as in component({ name: "NoteCard", render }).',
    );

  const fn = (
    given: Input & Slots & { readonly id?: string; readonly key?: string },
  ): SceneElement => {
    const slots = childrenOf(given);

    const rest = Object.fromEntries(Object.entries(given).filter(([prop]) => !SLOTS.has(prop)));

    // SAFETY: with no schema, Input and Output are both the default {}: the props are passed on as given.
    const value = schema ? checked(schema, name, rest) : (rest as Output);

    const element = render({ ...value, ...slots });

    return given.key === undefined ? element : withKey(element, given.key);
  };

  registered.set(fn, { name, ...(schema && { props: schema }) });

  return fn;
};

const isNode = (element: SceneElement): element is NodeElement =>
  element.type === "group" ||
  element.type === "shape" ||
  element.type === "text" ||
  element.type === "picture";

const setProps = (element: NodeElement, given: { readonly id?: string; readonly key?: string }) => {
  switch (element.type) {
    case "group":
      return { ...element, props: { ...element.props, ...given } };
    case "shape":
      return { ...element, props: { ...element.props, ...given } };
    case "text":
      return { ...element, props: { ...element.props, ...given } };
    case "picture":
      return { ...element, props: { ...element.props, ...given } };
  }
};

const setId = (element: NodeElement, id: string): NodeElement => setProps(element, { id });

/** The element with this key, which it keeps over any it wrote: a list of one component needs a key per instance. */
const withKey = (element: SceneElement, key: string): SceneElement =>
  isNode(element)
    ? setProps(element, { key })
    : { type: "group", props: { key }, children: [element] };

/** The element with this id: set on a node that has none, otherwise the element goes in a <Group> that has it. */
export const withId = (element: SceneElement, id: string): SceneElement =>
  isNode(element) && element.props.id === undefined
    ? setId(element, id)
    : { type: "group", props: { id }, children: [element] };

/**
 * What a plain function component wrote, with `id`: its own `id` of `raw` made `id` (its path through the components
 * it was written in), or else `id` put on what it wrote, as `component()` does.
 */
export const scopedAs = (element: SceneElement, raw: string, id: string): SceneElement =>
  isNode(element) && element.props.id === raw ? setId(element, id) : withId(element, id);
