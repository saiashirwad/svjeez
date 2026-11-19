// A scene that plays from the `src` in its HTML: an example's own page. When the page's scheme is not the OS's, it shows
// a copy pinned to that scheme, since Safari shows an <img> SVG in the OS's scheme whatever the page says.
import { adopt, isPlaying, pinned, playing, replay, show } from "./frame";
import { calm, THEMECHANGE } from "./scheme";

export const follow = (img: HTMLImageElement) => {
  const live = img.getAttribute("src")!;

  const sync = async (fade: boolean) => {
    if (calm.matches) await show(img, pinned(img) ? playing(img, live) : { url: live });
    else await (isPlaying(img) ? replay(img) : show(img, playing(img, live), { fade }));
    img.dataset.shown = "";
  };

  if (calm.matches || pinned(img)) sync(false);
  else adopt(img);
  addEventListener(THEMECHANGE, () => sync(true));
  calm.addEventListener("change", () => sync(false));
};
