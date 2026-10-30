import { render, type SvgNode } from "svjeez";
import { plane } from "../../src/index";

export const svg = (css: Parameters<typeof render>[0]["css"], ...children: SvgNode[]) =>
  render({ width: 400, height: 300, duration: 8, title: "plane", css }, children);

export const base = plane({ origin: { x: 200, y: 150 }, unit: 20, extent: 4 });

export const shear = base.apply(
  [
    [1, 1],
    [0, 1],
  ],
  { at: 1, over: 2 },
);

export const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
