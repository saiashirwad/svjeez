import { thrownFrom } from "../svg/traced";
import { SceneError, located } from "../model/scene-error";
import type { Seconds } from "../model/time";
import { componentName } from "../jsx-runtime";
import { componentMeta, scopedAs, withId } from "./component";
import { isElement, type TextContent } from "./count";
import { sourced, sourceFrom, writtenAt } from "./identity";
import { flat, type Child, type Common, type SceneElement, type TextChild } from "./nodes";
import { scoped, within } from "./scope";
import { isString } from "../model/guards";

type Call = Extract<SceneElement, { readonly type: "call" }>;

interface Provided {
  readonly context: object;
  readonly value: {} | null | undefined;
}

/** The values the contexts above the element being expanded provide, nearest last. */
let provided: readonly Provided[] = [];

const withProvided = <T>(stack: readonly Provided[], build: () => T): T => {
  const before = provided;
  provided = stack;

  try {
    return build();
  } finally {
    provided = before;
  }
};

export interface Context<T> {
  (props: { readonly value: T; readonly children?: Child }): SceneElement;
  /** The value of the nearest provider above the element being rendered, or the initial one outside any. */
  readonly read: () => T;
}

/** A value that every component under a `<Name value={…}>` can read, however deep, without taking it as a prop. */
export const context = <T>(initial: T): Context<T> => {
  const provide = ({
    value,
    children,
  }: {
    readonly value: T;
    readonly children?: Child;
  }): SceneElement => ({ type: "provide", context: provide, value, children: flat(children) });

  const read = (): T => {
    const found = provided.findLast((entry) => entry.context === provide);

    // SAFETY: only provide() above writes an entry for this context, and it writes a T.
    return found ? (found.value as T) : initial;
  };

  return Object.assign(provide, { read });
};

/** The props a JSX element was written with, when it is a call of `component`: what `<Card size={…}>` gave `Card`. */
export const propsOf = <P>(
  element: SceneElement,
  component: (props: P) => SceneElement,
): P | undefined =>
  // SAFETY: a call of `component` was written with its props.
  element.type === "call" && element.component === component ? (element.props as P) : undefined;

const run = (call: Call): SceneElement => {
  const { component, props, key, scope } = call;
  const at = writtenAt(call);
  const name = componentName(component);
  const given = key === undefined ? props : { ...props, key };
  const id = "id" in props && isString(props.id) ? props.id : undefined;

  try {
    return within(scope, () => {
      // SAFETY: the JSX that wrote the call checked the props against the component.
      const render = () => expand(component(given as never));

      if (id === undefined) return render();
      const path = scoped(id);

      if (componentMeta(component)) return withId(within([...scope, id], render), path, key);

      return scopedAs(render(), id, path, key);
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const thrown = thrownFrom(error);

    throw located(error, {
      ...(name && { node: `<${name}>` }),
      ...((thrown ? sourceFrom(thrown) : at) && { source: thrown ? sourceFrom(thrown) : at! }),
    });
  }
};

function inText(child: TextChild): TextChild;
function inText(child: TextContent): TextContent;
function inText(child: TextContent): TextContent {
  if (Array.isArray(child)) return child.map(inText);

  return isElement(child) ? expand(child) : child;
}

const masked = <P extends Pick<Common, "mask">>(props: P): P => {
  const { mask } = props;

  if (mask === undefined) return props;
  const held = provided;

  return {
    ...props,
    mask:
      mask instanceof Function
        ? (own) => withProvided(held, () => flat(mask(own)).map(expand))
        : flat(mask).map(expand),
  };
};

/** How long what is at the root of an element plays: the end of its last `<Sequence>`, seen through fragments and groups. */
export const rootLength = (element: SceneElement): Seconds | undefined => {
  if (element.type === "sequence") return element.start + (element.over ?? 0);

  if (element.type !== "fragment" && element.type !== "group") return undefined;
  const ends = element.children.flatMap((child) => rootLength(child) ?? []);

  return ends.length === 0 ? undefined : Math.max(...ends);
};

/** How long an element plays, expanded the way `<Series>` expands its children: for a footer that spans a series, or a `still` before its end. */
export const durationOf = (element: SceneElement): Seconds => {
  const length = rootLength(expand(element));

  if (length === undefined)
    throw new SceneError(
      "durationOf() has no length to give: the element holds no <Sequence> at its root.",
      "Wrap it in <Sequence when={span(0, n)}>, or pass an element that has one.",
      { ...(writtenAt(element) && { source: writtenAt(element)! }) },
    );

  return length;
};

const calls = new WeakMap<Call, SceneElement>();

/** What JSX wrote, run top-down with the contexts and ids it was written under: no call, provide or series is left in it. */
export const expand = (element: SceneElement): SceneElement => {
  switch (element.type) {
    case "call": {
      const done = calls.get(element);

      if (done) return done;
      const out = sourced(element, run(element));

      calls.set(element, out);

      return out;
    }

    case "provide":
      return withProvided([...provided, { context: element.context, value: element.value }], () =>
        sourced(element, { type: "fragment", children: element.children.map(expand) }),
      );
    case "series": {
      let end = 0;

      const children = element.children.map((child, index): SceneElement => {
        const body = expand(child);
        const over = rootLength(body);

        if (over === undefined)
          throw new SceneError(
            "A <Series> child has no length: it holds no <Sequence> at its root, so there is no telling when the next starts.",
            "Wrap it in <Sequence when={span(0, n)}>.",
            { node: "<Series>", ...(writtenAt(child) && { source: writtenAt(child)! }) },
          );
        const start = index === 0 ? 0 : end + element.gap;

        if (start < 0)
          throw new SceneError(
            `<Series> gap={${element.gap}} starts its child ${index + 1} at ${start}s, before the series starts.`,
            "Make the gap smaller than the child before it is long.",
            { node: "<Series>", ...(writtenAt(child) && { source: writtenAt(child)! }) },
          );
        end = start + over;

        return { type: "sequence", start, over, children: [body] };
      });

      return sourced(element, {
        type: "fragment",
        children,
        ...(element.share && { seams: element.share }),
      });
    }

    case "fragment":
    case "sequence":
      return sourced(element, { ...element, children: element.children.map(expand) });
    case "group":
      return sourced(element, {
        ...element,
        props: masked(element.props),
        children: element.children.map(expand),
      });
    case "shape":
      return sourced(element, { ...element, props: masked(element.props) });
    case "picture":
      return sourced(element, { ...element, props: masked(element.props) });
    case "text":
      return sourced(element, {
        ...element,
        props: {
          ...masked(element.props),
          ...(element.props.children !== undefined && { children: inText(element.props.children) }),
        },
      });
    case "run":
      return sourced(element, {
        ...element,
        props: {
          ...element.props,
          ...(element.props.children !== undefined && { children: inText(element.props.children) }),
        },
      });
    case "morph":
      return sourced(element, {
        ...element,
        states: element.states.map((state) => state.map(expand)),
      });
    default:
      return element;
  }
};
