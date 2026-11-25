import { player, type Player } from "svjeez/page";
import { look } from "./look";
import { PALETTECHANGE } from "./palette";
import { calm, scheme, THEMECHANGE } from "./scheme";

const SHOWN = 0.3;

const BUDGET = 80;
const COST = 30;

const posterOf = (img: HTMLImageElement) => img.dataset[img.dataset.scheme ?? scheme()];

const players = new Map<HTMLImageElement, Player>();

const playerOf = (img: HTMLImageElement) => {
  let known = players.get(img);

  if (!known) {
    known = player(img, { look, poster: (kind, one) => one.dataset[kind], near: 500 });
    players.set(img, known);
  }

  return known;
};

export const still = (img: HTMLImageElement, { fade = false } = {}) =>
  playerOf(img).still({ fade });

export const play = (img: HTMLImageElement) => playerOf(img).play();

const scenes = document.querySelectorAll<HTMLImageElement>(".scene[data-live]");

scenes.forEach(playerOf);

const ratio = new Map<HTMLImageElement, number>();

const balance = () => {
  const middle = innerHeight / 2;

  const reach = (img: HTMLImageElement) => {
    const box = img.getBoundingClientRect();

    return Math.abs(box.top + box.height / 2 - middle);
  };

  let spent = 0;

  const wanted = new Set(
    [...ratio]
      .flatMap(([img, r]) => (r >= SHOWN ? [img] : []))
      .sort((a, b) => ratio.get(b)! - ratio.get(a)! || reach(a) - reach(b))
      .filter((img) => {
        const cost = Number(img.dataset.cost ?? COST);

        if (spent > 0 && spent + cost > BUDGET) return false;
        spent += cost;

        return true;
      }),
  );

  scenes.forEach((img) => {
    if ("manual" in img.dataset) return;

    if (wanted.has(img)) play(img);
    else playerOf(img).stop({ fade: false });
  });
};

const view = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.target instanceof HTMLImageElement)
        ratio.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
    });
    balance();
  },
  { threshold: [0, 0.15, SHOWN, 0.5, 0.75, 1] },
);

scenes.forEach((img) => {
  if (!("manual" in img.dataset)) view.observe(img);
});

const warm = () => {
  // SAFETY: the Network Information API is missing from lib.dom, and Chromium is the only engine that has it, so every
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;

  new Set(
    [...scenes].flatMap((img) =>
      [img.dataset.live!, posterOf(img)].filter((url) => url !== undefined),
    ),
  ).forEach((url) =>
    fetch(url, { priority: "low" })
      .then((response) => response.arrayBuffer())
      .catch(() => {}),
  );
};

if (document.readyState === "complete") warm();
else addEventListener("load", warm, { once: true });

calm.addEventListener("change", () =>
  players.forEach((one) => (one.state === "live" && calm.matches ? one.still() : undefined)),
);

addEventListener(THEMECHANGE, () => players.forEach((one) => one.refresh()));

addEventListener(PALETTECHANGE, () => players.forEach((one) => one.refresh({ fade: true })));
