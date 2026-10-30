import { render } from "svjeez";
import { chart } from "../../src/index.ts";

export const scene = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 500, height: 300, duration: 6, title: "chart" }, children);

export const quarters = ["Q1", "Q2", "Q3", "Q4"];

export const band = () =>
  chart({
    width: 400,
    height: 200,
    at: { x: 50, y: 20 },
    x: { kind: "band", domain: quarters },
    data: [
      ["Q1", 12],
      ["Q2", 48],
      ["Q3", 31],
      ["Q4", 87],
    ],
  });

export const lineChart = () =>
  chart({
    width: 400,
    height: 200,
    x: { kind: "linear", domain: [0, 10] },
    y: { domain: [0, 100] },
  });

export const points = [
  [0, 10],
  [5, 60],
  [10, 40],
] as const;
