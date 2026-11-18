import { place, type JsxSource } from "./sources";
import type { SvgNode } from "../svg/tree";
import type { SceneNode, Source } from "../model/ir";
import type { SceneElement } from "./nodes";

const written = new WeakMap<SceneElement, Source>();
const components = new WeakMap<SceneElement, string>();

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

  if (source) written.set(to, source);

  if (component) components.set(to, component);

  return to;
};

export const writtenAt = (element: SceneElement): Source | undefined => written.get(element);

export const componentOf = (element: SceneElement): string | undefined => components.get(element);

const keyedByPlace = new WeakSet<SceneNode>();

export const identified = <N extends SceneNode>(
  element: SceneElement,
  name: string | undefined,
  node: N,
  named?: { readonly name: string; readonly source?: Source },
): N => {
  const source = written.get(element) ?? named?.source;
  const readable = named?.name;

  const out = {
    ...node,
    ...(readable !== undefined && { name: readable }),
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

export const sourceText = ({ file, line, column }: Source): string =>
  place({
    fileName: file,
    lineNumber: line,
    ...(column !== undefined && { columnNumber: column }),
  });

export const labelled = (node: SceneNode, out: SvgNode): SvgNode =>
  out.kind === "element"
    ? {
        ...out,
        attrs: {
          ...out.attrs,
          "data-key": node.key,
          ...(node.source && { "data-source": sourceText(node.source) }),
        },
      }
    : out;
