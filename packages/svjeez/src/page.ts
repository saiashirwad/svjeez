import type { Seconds } from "./model/time";

export { restyle, type RestyleOptions } from "./restyle";

export const seek = (time: Seconds, root: Document | Element = document): void => {
  const rateAt = (element: Element | null | undefined): number =>
    parseFloat(element?.closest("svg")?.getAttribute("data-playback-rate") ?? "") || 1;

  const animations =
    root instanceof Element ? root.getAnimations({ subtree: true }) : root.getAnimations();

  for (const animation of animations) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    animation.pause();
    animation.currentTime = (time / rateAt(target)) * 1000;
  }

  const svgs = [...root.querySelectorAll("svg"), ...(root instanceof SVGSVGElement ? [root] : [])];

  for (const svg of svgs) {
    svg.pauseAnimations();
    svg.setCurrentTime(time / rateAt(svg));
  }
};

export const loopLength = (root: Document | Element = document): Seconds => {
  const svg =
    root instanceof Element
      ? (root.closest("svg") ?? root.querySelector("svg"))
      : root.querySelector("svg");

  const rate = parseFloat(svg?.getAttribute("data-playback-rate") ?? "") || 1;

  const animations =
    root instanceof Element ? root.getAnimations({ subtree: true }) : root.getAnimations();

  const css = animations.map((animation) => Number(animation.effect?.getTiming().duration) || 0);

  const smil = [...root.querySelectorAll("animate, animateTransform, animateMotion, set")].map(
    (element) =>
      parseFloat(element.getAttribute("data-loop") ?? element.getAttribute("dur") ?? "") * 1000 ||
      0,
  );

  const fits = (loop: number, period: number): boolean => {
    const cycles = Math.round(loop / period);

    return cycles > 0 && Math.abs(loop - cycles * period) < Math.max(1, cycles * 0.5 + 0.01);
  };

  const periods = [...css, ...smil].filter((ms) => ms > 0);
  const longest = Math.max(0, ...periods);

  for (let k = 1; k <= 1000; k++) {
    const loop = longest * k;

    if (periods.every((ms) => fits(loop, ms))) return (loop / 1000) * rate;
  }

  return (longest / 1000) * rate;
};
