import type { States } from "./model/ir";
import type { Seconds } from "./model/time";
import { runShaders } from "./shader";
import { RATE_ATTR } from "./svg/rate";

/** Calls `progress` with 0 to 1 whenever it likes, and returns the function that stops it. */
export type Driver = (progress: (amount: number) => void) => () => void;

export interface ClockControl {
  readonly name: string;
  /** The clock's length, in scene seconds. */
  readonly over: Seconds;
  /** Where the clock is now, from 0 to `over`. */
  readonly time: Seconds;
  /** Show the clock at `time`, kept within 0 to `over`. Stops a to(), play(), reverse() or loop() in progress. */
  seek(time: Seconds): void;
  /** Seek to `amount` of the way through the clock, from 0 to 1. */
  progress(amount: number): void;
  /**
   * Run from where the clock is to `time` (kept within 0 to `over`) in real time, so the scene's own easing plays,
   * forward or backward. Resolves true if it got there, false if something else moved the clock first. Under reduced
   * motion it jumps. With `forward`, a `time` behind the clock is reached by running on through `over`, wrapping to 0 and
   * on to `time`, so the clock never runs backward.
   */
  to(time: Seconds, options?: { readonly forward?: boolean }): Promise<boolean>;
  /** Run forward to `over` in real time, as to(over) does. */
  play(): Promise<boolean>;
  /** Run back to 0 in real time, as to(0) does. */
  reverse(): Promise<boolean>;
  /**
   * Run forward from where the clock is, in real time and without end: at `over` it wraps back to 0. Stopped by
   * seek, progress, to, play, reverse and pause. Under reduced motion the clock shows 0 and doesn't run.
   */
  loop(): void;
  /** True while loop() runs the clock, until something else moves it. */
  readonly looping: boolean;
  /** Stop where the clock is. */
  pause(): void;
  /** Let a driver move the clock. Returns the function that stops following. */
  follow(driver: Driver): () => void;
}

/** A <Slot> of the scene: the box page code can fill with its own HTML. */
export interface SlotControl {
  /** The group that holds the fallback, and the hosted node while there is one. */
  readonly element: SVGGElement;
  /** The slot's box, in the group's own units. */
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /**
   * Put `node` in the box, in a `<foreignObject>` inside the group, so the scene's transforms and clocks move it, and
   * hide the fallback. The node fills the box when its CSS says `width: 100%; height: 100%`. Hosting again replaces
   * the node. Returns the function that takes it out and shows the fallback again.
   */
  host(node: HTMLElement): () => void;
}

export interface Mounted {
  /** Where each clock rests in each state, as the scene declared in `states`: empty when it declared none. */
  readonly states: States;
  readonly clocks: ReadonlyMap<string, ClockControl>;
  /** The clock called `name`. Throws, naming the clocks the SVG has, when there is none. */
  clock(name: string): ClockControl;
  /** The elements marked `hit="name"` in the scene. Throws, naming the hit names the SVG has, when there are none. */
  hit(name: string): readonly Element[];
  /** The slot called `name`. Throws, naming the slots the SVG has, when there is none. */
  slot(name: string): SlotControl;
  /** Stop every driver and every move of a clock, leaving the picture where it is. The SVG can be mounted again. */
  unmount(): void;
}

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (amount: number, over: number) => Math.min(over, Math.max(0, amount));

const numberOf = (element: Element, name: string) => parseFloat(element.getAttribute(name) ?? "");

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const dropped = (text: string) => text.replace(/[\s,]+/g, "");

const shown = (value: number) => String(Number(value.toFixed(4)));

/** The numbers of a value and the text around them, without spacing: path data with equal commands has equal text. */
const split = (value: string) => ({
  numbers: (value.match(NUMBER) ?? []).map(Number),
  around: value.split(NUMBER).map(dropped),
});

const channelsOf = (hex: string) => {
  const digits = hex.length < 6 ? hex.slice(1).replace(/./g, "$&$&") : hex.slice(1);

  return [0, 2, 4, 6].map((at) =>
    at < digits.length ? parseInt(digits.slice(at, at + 2), 16) : 255,
  );
};

