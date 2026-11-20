import type { Theme } from "./author/values";
import { restyle } from "./restyle";

export type Scheme = "light" | "dark";

/** How a scene must look right now: its scheme, and another theme for its tokens than the one it was built with. */
export interface Look {
  readonly scheme: Scheme;
  /**
   * The theme to repaint the scene with, worked out from its markup (a palette that follows the scene's code colors needs
   * to read it), or undefined for the scene as built. Give the same function for the same look: players compare by identity.
   */
  readonly theme?: (svg: string) => Theme | undefined;
}

export interface PlayerOptions {
  /** The URL of the scene's SVG. Defaults to the one in the img's `data-svjeez` (written by `<Scene poster>`), else its `data-live`, else its `src`. */
  readonly live?: string;
  /** The poster of the scene for a scheme, for the img as it is now. Defaults to the narrowest one in `data-svjeez` that is sharp at the img's size and screen. */
  readonly poster?: (scheme: Scheme, img: HTMLImageElement) => string | undefined;
  /** How the scene must look now. Defaults to the OS's scheme and the scene as built. */
  readonly look?: (img: HTMLImageElement) => Look;
  /** How long a change of picture fades, in milliseconds. */
  readonly fade?: number;
  /** The img already plays `live` as its `src` in the HTML, so its clock starts now and it is only swapped when it must differ. */
  readonly adopt?: boolean;
  /** How far outside the viewport, in pixels, a still may be before it is made again for a new look. */
  readonly near?: number;
}

interface ShowOptions {
  readonly fade?: boolean;
}

export interface Player {
  readonly img: HTMLImageElement;
  /** What the player last showed: the scene playing, or its still. Undefined until it has shown either. */
  readonly state: "live" | "still" | undefined;
  /** For an adopted img, resolves once it shows what its look needs: at once when the file it already plays will do. */
  readonly ready: Promise<boolean>;
  /** Play the scene, or show its still when the viewer asked for less motion. */
  play(): Promise<boolean>;
  /** Go back to the still, if the scene is playing or about to. */
  stop(options?: ShowOptions): Promise<boolean>;
  /** Show the still. */
  still(options?: ShowOptions): Promise<boolean>;
  /** The look changed (the scheme, a palette): show the scene again in it. A playing scene goes on from where it is. */
  refresh(options?: ShowOptions): Promise<boolean>;
}

/** What `<Scene poster>` writes into an img's `data-svjeez`. */
interface Embedded {
  readonly live?: string;
  readonly posters?: Readonly<Partial<Record<Scheme, readonly { src: string; width: number }[]>>>;
}

const embeddedIn = (img: HTMLImageElement): Embedded => {
  try {
    return img.dataset.svjeez ? JSON.parse(img.dataset.svjeez) : {};
  } catch {
    return {};
  }
};

type Frame = { readonly url: string; readonly live?: string; readonly at?: number };

const systemScheme = (): Scheme =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const turns = new WeakMap<HTMLImageElement, number>();
const clocks = new WeakMap<HTMLImageElement, { live: string; at: number; started: number }>();
const revoke = (url: string | null) => url?.startsWith("blob:") && URL.revokeObjectURL(url);

/** How far in, in seconds, the scene an img plays is. */
const elapsed = (img: HTMLImageElement) => {
  const clock = clocks.get(img);

  return clock ? clock.at + (performance.now() - clock.started) / 1000 : 0;
};

const FIT = new Map([
  ["fill", "100% 100%"],
  ["cover", "cover"],
  ["contain", "contain"],
  ["scale-down", "contain"],
  ["none", "auto"],
]);

const crossfade = (img: HTMLImageElement, old: string, duration: number) => {
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
    .animate({ opacity: [1, 0] }, { duration, easing: "ease-out" })
    .finished.catch(() => {})
    .then(() => {
      veil.remove();
      revoke(old);
    });
};

// An img in a <picture>, or with a srcset, would keep choosing from them over a src set from here.
const letGo = (img: HTMLImageElement) => {
  img.removeAttribute("srcset");
  img
    .closest("picture")
    ?.querySelectorAll("source")
    .forEach((one) => one.remove());
};

