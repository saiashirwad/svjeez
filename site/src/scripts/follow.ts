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
