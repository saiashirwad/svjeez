import type { SvgNode } from "./svg";

/** Where an element was written, as a development JSX transform reports it. Sucrase gives no column. */
export interface JsxSource {
  readonly fileName?: string;
  readonly lineNumber: number;
  readonly columnNumber?: number;
}

const written = new WeakMap<SvgNode, JsxSource>();

/**
 * Records where an element was written. A component's root keeps the place inside the component when the development
 * runtime made it there, and otherwise takes the place the component was used.
 */
export const remember = (node: SvgNode, source: JsxSource | undefined): SvgNode => {
  if (source && node.kind === "element" && !written.has(node)) written.set(node, source);

  return node;
};

const place = ({ fileName, lineNumber, columnNumber }: JsxSource): string =>
  [fileName || undefined, lineNumber, columnNumber].filter((part) => part !== undefined).join(":");

/** The tree with `data-source` on every element the development runtime recorded. */
export const withSources = (node: SvgNode): SvgNode => {
  switch (node.kind) {
    case "element": {
      const source = written.get(node);

      return {
        ...node,
        attrs: source ? { ...node.attrs, "data-source": place(source) } : node.attrs,
        children: node.children.map(withSources),
      };
    }

    case "fragment":
      return { ...node, children: node.children.map(withSources) };
    default:
      return node;
  }
};
