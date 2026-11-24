import { readFileSync } from "node:fs";
import { font, scene, type SceneElement } from "svjeez";
import type { Model } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts.ts";

export const mono = font(readFileSync(fontFixture("JetBrainsMono")));

export const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [400, 240], duration, title: "Test" }, build);

export const all = (node: Model.SceneNode): Model.SceneNode[] => [
  node,
  ...(node.kind === "group" ? node.children.flatMap(all) : []),
];

export const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const found = all(model.root).find((node) => node.key === key || node.key.endsWith(`/${key}`));

  if (!found)
    throw new Error(
      `no node "${key}" in ${all(model.root)
        .map((n) => n.key)
        .join(", ")}`,
    );

  return found;
};
