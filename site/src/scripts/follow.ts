// A scene that plays from the `src` in its HTML: an example's own page. When the page's scheme is not the OS's, it shows
// a copy pinned to that scheme, since Safari shows an <img> SVG in the OS's scheme whatever the page says, and under
// another palette a recolored copy, held at its still frame under reduced motion.
import { DEFAULT_PALETTE } from "../palettes";
import { adopt, frozen, isPlaying, pinned, playing, replay, show } from "./frame";
import { palette, PALETTECHANGE } from "./palette";
import { calm, THEMECHANGE } from "./scheme";

export const follow = (img: HTMLImageElement) => {
  const live = img.getAttribute("src")!;
  const recolored = () => "themed" in img.dataset && palette() !== DEFAULT_PALETTE;

  const sync = async (fade: boolean) => {
    if (calm.matches && recolored()) await show(img, frozen(img, live, undefined));
    else if (calm.matches) await show(img, pinned(img) ? playing(img, live) : { url: live });
    else await (isPlaying(img) ? replay(img) : show(img, playing(img, live), { fade }));
    img.dataset.shown = "";
  };

  if (calm.matches || recolored() || pinned(img)) sync(false);
  else adopt(img);
  addEventListener(PALETTECHANGE, () => sync(true));
  addEventListener(THEMECHANGE, () => sync(true));
  calm.addEventListener("change", () => sync(false));
};
