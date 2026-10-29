// The hero's knobs: a press finds the variant's file and swaps it into the hero, which starts it from the top. The
// proof chip under each cut follows, so its size, links and <img> tag always describe the file on screen.
import type { HeroVariant } from "../hero";
import { kb, proof } from "../proof";
import { play, still } from "./scenes";
import { calm } from "./scheme";

const form = document.querySelector<HTMLFormElement>(".knobs")!;
const die = form.querySelector<HTMLButtonElement>(".die")!;
const variants: HeroVariant[] = JSON.parse(document.getElementById("hero-variants")!.textContent!);
const cuts = ["wide", "tall"] as const;

const imgs = new Map(
  cuts.map((cut) => [cut, document.querySelector<HTMLImageElement>(`[data-hero=${cut}]`)!]),
);

// Only the default variant has posters; the others hold their own still frame (see `frozen` in palette.ts).
const posters = new Map(cuts.map((cut) => [cut, { ...imgs.get(cut)!.dataset }]));
const [first] = variants;

const find = (data: FormData) =>
  variants.find((v) => Object.entries(v.knobs).every(([knob, value]) => data.get(knob) === value));

const chosen = () => find(new FormData(form))!;

const relabel = (img: HTMLImageElement, file: HeroVariant["wide"], name: string) => {
  const chip = img.nextElementSibling!;
  const facts = proof(file, name, file.alt);

  const set = (slot: string, apply: (el: HTMLElement) => void) =>
    chip.querySelectorAll<HTMLElement>(`[data-proof-${slot}]`).forEach(apply);

  set("size", (el) => (el.textContent = facts.size));
  set("file", (el) => (el.textContent = facts.download));
  set("facts", (el) => (el.textContent = facts.facts));
  set("tag", (el) => (el.textContent = facts.tag));
  set("copy", (el) => (el.dataset.copy = facts.tag));
  set("open", (el) => el.setAttribute("href", file.src));
  set("download", (el) => {
    el.setAttribute("href", file.src);
    el.setAttribute("download", facts.download);
  });
  chip
    .querySelector(".proof-chip")!
    .setAttribute("aria-label", `${kb(file.gzip)} SVG file. Open, copy or download it.`);
};

const swap = (variant: HeroVariant) => {
  for (const cut of cuts) {
    const img = imgs.get(cut)!;
    const file = variant[cut];
    const { light, dark } = posters.get(cut)!;

    img.dataset.live = file.src;
    img.alt = file.alt;

    if (variant === first) Object.assign(img.dataset, { light, dark });
    else {
      delete img.dataset.light;
      delete img.dataset.dark;
    }

    relabel(img, file, variant === first ? "hero" : `hero-${variant.key}`);

    // A playing cut starts the new file from the top; one the budget holds back, or a reader who asked for less
    // motion, gets the new file's still.
    if (img.dataset.want === "live" && !calm.matches) {
      delete img.dataset.want;
      play(img);
    } else if (img.dataset.want) still(img);
  }
};

form.addEventListener("change", () => swap(chosen()));

// A key that is about to be pressed fetches its file, so the swap has it in the cache.
const visible = () => cuts.find((cut) => imgs.get(cut)!.offsetParent) ?? "wide";

const warm = (event: Event) => {
  const input =
    event.target instanceof Element ? event.target.closest(".key")?.querySelector("input") : null;

  if (!input || input.checked) return;
  const data = new FormData(form);
  data.set(input.name, input.value);
  const next = find(data);

  if (next) fetch(next[visible()].src, { priority: "low" }).catch(() => {});
};

form.addEventListener("pointerover", warm);

form.addEventListener("focusin", warm);

die.addEventListener("click", () => {
  const now = chosen();
  const others = variants.filter((v) => v !== now);
  const next = others[Math.floor(Math.random() * others.length)]!;

  for (const [knob, value] of Object.entries(next.knobs))
    form.querySelector<HTMLInputElement>(`input[name="${knob}"][value="${value}"]`)!.checked = true;

  if (!calm.matches)
    die
      .querySelector("svg")!
      .animate(
        { rotate: ["0turn", "1turn"], scale: [1, 1.2, 1] },
        { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
  swap(next);
});
