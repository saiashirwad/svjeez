import type { Seconds } from "./motion";

/**
 * Runs in the page: pause every CSS and SMIL animation in `root`, the whole document by default, at `time` playback
 * seconds. Pass an inline `<svg>` to scrub that picture alone.
 */
export const seek = (time: Seconds, root: Document | Element = document): void => {
  const animations =
    root instanceof Element ? root.getAnimations({ subtree: true }) : root.getAnimations();

  for (const animation of animations) {
    animation.pause();
    animation.currentTime = time * 1000;
  }

  const svgs = [...root.querySelectorAll("svg"), ...(root instanceof SVGSVGElement ? [root] : [])];

  for (const svg of svgs) {
    svg.pauseAnimations();
    svg.setCurrentTime(time);
  }
};

/** Runs in the page: one loop of the scene in `root`, the whole document by default, the least common multiple of every CSS and SMIL period, in seconds. */
export const loopLength = (root: Document | Element = document): Seconds => {
  const animations =
    root instanceof Element ? root.getAnimations({ subtree: true }) : root.getAnimations();

  const css = animations.map((animation) => Number(animation.effect?.getTiming().duration) || 0);

  const smil = [...root.querySelectorAll("animate, animateTransform, animateMotion, set")].map(
    (element) => parseFloat(element.getAttribute("dur") ?? "") * 1000 || 0,
  );

  // Emitted durations are rounded to a millisecond, so a period such as 12 / 7 = 1714.2857ms
  // arrives as 1714ms. Each of the `loop / period` cycles then drifts by up to half a
  // millisecond, and `loop` fits the period when the whole drift stays inside that budget.
  // The helper lives in here because the function is serialized into the page.
  const fits = (loop: number, period: number): boolean => {
    const cycles = Math.round(loop / period);

    return cycles > 0 && Math.abs(loop - cycles * period) < Math.max(1, cycles * 0.5 + 0.01);
  };

  const periods = [...css, ...smil].filter((ms) => ms > 0);
  const longest = Math.max(0, ...periods);

  for (let k = 1; k <= 1000; k++) {
    const loop = longest * k;

    if (periods.every((ms) => fits(loop, ms))) return loop / 1000;
  }

  return longest / 1000;
};