const transparent = (hex: string) => hex.length === 5 || hex.length === 9;

const mixed = (from: string, to: string, amount: number) => {
  const [a, b] = [channelsOf(from), channelsOf(to)];

  const hex = a
    .slice(0, transparent(from) || transparent(to) ? 4 : 3)
    .map((channel, at) => {
      const value = Math.round(Math.min(255, Math.max(0, channel + (b[at]! - channel) * amount)));

      return value.toString(16).padStart(2, "0");
    })
    .join("");

  return `#${hex}`;
};

/**
 * The value `amount` of the way from `from` to `to`, as SMIL blends it: numbers, hex colors, and path data with the
 * same commands blend; any other pair switches at the end.
 */
const blend = (from: string, to: string, amount: number): string => {
  if (HEX.test(from) && HEX.test(to)) return mixed(from, to, amount);
  const [a, b] = [split(from), split(to)];

  if (!a.numbers.length || a.around.join("|") !== b.around.join("|")) return amount < 1 ? from : to;

  return a.around.reduce((text, between, at) => {
    const number = at
      ? shown(a.numbers[at - 1]! + (b.numbers[at - 1]! - a.numbers[at - 1]!) * amount)
      : "";

    const apart = at > 1 && !a.around[at - 1] && !number.startsWith("-") ? " " : "";

    return text + apart + number + between;
  }, "");
};

/** The y of a CSS cubic-bezier through (0,0) and (1,1) where the curve is at x. */
const bezier = ([x1, y1, x2, y2]: readonly number[], x: number) => {
  const at = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;

  let [lo, hi] = [0, 1];

  for (let step = 0; step < 40; step++) {
    const mid = (lo + hi) / 2;

    if (at(x1!, x2!, mid) < x) lo = mid;
    else hi = mid;
  }

  return at(y1!, y2!, (lo + hi) / 2);
};

/** An attribute's value at a time in playback seconds. */
type Sample = (playback: number) => string;

/**
 * What an `<animate>` svjeez wrote shows at a playback time. A plain one cycles over `dur` until its repeats are done,
 * then holds the last value. A windowed one, marked `data-loop`, runs once per loop from its `begin`, holding the first
 * value before and the last after; the `<set>` beside it only says the same, so it is not read.
 */
const sampled = (animate: Element): Sample => {
  const list = (name: string) =>
    (animate.getAttribute(name) ?? "").split(";").map((one) => one.trim());

  const values = list("values");
  const times = list("keyTimes").map(Number);
  const splines = list("keySplines").map((one) => one.split(/\s+/).map(Number));
  const duration = numberOf(animate, "dur");
  const loop = numberOf(animate, "data-loop");
  const begin = numberOf(animate, "begin");

  const repeats =
    animate.getAttribute("repeatCount") === "indefinite"
      ? Infinity
      : numberOf(animate, "repeatCount");

  const mode = animate.getAttribute("calcMode");
  const last = values[values.length - 1]!;

  const cycle = (share: number) => {
    const at = Math.min(
      times.length - 2,
      Math.max(
        0,
        times.findLastIndex((time) => time <= share),
      ),
    );

    if (mode === "discrete") return values[at]!;
    const span = times[at + 1]! - times[at]!;
    const along = span > 0 ? (share - times[at]!) / span : 1;

    return blend(
      values[at]!,
      values[at + 1]!,
      mode === "spline" ? bezier(splines[at]!, along) : along,
    );
  };

  if (loop > 0)
    return (playback) => {
      const inside = playback % loop;
      const start = begin || 0;

      if (inside < start) return values[0]!;

      return inside >= start + duration ? last : cycle((inside - start) / duration);
    };

  return (playback) =>
    playback >= repeats * duration ? last : cycle((playback % duration) / duration);
};

