// A scene that plays from the `src` in its HTML: an example's own page and the intro. Under another palette it shows a
// recolored copy instead, held at its still frame under reduced motion in place of the posters its <picture> offers.
import { DEFAULT_PALETTE } from "../palettes";
import { adopt, frozen, isPlaying, palette, PALETTECHANGE, playing, replay, show } from "./palette";
import { calm } from "./scheme";

export const follow = (img: HTMLImageElement) => {
  const live = img.getAttribute("src")!;
  const posters = [...img.parentElement!.querySelectorAll("source")];
  const recolored = () => "themed" in img.dataset && palette() !== DEFAULT_PALETTE;

  const sync = async (fade: boolean) => {
    if (calm.matches && recolored()) {
      if (await show(img, frozen(img, live, live))) posters.forEach((source) => source.remove());
    } else if (calm.matches) {
      if (!posters[0]?.isConnected) img.before(...posters);
      await show(img, { url: live });
    } else await (isPlaying(img) ? replay(img) : show(img, playing(img, live), { fade }));
    img.dataset.shown = "";
  };

  if (calm.matches || recolored()) sync(false);
  else adopt(img);
  addEventListener(PALETTECHANGE, () => sync(true));
  calm.addEventListener("change", () => sync(false));
};
