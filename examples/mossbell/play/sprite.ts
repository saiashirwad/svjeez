import type { Point } from "svjeez";
import type { Sheet } from "./sheet";

const SVG = "http://www.w3.org/2000/svg";

/** Turn a rendered scene into an element the page can hold, without the title that browsers show as a tooltip. */
export const parseScene = (svg: string): SVGSVGElement => {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  const node = document.importNode(parsed, true);

  if (!(node instanceof SVGSVGElement))
    throw new Error("parseScene() needs the string render() returns.");

  for (const label of node.querySelectorAll(":scope > title, :scope > desc")) label.remove();

  for (const name of ["role", "aria-labelledby", "aria-label"]) node.removeAttribute(name);

  return node;
};

/** A sheet on the stage: a group that moves, holding the sheet's picture with one state showing. */
export interface Sprite {
  readonly node: SVGGElement;
  readonly at: Point;
  /** Show one state and hide the rest. Showing the state that is already up changes nothing, so its motion keeps its place. */
  show(state: string): void;
  /** Mirror the picture about its anchor. */
  mirror(flipped: boolean): void;
  moveTo(at: Point): void;
}

export const createSprite = (sheet: Sheet): Sprite => {
  const node = document.createElementNS(SVG, "g");
  const picture = parseScene(sheet.svg);
  const states = [...picture.querySelectorAll<SVGGElement>(":scope > [data-state]")];
  let showing = "";
  let flipped = false;
  let at: Point = { x: 0, y: 0 };

  picture.setAttribute("x", String(-sheet.anchor.x));
  picture.setAttribute("y", String(-sheet.anchor.y));
  picture.setAttribute("overflow", "visible");
  node.append(picture);

  const place = (): void => {
    node.setAttribute(
      "transform",
      `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})${flipped ? " scale(-1 1)" : ""}`,
    );
  };

  const show = (state: string): void => {
    if (state === showing) return;
    showing = state;

    for (const group of states)
      group.style.display = group.dataset["state"] === state ? "" : "none";
  };

  show(states[0]?.dataset["state"] ?? "");

  return {
    node,
    get at() {
      return at;
    },
    show,
    mirror(next) {
      if (next === flipped) return;
      flipped = next;
      place();
    },
    moveTo(next) {
      at = next;
      place();
    },
  };
};
