import { render } from "svjeez";

export const svg = (node: Parameters<typeof render>[1]) =>
  render({ width: 400, height: 300, duration: 12, title: "construct" }, node);