interface Tween {
  readonly target: Element;
  readonly attribute: string;
  readonly sample: Sample;
  /** Where the clock starts in the scene, in scene seconds. */
  readonly at: Seconds;
}

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
  readonly tweens: Tween[];
}

/**
 * The animations under `root`, by the clock of the nearest marked element above their target. SMIL has one clock per
 * SVG, so each `<animate>` on a clock is read into a sampler and removed, and the clock sets its attribute itself.
 */
const grouped = (root: Element): Map<string, Group> => {
  const groups = new Map<string, Group>();

  const groupOf = (marked: Element) => {
    const name = marked.getAttribute("data-clock")!;
    let group = groups.get(name);

    if (!group) {
      const rate = numberOf(marked.closest("svg") ?? marked, RATE_ATTR) || 1;
      group = { over: numberOf(marked, "data-clock-over"), rate, parts: [], tweens: [] };
      groups.set(name, group);
    }

    return group;
  };

  for (const animation of root.getAnimations({ subtree: true })) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    const marked = target?.closest("[data-clock]");

    if (!(animation instanceof CSSAnimation) || !marked) continue;
    groupOf(marked).parts.push({ animation, at: numberOf(marked, "data-clock-at") });
  }

  for (const smil of root.querySelectorAll("animate, set")) {
    const marked = smil.closest("[data-clock]");
    const target = smil.parentElement;
    const attribute = smil.getAttribute("attributeName");

    if (!marked || !target) continue;
    const group = groupOf(marked);

    if (smil.localName === "animate" && attribute)
      group.tweens.push({
        target,
        attribute,
        sample: sampled(smil),
        at: numberOf(marked, "data-clock-at"),
      });
    smil.remove();
  }

  return groups;
};

const control = (name: string, { over, rate, parts, tweens }: Group) => {
  let time = 0;
  let frame = 0;
  let looping = false;
  let ending: ((reached: boolean) => void) | undefined;
  const drivers = new Set<() => void>();

  // The animation shows its own time minus its delay: the reduced-motion rule gives it a negative one to freeze it.
  const show = (at: Seconds) => {
    time = at;

    for (const { animation, at: start } of parts)
      animation.currentTime =
        ((start + at) / rate) * 1000 + Number(animation.effect?.getTiming().delay ?? 0);

    for (const { target, attribute, sample, at: start } of tweens)
      target.setAttribute(attribute, sample((start + at) / rate));
  };

  const halt = () => {
    looping = false;
    cancelAnimationFrame(frame);
    ending?.(false);
    ending = undefined;
  };

  const run = (end: Seconds, forward = false) => {
    const to = clamp(end, over);

    return new Promise<boolean>((resolve) => {
      halt();

      if (calm() || time === to) {
        show(to);
        resolve(true);

        return;
      }

      const from = time;
      const started = performance.now();
      const wraps = forward && to < from;
      const distance = wraps ? over - from + to : Math.abs(to - from);
      const length = (distance / rate) * 1000;

      const tick = () => {
        const done = Math.min(1, (performance.now() - started) / length);

        const along = from + distance * done;

        if (!wraps) show(from + (to - from) * done);
        else show(done === 1 ? to : along >= over ? along - over : along);

        if (done < 1) frame = requestAnimationFrame(tick);
        else {
          ending = undefined;
          resolve(true);
        }
      };

      ending = resolve;
      frame = requestAnimationFrame(tick);
    });
  };

  const loop = () => {
    halt();

    if (calm()) {
      show(0);

      return;
    }

    const from = time;
    const started = performance.now();

    looping = true;

    const tick = () => {
      show((from + ((performance.now() - started) / 1000) * rate) % over);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
  };

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
    to: (time, { forward = false } = {}) => run(time, forward),
    get looping() {
      return looping;
    },
    play: () => run(over),
    reverse: () => run(0),
    loop,
    pause: halt,
    follow,
  };

  const release = () => {
    drivers.forEach((drop) => drop());
    halt();
  };

  return { clock, release };
};

