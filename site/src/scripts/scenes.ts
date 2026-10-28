// Scenes: every one is an <img>. Off screen it is a still; it plays only while it is on screen, and goes back to its still when it leaves.
// A scene near the viewport gets its still first, so scrolling never meets an empty box.
import { frozen, PALETTECHANGE, playing, replay, show } from "./palette";
import { calm, scheme, THEMECHANGE, type Scheme } from "./scheme";

// A scene plays once this much of it is on screen, so a screen full of half-cut cards does not animate them all.
const SHOWN = 0.3;
// Main-thread milliseconds per second the scenes on screen may cost together while they play, measured in headless
// Chromium at 1440 wide. Each scene carries its own cost in data-cost.
const BUDGET = 80;
const COST = 30;

const posterOf = (img: HTMLImageElement) => img.dataset[(img.dataset.scheme as Scheme | undefined) ?? scheme()]!;

// Under another palette a still is the recolored scene held at its still frame, which follows light and dark by itself.
export const still = (img: HTMLImageElement, { fade = false } = {}) => {
  img.dataset.want = "still";
  img.dataset.state = "still";
  show(img, frozen(img, img.dataset.live!, posterOf(img)), { fade });
};

export const play = (img: HTMLImageElement) => {
  if (calm.matches) return img.dataset.state === "still" ? undefined : still(img);
  if (img.dataset.want === "live") return;
  img.dataset.want = "live";
  show(img, playing(img, img.dataset.live!)).then((shown) => shown && (img.dataset.state = "live"));
};

const scenes = document.querySelectorAll<HTMLImageElement>(".scene[data-live]");
const near = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      const img = entry.target as HTMLImageElement;
      if (entry.isIntersecting && !img.dataset.want) still(img);
    }),
  { rootMargin: "500px 0px" },
);
// The scenes most on screen, nearest the middle of it, play first. The rest wait as stills.
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
      .filter(([, r]) => r >= SHOWN)
      .map(([img]) => img)
      .sort((a, b) => ratio.get(b)! - ratio.get(a)! || reach(a) - reach(b))
      .filter((img) => {
        const cost = Number(img.dataset.cost ?? COST);
        if (spent + cost > BUDGET) return false;
        spent += cost;
        return true;
      }),
  );
  scenes.forEach((img) => {
    if ("manual" in img.dataset) return;
    if (wanted.has(img)) play(img);
    else if (img.dataset.state === "live") still(img);
  });
};
const view = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => ratio.set(entry.target as HTMLImageElement, entry.isIntersecting ? entry.intersectionRatio : 0));
    balance();
  },
  { threshold: [0, 0.15, SHOWN, 0.5, 0.75, 1] },
);
scenes.forEach((img) => {
  near.observe(img);
  if (!("manual" in img.dataset)) view.observe(img);
});
calm.addEventListener("change", () => scenes.forEach((img) => (img.dataset.state === "live" && calm.matches ? still(img) : undefined)));
addEventListener(THEMECHANGE, () => scenes.forEach((img) => img.dataset.state === "still" && !img.src.startsWith("blob:") && still(img)));
addEventListener(PALETTECHANGE, () =>
  scenes.forEach((img) => {
    if (img.dataset.state === "live") replay(img);
    else if (img.dataset.want === "live") (delete img.dataset.want, play(img));
    else if (img.dataset.want) still(img, { fade: true });
  }),
);
