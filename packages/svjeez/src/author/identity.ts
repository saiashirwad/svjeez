import { place, type JsxSource } from "./sources";
import type { SvgNode } from "../svg/tree";
import type { SceneNode, Source } from "../model/ir";
import type { SceneElement } from "./nodes";

/**
 * Identity bookkeeping between authoring and the model: where each element was written, and which nodes took a key
 * from their place in the tree. Neither changes what an element means, so both live beside the elements.
 */

const written = new WeakMap<SceneElement, Source>();

/** Records where `element` was written. The first record wins, so a component's own node keeps its own line. */
export const remember = (element: SceneElement, source: JsxSource | undefined): SceneElement => {
  if (source && !written.has(element))
    written.set(element, {
      file: source.fileName ?? "",
      line: source.lineNumber,
      ...(source.columnNumber !== undefined && { column: source.columnNumber }),
    });

  return element;
};

const keyedByPlace = new WeakSet<SceneNode>();

/** The node lowered from `element`, carrying its source, and marked when `name` was not given, so its key is its place. */
export const identified = <N extends SceneNode>(
  element: SceneElement,
  name: string | undefined,
  node: N,
): N => {
  const source = written.get(element);
  const out = source ? { ...node, source } : node;

  if (name === undefined) keyedByPlace.add(out);

  return out;
};

/** Whether a node's key comes from its place among its siblings rather than a `key` or `ref`. */
export const isPlaced = (node: SceneNode): boolean => keyedByPlace.has(node);

/** Marks a node made from `from` as keyed the way `from` was. */
export const placedLike = <N extends SceneNode>(node: N, from: SceneNode): N => {
  if (keyedByPlace.has(from)) keyedByPlace.add(node);

  return node;
};

/** A source as `data-source` writes it, the old API's convention: `file:line:column`, leaving out what is unknown. */
export const sourceText = ({ file, line, column }: Source): string =>
  place({
    fileName: file,
    lineNumber: line,
    ...(column !== undefined && { columnNumber: column }),
  });

/** `out`, the element a backend drew `node` as, with the node's key and source on it. */
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