// What a mount took over, by SVG: the SMIL it removed can't be read a second time, so a mount after an unmount reuses it.
const taken = new WeakMap<Element, Map<string, Group>>();

// The node each slot's group hosts now, by group, and the function that takes it out.
const hosting = new WeakMap<Element, () => void>();

const SVG = "http://www.w3.org/2000/svg";

const slotOf = (root: Element, name: string): SlotControl => {
  const element = root.querySelector(`g[data-slot="${CSS.escape(name)}"]`);

  if (!(element instanceof SVGGElement)) {
    const names = [...root.querySelectorAll("[data-slot]")].map(
      (one) => `"${one.getAttribute("data-slot")}"`,
    );

    throw new Error(
      `This SVG has no slot "${name}"; it has ${names.length ? names.join(", ") : "none"}`,
    );
  }

  const [x = 0, y = 0, width = 0, height = 0] = (element.getAttribute("data-slot-box") ?? "")
    .split(" ")
    .map(Number);

  const box = { x, y, width, height };

  // The fallback is made see-through rather than taken out of the page: a clock keeps hold of its animations.
  const host = (node: HTMLElement) => {
    hosting.get(element)?.();
    const fallback = [...element.children].filter((child) => child instanceof SVGElement);
    const styles = fallback.map((child) => child.getAttribute("style"));
    const frame = document.createElementNS(SVG, "foreignObject");

    for (const [attribute, value] of Object.entries(box))
      frame.setAttribute(attribute, String(value));

    for (const child of fallback) {
      child.style.setProperty("opacity", "0", "important");
      child.style.setProperty("pointer-events", "none", "important");
    }

    frame.append(node);
    element.append(frame);

    const release = () => {
      if (hosting.get(element) !== release) return;
      hosting.delete(element);
      frame.remove();

      fallback.forEach((child, at) => {
        const style = styles[at];

        if (style === null || style === undefined) child.removeAttribute("style");
        else child.setAttribute("style", style);
      });
    };

    hosting.set(element, release);

    return release;
  };

  return { element, box, host };
};

const statesOf = (svg: Element): States => JSON.parse(svg.getAttribute("data-states") ?? "{}");

/**
 * Takes over the clocks of an inline SVG svjeez made (or of the SVGs inside `root`): their animations pause, their SMIL
 * is replaced by attributes the controls set, and the controls move them. Animations that are not on a clock go on playing.
 *
 * Mounting the same SVG again, as a framework that remounts does (mount, unmount, mount), works the same: the clocks
 * start at 0 again.
 */
export const mount = (root: Element): Mounted => {
  const svg = root.localName === "svg" ? root : (root.querySelector("svg") ?? root);
  const groups = taken.get(svg) ?? grouped(root);

  taken.set(svg, groups);

  const made = [...groups].map(([name, group]) => [name, control(name, group)] as const);
  const clocks = new Map(made.map(([name, { clock }]) => [name, clock]));

  const mounted: Omit<Mounted, "unmount"> = {
    states: statesOf(svg),
    clocks,
    clock: (name) => {
      const found = clocks.get(name);

      if (!found)
        throw new Error(
          `This SVG has no clock "${name}"; it has ${clocks.size ? [...clocks.keys()].map((one) => `"${one}"`).join(", ") : "none"}`,
        );

      return found;
    },
    hit: (name) => {
      const found = [...root.querySelectorAll(`[data-hit="${CSS.escape(name)}"]`)];

      if (!found.length) {
        const names = new Set(
          [...root.querySelectorAll("[data-hit]")].map((one) => one.getAttribute("data-hit")),
        );

        throw new Error(
          `This SVG has no hit "${name}"; it has ${names.size ? [...names].map((one) => `"${one}"`).join(", ") : "none"}`,
        );
      }

      return found;
    },
    slot: (name) => slotOf(root, name),
  };

  const stopShaders = runShaders(root, mounted);

  return {
    ...mounted,
    unmount: () => {
      stopShaders();
      made.forEach(([, { release }]) => release());
    },
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
