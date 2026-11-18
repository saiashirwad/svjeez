import type { SvgNode } from "./svg";

export interface JsxSource {
  readonly fileName?: string;
  readonly lineNumber: number;
  readonly columnNumber?: number;
}

const written = new WeakMap<SvgNode, JsxSource>();

export const remember = (node: SvgNode, source: JsxSource | undefined): SvgNode => {
  if (source && node.kind === "element" && !written.has(node)) written.set(node, source);

  return node;
};

/** A source as `data-source` writes it: file, line and column, leaving out the parts that are unknown. */
export const place = ({ fileName, lineNumber, columnNumber }: JsxSource): string =>
  [fileName || undefined, lineNumber, columnNumber].filter((part) => part !== undefined).join(":");

export const sourceOf = (node: SvgNode): string | undefined => {
  const source = written.get(node);

  return source && place(source);
};

export const withSources = (node: SvgNode): SvgNode => {
  switch (node.kind) {
    case "element": {
      const source = sourceOf(node);

      return {
        ...node,
        attrs: source ? { ...node.attrs, "data-source": source } : node.attrs,
        children: node.children.map(withSources),
      };
    }

    case "fragment":
    case "clip":
      return { ...node, children: node.children.map(withSources) };
    default:
      return node;
  }
};
