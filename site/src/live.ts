import { getScene, type SceneSource } from "@svjeez/astro/scene";

export const live = (scene: SceneSource) =>
  getScene(scene, { posters: { scale: 2, quality: 0.9, background: "transparent" } });
