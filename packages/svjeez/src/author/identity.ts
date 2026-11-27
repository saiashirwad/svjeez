import type { JsxSource } from "./sources";
import type { SceneNode, Source } from "../model/ir";
import type { SceneElement } from "./nodes";
import { SceneError } from "../model/scene-error";
import { isNumber, isString } from "../model/guards";

const written = new WeakMap<SceneElement, Source>();
const components = new WeakMap<SceneElement, string>();
const lists = new WeakMap<SceneElement, string>();

export const sourceFrom = (source: JsxSource): Source => ({
  file: source.fileName ?? "",
  line: source.lineNumber,
  ...(source.columnNumber !== undefined && { column: source.columnNumber }),
});

export const remember = (
  element: SceneElement,
  source: JsxSource | undefined,
  component?: string,
): SceneElement => {
  if (source && !written.has(element)) written.set(element, sourceFrom(source));

  if (component && !components.has(element)) components.set(element, component);

  return element;
};

export const sourced = (from: SceneElement, to: SceneElement): SceneElement => {
  const source = written.get(from);

  const component = components.get(from);
  const list = lists.get(from);

  if (source && !written.has(to)) written.set(to, source);

  if (component && !components.has(to)) components.set(to, component);

  if (list !== undefined && !lists.has(to)) lists.set(to, list);

  return to;
};

/**
 * The element as it sits in a list among its siblings, as in `{a.map(…)}{b.map(…)}`: `list` is the list's place among
 * them. Its key stays as written; the place only tells two lists' equal keys apart.
 */
export const inList = (element: SceneElement, list: string): SceneElement => {
  const out = sourced(element, { ...element });

  lists.set(out, list);

  return out;
};

/** The place of the list the element was written in among its siblings, or undefined when it is in none of several. */
export const listOf = (element: SceneElement): string | undefined => lists.get(element);

export const writtenAt = (element: SceneElement): Source | undefined => written.get(element);

export const componentOf = (element: SceneElement): string | undefined => components.get(element);

const keyedByPlace = new WeakSet<SceneNode>();

export const identified = <N extends SceneNode>(
  element: SceneElement,
  name: string | undefined,
  node: N,
  named?: { readonly name: string; readonly source?: Source },
  id?: string,
): N => {
  const source = written.get(element) ?? named?.source;
  const readable = named?.name;

  const out = {
    ...node,
    ...(readable !== undefined && { name: readable }),
    ...(id !== undefined && { id }),
    ...(source && { source }),
  };

  if (name === undefined) keyedByPlace.add(out);

  return out;
};

export const isPlaced = (node: SceneNode): boolean => keyedByPlace.has(node);

export const placedLike = <N extends SceneNode>(node: N, from: SceneNode): N => {
  if (keyedByPlace.has(from)) keyedByPlace.add(node);

  return node;
};

/** A key as text: a number reads as its digits, as in React; anything but a string or a finite number is refused. */
export const keyText = (key: string | number, source: Source | undefined): string => {
  if (isString(key)) return key;

  if (isNumber(key) && Number.isFinite(key)) return String(key);

  throw new SceneError(
    `A key is a string or a number, got ${String(key)}.`,
    'Write key="name" or key={index}.',
    { ...(source && { source }) },
  );
};
