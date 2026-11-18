import type { Anim, Key } from "./tree.ts";

declare global {
  var __svjeezMuted: (() => void)[] | undefined;
}

export function collect(selector: string): number {
  const top = document.querySelector(selector);
  const map = new WeakMap<Element, Anim[]>();
  const muted: (() => void)[] = [];

  globalThis.__svjeezAnims = map;
  globalThis.__svjeezMuted = muted;

  if (!top) return 0;

  let count = 0;

  for (const a of document.getAnimations()) {
    const effect = a.effect;

    if (!(effect instanceof KeyframeEffect) || a.timeline !== document.timeline) continue;

    if (a.playState === "finished" || a.playState === "idle") continue;

    const target = effect.target;

    if (!target || effect.pseudoElement || !top.contains(target)) continue;

    const timing = effect.getComputedTiming();
    const raw = effect.getKeyframes();
    const transition = a instanceof CSSTransition;

    const keys: Key[] = raw.map((frame) => {
      const props: Record<string, string> = {};

      for (const [name, value] of Object.entries(frame))
        if (!["offset", "computedOffset", "easing", "composite"].includes(name))
          props[name] = String(value);

      return { offset: frame.computedOffset ?? 0, easing: frame.easing, props };
    });

    const [ox = 0, oy = 0] = getComputedStyle(target).transformOrigin.split(" ").map(parseFloat);
    const list = map.get(target) ?? [];

    list.push({
      type: transition ? "transition" : a instanceof CSSAnimation ? "animation" : "script",
      name: transition
        ? a.transitionProperty
        : a instanceof CSSAnimation
          ? a.animationName
          : a.id || "animate",
      keys,
      origin: [ox, oy],
      delay: (Number(timing.delay) || 0) / 1000,
      duration: Number(timing.duration) / 1000,
      iterations: timing.iterations === Infinity ? null : Number(timing.iterations),
      direction: timing.direction ?? "normal",
      fill: timing.fill ?? "none",
      easing: timing.easing ?? "linear",
      elapsed: Number(a.currentTime ?? 0) / 1000,
    });
    map.set(target, list);
    count++;

    if (!transition) {
      effect.setKeyframes([]);
      muted.push(() => effect.setKeyframes(raw));
    }
  }

  return count;
}

export function release(): void {
  for (const undo of globalThis.__svjeezMuted ?? []) undo();

  globalThis.__svjeezMuted = [];
}
