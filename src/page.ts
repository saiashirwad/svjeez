import type { Seconds } from "./motion";

/** Runs in the page: pause every CSS and SMIL animation at `time` playback seconds. */
export const seek = (time: Seconds): void => {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = time * 1000;
  }
  for (const svg of document.querySelectorAll("svg")) {
    svg.pauseAnimations();
    svg.setCurrentTime(time);
  }
};

/** Runs in the page: one loop of the scene, the least common multiple of every CSS and SMIL period, in seconds. */
export const loopLength = (): Seconds => {
  const css = document.getAnimations().map((animation) => Number(animation.effect?.getTiming().duration) || 0);
  const smil = [...document.querySelectorAll("animate, animateTransform, animateMotion, set")].map((element) => parseFloat(element.getAttribute("dur") ?? "") * 1000 || 0);
  const periods = [...css, ...smil].filter((ms) => ms > 0);
  const longest = Math.max(0, ...periods);
  for (let k = 1; k <= 1000; k++) {
    const loop = longest * k;
    if (periods.every((ms) => Math.abs(loop / ms - Math.round(loop / ms)) * ms < 1)) return loop / 1000;
  }
  return longest / 1000;
};
