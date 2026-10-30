import { render, type Child } from "svjeez";

export const base = {
  x: [-3, 3],
  y: [-1, 9],
  width: 400,
  height: 260,
  at: { x: 300, y: 60 },
} as const;

export const svgOf = (...nodes: Child[]): string =>
  render({ width: 800, height: 400, duration: 4, title: "Axes" }, nodes);
