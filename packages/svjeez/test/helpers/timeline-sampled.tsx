import { render, type Motion } from "svjeez";

export interface Key {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

export const PERIOD = 12;

export const scene = (animation: Motion<"x" | "y" | "opacity">, duration: number) =>
  render(
    { width: 100, height: 100, duration, title: "Test" },
    <rect width={10} height={10} animation={animation} />,
  );

export const lane = (svg: string, property: string): string[] =>
  [...svg.matchAll(/@keyframes [\w-]+\{(.*)\}$/gm)].flatMap((match) =>
    match[1]!.includes(`${property}:`) ? [match[1]!] : [],
  );

export const translateKeys = (svg: string, duration: number): Key[] => {
  const [body] = lane(svg, "translate");

  return [...body!.matchAll(/([\d.%,]+)\{translate:(-?[\d.]+)px (-?[\d.]+)px\}/g)]
    .flatMap(([, percents, x, y]) =>
      percents!.split(",").map((percent) => ({
        at: (parseFloat(percent) / 100) * duration,
        x: Number(x),
        y: Number(y),
      })),
    )
    .sort((a, b) => a.at - b.at);
};

export const replay = (keys: readonly Key[], t: number): Key => {
  const j = Math.max(
    1,
    keys.findIndex((key) => key.at >= t),
  );

  const [a, b] = [keys[j - 1]!, keys[j]!];
  const u = (t - a.at) / (b.at - a.at);

  return { at: t, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
};

export const circle = (t: number) => ({
  x: 100 * Math.cos((2 * Math.PI * t) / PERIOD),
  y: 100 * Math.sin((2 * Math.PI * t) / PERIOD),
});
