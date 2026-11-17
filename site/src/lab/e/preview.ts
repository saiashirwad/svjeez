import { DURATION } from "./geometry";

const origin = performance.now();

/** Where the loop is now, in seconds, counted from when the page loaded. */
export const loopTime = () =>
  ((((performance.now() - origin) / 1000) % DURATION) + DURATION) % DURATION;

export const preload = (url: string) =>
  new Promise<string>((resolve) => {
    const next = new Image();
    next.onload = next.onerror = () => resolve(url);
    next.src = url;
  });
