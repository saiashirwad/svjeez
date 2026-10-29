// The colors of the gummies, and the sky and light an hour gives the scene.
import type { Hex } from "svjeez";

export const COLORS = [
  "#FF5FA8",
  "#FFB23E",
  "#3EE6D6",
  "#7C6CFF",
  "#9BE15D",
] as const satisfies readonly Hex[];

const STOPS: readonly (readonly [number, Hex])[] = [
  [0, "#14163A"],
  [5, "#1E2150"],
  [6.5, "#FFB38A"],
  [9, "#8CCBFF"],
  [16, "#8CCBFF"],
  [18.5, "#FF7E5F"],
  [20, "#2B2F66"],
  [24, "#14163A"],
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

export const skyAt = (hour: number): Hex => {
  const h = ((hour % 24) + 24) % 24;
  const i = STOPS.findIndex(([at]) => at > h);
  const [a, ca] = STOPS[i - 1]!;
  const [b, cb] = STOPS[i]!;
  const p = (h - a) / (b - a);
  const [x, y] = [hex(ca), hex(cb)];

  return `#${x
    .map((v, k) =>
      Math.round(v + (y[k]! - v) * p)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
};

export const isDay = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;

  return h >= 6 && h < 18;
};

/** Where the sun (by day) or moon (by night) sits in the 640×360 scene. */
export const lightAt = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;
  const day = isDay(h);
  const a = (Math.PI * (((day ? h - 6 : h - 18) + 24) % 24)) / 12;

  return {
    x: Math.round(320 - 250 * Math.cos(a)),
    y: Math.round(300 - 220 * Math.sin(a)),
    r: day ? 26 : 18,
    fill: day ? ("#FFD60A" as const) : ("#F4F1E6" as const),
  };
};
