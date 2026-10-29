// A scene compiled for the page. A scene shows its poster whenever the play budget holds it back, so posters render at
// 2x to stay sharp on retina screens.
import { getScene } from "@svjeez/astro/scene";

export const live = (scene: () => string) =>
  getScene(scene, { posters: { scale: 2, quality: 0.9, background: "transparent" } });
