import type { Scene, SceneNode } from "./ir";

export const walkScene = (scene: Scene, visit: (node: SceneNode) => void): void => {
  const walk = (node: SceneNode): void => {
    visit(node);

    if (node.kind === "group") node.children.forEach(walk);

    if (node.mask) walk(node.mask);
  };

  walk(scene.root);
  Object.values(scene.symbols).forEach(walk);
};