/** Show `next` in the img once it has decoded, unless a later call got there first. */
const show = async (
  img: HTMLImageElement,
  next: Frame | Promise<Frame>,
  { fade = false, duration = 200 } = {},
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
  const fades = fade && old && !calm();

  if (fades) crossfade(img, old, duration);
  img.src = frame.url;
  letGo(img);

  if (!fades) revoke(old);

  return true;
};

let lead = 0;

// One observer for every player: which of them are near the viewport.
const nearby = new Map<number, IntersectionObserver>();
const watchers = new WeakMap<Element, (near: boolean) => void>();

const watch = (img: HTMLImageElement, margin: number, change: (near: boolean) => void) => {
  let observer = nearby.get(margin);

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => watchers.get(entry.target)?.(entry.isIntersecting)),
      { rootMargin: `${margin}px 0px` },
    );
    nearby.set(margin, observer);
  }

  watchers.set(img, change);
  observer.observe(img);
};

/**
 * Plays a scene's SVG in an `<img>` and shows its still in between: the poster, or when the look differs from what the
 * HTML was built for (Safari answers prefers-color-scheme with the OS's scheme whatever the page says, and a palette
 * is another theme), a copy of the scene restyled for it. A scene keeps its time when its look changes under it.
 */
export const player = (img: HTMLImageElement, options: PlayerOptions = {}): Player => {
  const embedded = embeddedIn(img);
  const live = options.live ?? embedded.live ?? img.dataset.live ?? img.getAttribute("src")!;

  const look: (img: HTMLImageElement) => Look =
    options.look ?? (() => ({ scheme: systemScheme() }));

  const poster =
    options.poster ??
    ((scheme: Scheme, one: HTMLImageElement) => {
      const list = embedded.posters?.[scheme] ?? [];
      const wide = one.clientWidth * devicePixelRatio;

      return (list.find((each) => each.width >= wide) ?? list.at(-1))?.src;
    });

  const duration = options.fade ?? 200;

  let wanted: "live" | "still" | undefined;
  let state: Player["state"];
  let near = false;
  // The look the HTML was made for, and then whatever was last shown.
  let shown: Look = { scheme: systemScheme() };

  const pinTo = (now: Look) => (now.scheme === systemScheme() ? undefined : now.scheme);

  const paint = async (now: Look, { at = 0, still = false } = {}) => {
    const svg = await source(live);

    if (!svg) return undefined;
    const out = restyle(svg, { theme: now.theme?.(svg), scheme: pinTo(now), at, still });

    return URL.createObjectURL(new Blob([out], { type: "image/svg+xml" }));
  };

  /** The scene playing from `at` seconds in, in the look it must have: the plain file when that needs nothing. */
  const playing = async (now: Look, at = 0): Promise<Frame> => {
    if (!now.theme && !pinTo(now) && (!at || img.getAttribute("src") === live))
      return { url: live, live, at: 0 };
    const url = await paint(now, { at });

    return url ? { url, live, at } : { url: live, live, at: 0 };
  };

  const frozen = async (now: Look, withPoster: boolean): Promise<Frame> => {
    const known = withPoster ? poster(now.scheme, img) : undefined;

    if (!now.theme && (known || !pinTo(now))) return { url: known ?? live };

    return { url: (await paint(now, { still: true })) ?? known ?? live };
  };

  const settle = (now: Look, ok: boolean) => {
    if (ok) shown = now;

    return ok;
  };

  // For a style that shows what the img is doing: a hairline while the scene loads, say.
  const mark = (to: "loading" | "live" | "still") => {
    img.dataset.state = to;
  };

  const still = async ({ fade = false }: ShowOptions = {}) => {
    wanted = "still";
    state = "still";
    mark("still");
    const now = look(img);

    return settle(now, await show(img, frozen(now, true), { fade, duration }));
  };

  const play = async () => {
    if (calm()) return state === "still" ? true : still();

    if (wanted === "live") return true;
    wanted = "live";
    mark("loading");
    const now = look(img);
    const ok = await show(img, playing(now), { duration });

    if (ok) {
      state = "live";
      mark("live");
    }

    return settle(now, ok);
  };

  const replay = async () => {
    const clock = clocks.get(img);

    if (!clock) return false;
    const asked = performance.now();
    const before = img.getAttribute("src");
    const now = look(img);
    const ok = await show(img, playing(now, elapsed(img) + lead), { fade: true, duration });

    if (ok && img.getAttribute("src") !== before) lead = (performance.now() - asked) / 1000;

    return settle(now, ok);
  };

  // An img with no src yet has nothing to show; one with a src shows the look the HTML was made for, until it changes.
  const stale = () => {
    const now = look(img);

    return !img.getAttribute("src") || now.scheme !== shown.scheme || now.theme !== shown.theme;
  };

  const refresh = async ({ fade = false }: ShowOptions = {}) => {
    if (options.adopt) return follow(fade);

    if (state === "live") return replay();

    if (wanted === "live") {
      wanted = undefined;

      return play();
    }

    if (stale() && near) return still({ fade });

    return false;
  };

  // An img that plays its `src` from the HTML: it is swapped only when its look differs from what the HTML shows, and
  // the scene it holds is the file itself when the viewer asked for less motion, which it then honors on its own.
  const follow = async (fade: boolean) => {
    const now = look(img);

    if (calm() && now.theme) return settle(now, await show(img, frozen(now, false), { duration }));

    if (calm())
      return settle(now, await show(img, pinTo(now) ? playing(now) : { url: live }, { duration }));

    return clocks.has(img)
      ? replay()
      : settle(now, await show(img, playing(now), { fade, duration }));
  };

  let ready = Promise.resolve(true);

  if (options.adopt) {
    const now = look(img);

    if (calm() || now.theme || pinTo(now)) ready = follow(false);
    else {
      const start = (started: number) => clocks.set(img, { live, at: 0, started });

      if (!img.complete)
        img.addEventListener("load", () => start(performance.now()), { once: true });
      else {
        const [entry] = performance.getEntriesByName(img.src);
        start(entry instanceof PerformanceResourceTiming ? entry.responseEnd : performance.now());
      }
    }
  } else
    watch(img, options.near ?? 400, (isNear) => {
      near = isNear;

      if (!isNear) return;

      if (wanted !== "live" && stale()) still();
    });

  const stop = async ({ fade = true }: ShowOptions = {}) => {
    if (wanted !== "live") return false;
    wanted = undefined;

    return still({ fade });
  };

  return {
    img,
    get state() {
      return state;
    },
    ready,
    play,
    still,
    stop,
    refresh,
  };
};

