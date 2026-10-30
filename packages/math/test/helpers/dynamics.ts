import { render } from "svjeez";

export const svg = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 600, height: 400, duration: 10, title: "dynamics" }, children);
