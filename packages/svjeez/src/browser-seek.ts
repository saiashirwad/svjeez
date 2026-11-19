import type { Seconds } from "./model/time";

export const seek = (
  time: Seconds,
  root: Document | Element = document,
  clock?: SVGSVGElement,
): void => {
  const rateAt = (svg: Element | null | undefined): number =>
    parseFloat(svg?.getAttribute("data-playback-rate") ?? "") || 1;

  const clockTime = clock ? time / rateAt(clock) : undefined;

  const animations =
    root instanceof Element ? root.getAnimations({ subtree: true }) : root.getAnimations();

  for (const animation of animations) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    animation.pause();
    animation.currentTime = (clockTime ?? time / rateAt(target?.closest("svg"))) * 1000;
  }

  const svgs = clock
    ? [clock]
    : [...root.querySelectorAll("svg"), ...(root instanceof SVGSVGElement ? [root] : [])];

  for (const svg of svgs) {
    svg.pauseAnimations();
    svg.setCurrentTime(clockTime ?? time / rateAt(svg));
  }
};
