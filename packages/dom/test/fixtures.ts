import { valueAt, type Model } from "svjeez/tools";
import type { ElementNode, Snapshot, TextNode } from "../src/index.ts";

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

/** A one-line text node. */
export const words = (text: string, x = 0, y = 12): TextNode => ({
  type: "text",
  runs: [
    {
      x,
      y,
      text,
      advances: [...text].map(() => 8),
      font: { family: "monospace", weight: 400, italic: false, stretch: 100, size: 14 },
      letterSpacing: 0,
      color: "rgb(0, 0, 0)",
    },
  ],
});

/** The solid background of the element at `path` (`app/b`), as `#rrggbb`, at scene time `t`, holding each lane's value until its next. */
export const backgroundAt = (model: Model.Scene, path: string, t: number): string => {
  const [head, ...rest] = path.split("/");

  const lane = model.root.children
    .flatMap(function walk(node: Model.SceneNode): Model.SceneNode[] {
      return [node, ...("children" in node ? node.children.flatMap(walk) : [])];
    })
    .find((node) => node.key === `${head}/@track/${rest.join("/@track/")}/@track/background`);

  if (lane?.kind !== "shape") throw new Error(`no background for ${path}`);

  const fill = valueAt(lane.fill, t, (a) => a);

  if (!Array.isArray(fill)) throw new Error(`the background of ${path} is not a plain color`);

  return `#${fill
    .slice(0, 3)
    .map((c: number) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
