import { restyle } from "svjeez/page";
import { calm, pinScheme, scheme as pageScheme, systemScheme, type Scheme } from "./scheme";

const FADE = 200;

const sources = new Map<string, Promise<string | undefined>>();

const source = (live: string) => {
  let svg = sources.get(live);

  if (!svg) {
    svg = fetch(live)
      .then((response) => (response.ok ? response.text() : undefined))
      .then((text) => text || undefined)
      .catch(() => void sources.delete(live));
    sources.set(live, svg);
  }

  return svg;
};

/**
 * The scheme an img must be pinned to: its own data-scheme or the page's, when that is not the OS's. Chromium shows an
 * <img> SVG in the color-scheme around it, but Safari always shows the OS's.
 */
export const pinned = (img: HTMLImageElement) => {
  const own = img.dataset.scheme;
  const want: Scheme = own === "light" || own === "dark" ? own : pageScheme();

  return want === systemScheme() ? undefined : want;
};

/** A blob URL of the scene at `live` pinned to `scheme`, `at` seconds in or held at its still frame. */
const pin = async (live: string, scheme: Scheme, { at = 0, still = false } = {}) => {
  const svg = await source(live);

  if (!svg) return undefined;

  return URL.createObjectURL(
    new Blob([restyle(pinScheme(svg, scheme), { at, still })], { type: "image/svg+xml" }),
  );
};

/** What an img shows: a URL, and when it is the scene playing, which scene and how many seconds in it starts. */
export interface Frame {
  readonly url: string;
  readonly live?: string;
  readonly at?: number;
}

/** The scene at `live` playing from `at` seconds in, in the scheme the img must show. */
export const playing = async (img: HTMLImageElement, live: string, at = 0): Promise<Frame> => {
  const scheme = pinned(img);
  const url = scheme ? await pin(live, scheme, { at }) : undefined;

  return url ? { url, live, at } : { url: live, live, at: 0 };
};

/** The scene's still: its poster, or a pinned still copy when it has none. */
export const frozen = async (
  img: HTMLImageElement,
  live: string,
  poster: string | undefined,
): Promise<Frame> => {
  if (poster) return { url: poster };
  const scheme = pinned(img);

  return { url: (scheme ? await pin(live, scheme, { still: true }) : undefined) ?? live };
};

const turns = new WeakMap<HTMLImageElement, number>();
const clocks = new WeakMap<HTMLImageElement, { live: string; at: number; started: number }>();
const revoke = (url: string | null) => url?.startsWith("blob:") && URL.revokeObjectURL(url);

/** How far in, in seconds, the scene an img plays is. */
const elapsed = (img: HTMLImageElement) => {
  const clock = clocks.get(img);

  return clock ? clock.at + (performance.now() - clock.started) / 1000 : 0;
};

export const isPlaying = (img: HTMLImageElement) => clocks.has(img);

/** Start the clock of an img that plays its `src` straight from the HTML. */
export const adopt = (img: HTMLImageElement) => {
  const start = (started: number) =>
    clocks.set(img, { live: img.getAttribute("src")!, at: 0, started });

  if (!img.complete)
    return img.addEventListener("load", () => start(performance.now()), { once: true });
  const [entry] = performance.getEntriesByName(img.src);
  start(entry instanceof PerformanceResourceTiming ? entry.responseEnd : performance.now());
};

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

/** Show `next` in the img once it has decoded, unless a later call got there first. */
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

let lead = 0;

/** Show a playing scene again where it is, in the scheme it must show now. */
export const replay = async (img: HTMLImageElement) => {
  const clock = clocks.get(img);

  if (!clock) return false;
  const asked = performance.now();
  const before = img.getAttribute("src");
  const shown = await show(img, playing(img, clock.live, elapsed(img) + lead), { fade: true });

  if (shown && img.getAttribute("src") !== before) lead = (performance.now() - asked) / 1000;

  return shown;
};
