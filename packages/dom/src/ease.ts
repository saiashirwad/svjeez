import { ease, type Curve } from "svjeez";

const keyword = (name: string) => {
  switch (name) {
    case "ease":
      return ease.bezier(0.25, 0.1, 0.25, 1);
    case "ease-in":
      return ease.bezier(0.42, 0, 1, 1);
    case "ease-out":
      return ease.bezier(0, 0, 0.58, 1);
    case "ease-in-out":
      return ease.bezier(0.42, 0, 0.58, 1);
    default:
      return undefined;
  }
};

export const cssEase = (css: string): Curve | undefined => {
  const s = css.trim();

  if (s === "linear") return ease.linear;

  const word = keyword(s);

  if (word) return word;

  const bezier = /^cubic-bezier\(([^)]*)\)$/.exec(s);

  if (bezier) {
    const [a, b, c, d] = bezier[1]!.split(",").map(Number);

    return ease.bezier(a!, b!, c!, d!);
  }

  const steps = /^steps\(\s*(\d+)\s*(?:,\s*([\w-]+))?\s*\)$/.exec(s);

  if (steps && (!steps[2] || steps[2] === "end" || steps[2] === "jump-end"))
    return ease.steps(Number(steps[1]));

  if (s === "step-end") return ease.steps(1);

  return undefined;
};
