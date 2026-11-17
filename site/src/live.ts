import { getScene } from "@svjeez/astro/scene";

export const live = (scene: () => string) =>
  getScene(scene, { posters: { scale: 2, quality: 0.9, background: "transparent" } });
