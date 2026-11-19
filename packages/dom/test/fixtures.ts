import type { ElementNode, Snapshot } from "../src/index.ts";

export const box = (props: Partial<ElementNode> = {}): ElementNode => ({
  type: "element",
  tag: "div",
  rect: { x: 0, y: 0, width: 100, height: 60 },
  children: [],
  ...props,
});

export const snapshot = (root: ElementNode, rest: Partial<Snapshot> = {}): Snapshot => ({
  version: 1,
  viewport: { width: 400, height: 300 },
  root,
  ...rest,
});

/** A 1x1 PNG. */
export const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
