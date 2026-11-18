import { place, type JsxSource } from "./sources";
import type { SvgNode } from "../svg/tree";
import type { SceneNode, Source } from "../model/ir";
import type { SceneElement } from "./nodes";

const written = new WeakMap<SceneElement, Source>();

export const remember = (element: SceneElement, source: JsxSource | undefined): SceneElement => {
  if (source && !written.has(element))
    written.set(element, {
      file: source.fileName ?? "",
      line: source.lineNumber,
      ...(source.columnNumber !== undefined && { column: source.columnNumber }),
    });

  return element;
};

export const sourced = (from: SceneElement, to: SceneElement): SceneElement => {
  const source = written.get(from);

  if (source) written.set(to, source);

  return to;
};

const keyedByPlace = new WeakSet<SceneNode>();

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
