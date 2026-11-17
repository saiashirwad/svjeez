/** Make an element with a class, some text, and children. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);

  node.className = className;
  node.append(...children);

  return node;
};

const SVG = "http://www.w3.org/2000/svg";

/** An `<svg>` that frames one sprite: `box` is the viewBox, about the sprite's anchor. */
export const frameOf = (sprite: SVGGElement, box: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG, "svg");

  svg.setAttribute("viewBox", box);
  svg.append(sprite);

  return svg;
};
