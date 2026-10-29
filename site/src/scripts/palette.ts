// The palette on the page, and the scenes that follow it. A scene that paints with the base16 variables (marked
// data-themed) gets a recolored copy as a Blob URL, started where the copy it replaces had got to, so a switch never
// restarts it. Every live `src` goes through `show`, which remembers how far in each img's scene is.
import { restyle } from "svjeez";
import { adaptive } from "svjeez/extras";
import { DEFAULT_PALETTE, PALETTES, themed, type PaletteId } from "../palettes";
import { calm } from "./scheme";

export type { PaletteId };

/** Fired on window when the picker changes the palette. */
export const PALETTECHANGE = "palettechange";

const FADE = 200;
const CSS = new Map<PaletteId, string>(PALETTES.map((p) => [p.id, adaptive(p).css]));

/** The palette the page shows. */
export const palette = (): PaletteId =>
  PALETTES.find(({ id }) => id === document.documentElement.dataset.palette)?.id ?? DEFAULT_PALETTE;

export const choose = (id: PaletteId) => {
  const root = document.documentElement;

  if (id === DEFAULT_PALETTE) delete root.dataset.palette;
  else root.dataset.palette = id;

  try {
    if (id === DEFAULT_PALETTE) localStorage.removeItem("palette");
    else localStorage.setItem("palette", id);
  } catch {}

  dispatchEvent(new Event(PALETTECHANGE));
};

const sources = new Map<string, Promise<string | undefined>>();

const source = (live: string) => {
  let svg = sources.get(live);

  if (!svg) {
    svg = fetch(live)
      .then((response) => (response.ok ? response.text() : undefined))
      .then((text) => (text && themed(text) ? text : undefined))
      .catch(() => void sources.delete(live));
    sources.set(live, svg);
  }

  return svg;
};

/**
 * A URL that shows the scene at `live` in the current palette, `at` seconds in or held at its still frame. Undefined
 * when the scene's own file already does: the default palette from the start or as a still unless `always`, or a scene
 * that does not paint with the base16 variables.
 */
export const paint = async (
  live: string,
  {
    at = 0,
    still = false,
    always = false,
  }: { at?: number; still?: boolean; always?: boolean } = {},
) => {
  const id = palette();

  if (id === DEFAULT_PALETTE && (still || !at) && !always) return undefined;
  const svg = await source(live);

  if (!svg) return undefined;
  const css = id === DEFAULT_PALETTE ? undefined : CSS.get(id);

  return URL.createObjectURL(
    new Blob([restyle(svg, { css, at, still })], { type: "image/svg+xml" }),
  );
};

/** What an img shows: a URL, and when it is the scene playing, which scene and how many seconds in it starts. */
export interface Frame {
  readonly url: string;
  readonly live?: string;
  readonly at?: number;
}

const recolors = (img: HTMLImageElement) => "themed" in img.dataset;

/** The scene at `live` playing from `at` seconds in, in the current palette. */
export const playing = async (img: HTMLImageElement, live: string, at = 0): Promise<Frame> => {
  const url = recolors(img) ? await paint(live, { at }) : undefined;

  return url ? { url, live, at } : { url: live, live, at: 0 };
};

/**
 * The scene at `live` held at its still frame in the current palette, or `poster` when that already shows it. A scene
 * with no poster, like a hero variant, is held by restyling its own file.
 */
export const frozen = async (
  img: HTMLImageElement,
  live: string,
  poster: string | undefined,
): Promise<Frame> => ({
  url:
    (recolors(img) ? await paint(live, { still: true, always: !poster }) : undefined) ??
    poster ??
    live,
});

const turns = new WeakMap<HTMLImageElement, number>();
const clocks = new WeakMap<HTMLImageElement, { live: string; at: number; started: number }>();
const revoke = (url: string | null) => url?.startsWith("blob:") && URL.revokeObjectURL(url);

/** How far in, in seconds, the scene an img plays is. */
export const elapsed = (img: HTMLImageElement) => {
  const clock = clocks.get(img);

  return clock ? clock.at + (performance.now() - clock.started) / 1000 : 0;
};

export const isPlaying = (img: HTMLImageElement) => clocks.has(img);

/** Track an img that plays from the `src` in its HTML. */
export const adopt = (img: HTMLImageElement) => {
  const start = (started: number) =>
    clocks.set(img, { live: img.getAttribute("src")!, at: 0, started });

  if (!img.complete)
    return img.addEventListener("load", () => start(performance.now()), { once: true });
  const [entry] = performance.getEntriesByName(img.src);
  start(entry instanceof PerformanceResourceTiming ? entry.responseEnd : performance.now());
};

// An SVG's clock is shared by every <img> and probe that loads its URL, and a new one restarts it. A background image
// shares it without restarting it, so the copy fading out over the img is a background.
const FIT = new Map([
  ["fill", "100% 100%"],
  ["cover", "cover"],
  ["contain", "contain"],
  ["scale-down", "contain"],
  ["none", "auto"],
]);

const crossfade = (img: HTMLImageElement, old: string) => {
  if (!img.offsetParent) return revoke(old);
  const style = getComputedStyle(img);
  const veil = document.createElement("span");
  veil.setAttribute("aria-hidden", "true");
  Object.assign(veil.style, {
    position: "absolute",
    left: `${img.offsetLeft}px`,
    top: `${img.offsetTop}px`,
    width: `${img.offsetWidth}px`,
    height: `${img.offsetHeight}px`,
    borderRadius: style.borderRadius,
    background: `url("${old}") ${style.objectPosition} / ${FIT.get(style.objectFit) ?? "100% 100%"} no-repeat`,
    pointerEvents: "none",
  });
  img.after(veil);
  veil
    .animate({ opacity: [1, 0] }, { duration: FADE, easing: "ease-out" })
    .finished.catch(() => {})
    .then(() => {
      veil.remove();
      revoke(old);
    });
};

/**
 * Show `next` in `img` once it has decoded, so the swap never flashes empty. A newer call for the same img wins over
 * one still on its way. With `fade`, the old picture fades out over the new one, unless the reader wants less motion.
 */
export const show = async (
  img: HTMLImageElement,
  next: Frame | Promise<Frame>,
  { fade = false } = {},
) => {
  const turn = (turns.get(img) ?? 0) + 1;
  turns.set(img, turn);
  const frame = await next;
  const old = img.getAttribute("src");

  if (frame.url !== old) {
    const probe = new Image();
    probe.src = frame.url;
    await probe.decode().catch(() => {});
  }

  if (turns.get(img) !== turn) {
    if (frame.url !== img.getAttribute("src")) revoke(frame.url);

    return false;
  }

  if (frame.url === old) return true;

  if (frame.live)
    clocks.set(img, { live: frame.live, at: frame.at ?? 0, started: performance.now() });
  else clocks.delete(img);
  const fades = fade && old && !calm.matches;

  if (fades) crossfade(img, old);
  img.src = frame.url;

  if (!fades) revoke(old);

  return true;
};

// A copy starts at the `at` asked for once it has been restyled and decoded, a frame or so after it was asked for. It
// asks for that much more, judged by the last swap.
let lead = 0;

/** Show a playing img again in the current palette, from where it has got to. */
export const replay = async (img: HTMLImageElement) => {
  const clock = clocks.get(img);

  if (!clock) return false;
  const asked = performance.now();
  const before = img.getAttribute("src");
  const shown = await show(img, playing(img, clock.live, elapsed(img) + lead), { fade: true });

  if (shown && img.getAttribute("src") !== before) lead = (performance.now() - asked) / 1000;

  return shown;
};
