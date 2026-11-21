import type { Seconds } from "./model/time";
import { RATE_ATTR } from "./svg/rate";

/** Calls `progress` with 0 to 1 whenever it likes, and returns the function that stops it. */
export type Driver = (progress: (amount: number) => void) => () => void;

export interface ClockControl {
  readonly name: string;
  /** The clock's length, in scene seconds. */
  readonly over: Seconds;
  /** Where the clock is now, from 0 to `over`. */
  readonly time: Seconds;
  /** Show the clock at `time`, kept within 0 to `over`. Stops a play() or reverse() in progress. */
  seek(time: Seconds): void;
  /** Seek to `amount` of the way through the clock, from 0 to 1. */
  progress(amount: number): void;
  /** Run forward to `over` in real time. Resolves true if it got there, false if something else moved the clock first. */
  play(): Promise<boolean>;
  /** Run back to 0 in real time, resolving as play() does. */
  reverse(): Promise<boolean>;
  /** Stop where the clock is. */
  pause(): void;
  /** Let a driver move the clock. Returns the function that stops following. */
  follow(driver: Driver): () => void;
}

export interface Mounted {
  readonly clocks: ReadonlyMap<string, ClockControl>;
  /** The clock called `name`. Throws, naming the clocks the SVG has, when there is none. */
  clock(name: string): ClockControl;
  /** Stop every driver and every play() or reverse(), leaving the picture where it is. */
  unmount(): void;
}

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (amount: number, over: number) => Math.min(over, Math.max(0, amount));

const numberOf = (element: Element, name: string) => parseFloat(element.getAttribute(name) ?? "");

interface Part {
  readonly animation: Animation;
  /** Where the clock starts in the scene, in scene seconds. */
  readonly at: Seconds;
}

interface Group {
  readonly over: Seconds;
  /** Scene seconds per second of playback. */
  readonly rate: number;
  readonly parts: Part[];
}

/** The CSS animations under `root`, by the clock of the nearest marked element above their target. */
const grouped = (root: Element): Map<string, Group> => {
  const groups = new Map<string, Group>();

  for (const animation of root.getAnimations({ subtree: true })) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    const marked = target?.closest("[data-clock]");

    if (!(animation instanceof CSSAnimation) || !marked) continue;
    const name = marked.getAttribute("data-clock")!;
    let group = groups.get(name);

    if (!group) {
      const rate = numberOf(marked.closest("svg") ?? marked, RATE_ATTR) || 1;
      group = { over: numberOf(marked, "data-clock-over"), rate, parts: [] };
      groups.set(name, group);
    }

    group.parts.push({ animation, at: numberOf(marked, "data-clock-at") });
  }

  return groups;
};

const control = (name: string, { over, rate, parts }: Group) => {
  let time = 0;
  let frame = 0;
  let ending: ((reached: boolean) => void) | undefined;
  const drivers = new Set<() => void>();

  // The animation shows its own time minus its delay: the reduced-motion rule gives it a negative one to freeze it.
  const show = (at: Seconds) => {
    time = at;

    for (const { animation, at: start } of parts)
      animation.currentTime =
        ((start + at) / rate) * 1000 + Number(animation.effect?.getTiming().delay ?? 0);
  };

  const halt = () => {
    cancelAnimationFrame(frame);
    ending?.(false);
    ending = undefined;
  };

  const run = (to: Seconds) =>
    new Promise<boolean>((resolve) => {
      halt();

      if (calm() || time === to) {
        show(to);
        resolve(true);

        return;
      }

      const from = time;
      const started = performance.now();
      const length = (Math.abs(to - from) / rate) * 1000;

      const tick = () => {
        const done = Math.min(1, (performance.now() - started) / length);
        show(from + (to - from) * done);

        if (done < 1) frame = requestAnimationFrame(tick);
        else {
          ending = undefined;
          resolve(true);
        }
      };

      ending = resolve;
      frame = requestAnimationFrame(tick);
    });

  const seek = (at: Seconds) => {
    halt();
    show(clamp(at, over));
  };

  const progress = (amount: number) => seek(clamp(amount, 1) * over);

  const follow = (driver: Driver) => {
    const stop = driver(progress);

    const drop = () => {
      if (drivers.delete(drop)) stop();
    };

    drivers.add(drop);

    return drop;
  };

  for (const { animation } of parts) animation.pause();
  show(0);

  const clock: ClockControl = {
    name,
    over,
    get time() {
      return time;
    },
    seek,
    progress,
    play: () => run(over),
    reverse: () => run(0),
    pause: halt,
    follow,
  };

  const release = () => {
    drivers.forEach((drop) => drop());
    halt();
  };

  return { clock, release };
};

/**
 * Takes over the clocks of an inline SVG svjeez made (or of the SVGs inside `root`): their animations pause, and the
 * returned controls move them. Animations that are not on a clock go on playing.
 */
export const mount = (root: Element): Mounted => {
  const made = [...grouped(root)].map(([name, group]) => [name, control(name, group)] as const);
  const clocks = new Map(made.map(([name, { clock }]) => [name, clock]));

  return {
    clocks,
    clock: (name) => {
      const found = clocks.get(name);

      if (!found)
        throw new Error(
          `This SVG has no clock "${name}"; it has ${clocks.size ? [...clocks.keys()].map((one) => `"${one}"`).join(", ") : "none"}`,
        );

      return found;
    },
    unmount: () => made.forEach(([, { release }]) => release()),
  };
};

/** 0 when `target`'s top reaches the bottom of the viewport, and 1 when its bottom reaches the top. */
export const scrolled =
  (target: Element): Driver =>
  (progress) => {
    const update = () => {
      const { top, height } = target.getBoundingClientRect();

      progress((innerHeight - top) / (innerHeight + height));
    };

    // Capturing also hears the scrolling of anything the target sits in.
    addEventListener("scroll", update, { passive: true, capture: true });
    addEventListener("resize", update);
    update();

    return () => {
      removeEventListener("scroll", update, { capture: true });
      removeEventListener("resize", update);
    };
  };

/** Where the pointer is across `target`'s box, from 0 to 1, along `axis` (x by default). */
export const pointer =
  (target: Element, { axis = "x" }: { readonly axis?: "x" | "y" } = {}): Driver =>
  (progress) => {
    const move = (event: PointerEvent) => {
      const { left, top, width, height } = target.getBoundingClientRect();

      if (axis === "x") progress(width ? (event.clientX - left) / width : 0);
      else progress(height ? (event.clientY - top) / height : 0);
    };

    addEventListener("pointermove", move);

    return () => removeEventListener("pointermove", move);
  };
