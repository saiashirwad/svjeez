// A scene that plays from the `src` in its HTML: an example's own page. When the page's scheme is not the OS's, it shows
// a copy pinned to that scheme, since Safari shows an <img> SVG in the OS's scheme whatever the page says, and under
// another palette a recolored copy, held at its still frame under reduced motion.
import { player } from "svjeez/page";
import { look } from "./look";
import { PALETTECHANGE } from "./palette";
import { calm, THEMECHANGE } from "./scheme";

export const follow = (img: HTMLImageElement) => {
  const scene = player(img, { adopt: true, look });
  const sync = (fade: boolean) => scene.refresh({ fade }).then(() => (img.dataset.shown = ""));

  scene.ready.then(() => (img.dataset.shown = ""));
  addEventListener(PALETTECHANGE, () => sync(true));
  addEventListener(THEMECHANGE, () => sync(true));
  calm.addEventListener("change", () => sync(false));
};
