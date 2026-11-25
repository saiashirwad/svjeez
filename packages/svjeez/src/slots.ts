/**
 * The slots of an inline SVG svjeez made: a `<Slot>` is written as a `<g data-slot="name" data-slot-box="x y w h">`
 * around its fallback, and page code puts its own HTML in that box.
 */

/** A <Slot> of the scene: the box page code can fill with its own HTML. */
export interface SlotControl {
  /** The group that holds the fallback, and the hosted node while there is one. */
  readonly element: SVGGElement;
  /** The slot's box, in the group's own units. */
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /**
   * Put `node` in the box, in a `<foreignObject>` inside the group, so the scene's transforms and clocks move it, and
   * hide the fallback. The node fills the box when its CSS says `width: 100%; height: 100%`. Hosting again replaces
   * the node. Returns the function that takes it out and shows the fallback again.
   */
  host(node: HTMLElement): () => void;
}

// The node each slot's group hosts now, by group, and the function that takes it out.
const hosting = new WeakMap<Element, () => void>();

const SVG = "http://www.w3.org/2000/svg";

export const slotOf = (root: Element, name: string): SlotControl => {
  const selector = `g[data-slot="${CSS.escape(name)}"]`;
  const element = root.matches(selector) ? root : root.querySelector(selector);

  if (!(element instanceof SVGGElement)) {
    const names = [...root.querySelectorAll("[data-slot]")].map(
      (one) => `"${one.getAttribute("data-slot")}"`,
    );

    throw new Error(
      `This SVG has no slot "${name}"; it has ${names.length ? names.join(", ") : "none"}`,
    );
  }

  const [x = 0, y = 0, width = 0, height = 0] = (element.getAttribute("data-slot-box") ?? "")
    .split(" ")
    .map(Number);

  const box = { x, y, width, height };

  // The fallback is made see-through rather than taken out of the page: a clock keeps hold of its animations.
  const host = (node: HTMLElement) => {
    hosting.get(element)?.();
    const fallback = [...element.children].filter((child) => child instanceof SVGElement);
    const styles = fallback.map((child) => child.getAttribute("style"));
    const frame = document.createElementNS(SVG, "foreignObject");

    for (const [attribute, value] of Object.entries(box))
      frame.setAttribute(attribute, String(value));

    for (const child of fallback) {
      child.style.setProperty("opacity", "0", "important");
      child.style.setProperty("pointer-events", "none", "important");
    }

    frame.append(node);
    element.append(frame);

    const release = () => {
      if (hosting.get(element) !== release) return;
      hosting.delete(element);
      frame.remove();

      fallback.forEach((child, at) => {
        const style = styles[at];

        if (style === null || style === undefined) child.removeAttribute("style");
        else child.setAttribute("style", style);
      });
    };

    hosting.set(element, release);

    return release;
  };

  return { element, box, host };
};
