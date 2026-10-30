import { el, render, type Motion } from "svjeez";

export type Held = { opacity?: number; x?: number; y?: number };

/** What the rendered keyframes hold at playback second `t` of a 100s scene: opacity, and x and y from the translate lane. */
export const at = (track: Motion<"opacity" | "x" | "y" | "scale">, t: number): Held => {
  const svg = render(
    { width: 10, height: 10, duration: 100, title: "probe" },
    el.rect({ width: 1, height: 1, animation: track }),
  );

  const held: Held = {};

  for (const [, body] of svg.matchAll(/@keyframes [\w-]+\{((?:[^{}]*\{[^}]*\})*)\}/g)) {
    let stop: string | undefined;
    let latest = -1;

    for (const [, percents, declaration] of body!.matchAll(/([\d.%,]+)\{([^}]*)\}/g)) {
      for (const percent of percents!.split(",").map(parseFloat)) {
        if (percent <= t && percent >= latest) [stop, latest] = [declaration, percent];
      }
    }

    const translate = /translate:(-?[\d.]+)px (-?[\d.]+)px/.exec(stop ?? "");

    if (translate) Object.assign(held, { x: Number(translate[1]), y: Number(translate[2]) });
    const opacity = /opacity:([\d.]+)/.exec(stop ?? "");

    if (opacity) held.opacity = Number(opacity[1]);
    const visibility = /visibility:(hidden|visible)/.exec(stop ?? "");

    if (visibility) held.opacity = visibility[1] === "visible" ? 1 : 0;
  }

  return held;
};