/** Something that plays and stops a player, and the way to undo it. */
export type Trigger = (player: Player) => () => void;

/**
 * Plays while the pointer rests on `on` for `delay` milliseconds, and stops when it leaves. Focus on `focus` does the same
 * at once. Over `ignore` (a menu in the card) the wait starts over.
 */
export const hovered =
  (
    on: Element,
    { delay = 150, ignore, focus }: { delay?: number; ignore?: Element; focus?: HTMLElement } = {},
  ): Trigger =>
  (player) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void player.play(), delay);
    };

    const leave = () => {
      clearTimeout(timer);
      void player.stop();
    };

    const listen = <E extends Event>(
      target: EventTarget,
      type: string,
      run: (event: E) => void,
    ) => {
      // SAFETY: the listener is only ever added for the event type it is given, which carries an E.
      const handler = run as (event: Event) => void;
      target.addEventListener(type, handler);

      return () => target.removeEventListener(type, handler);
    };

    const undo = [
      listen(on, "pointerenter", later),
      listen(on, "pointerleave", leave),
      ...(ignore
        ? [
            listen(ignore, "pointerenter", () => clearTimeout(timer)),
            listen<PointerEvent>(ignore, "pointerleave", ({ relatedTarget: to }) => {
              if (to instanceof Node && on.contains(to) && !ignore.contains(to)) later();
            }),
          ]
        : []),
      ...(focus
        ? [listen(focus, "focus", () => void player.play()), listen(focus, "blur", leave)]
        : []),
    ];

    return () => {
      clearTimeout(timer);
      undo.forEach((off) => off());
    };
  };

/** Plays while at least `threshold` of the img is on screen, and stops when it is not. */
export const seen =
  ({ threshold = 0.75 }: { threshold?: number } = {}): Trigger =>
  (player) => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => void (entry.isIntersecting ? player.play() : player.stop())),
      { threshold },
    );

    observer.observe(player.img);

    return () => observer.disconnect();
  };
