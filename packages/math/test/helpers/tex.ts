import { render } from "svjeez";
import { tex } from "../../src/index";

export const svg = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 400, height: 200, duration: 4, title: "math" }, children);

export const f = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 40 });
