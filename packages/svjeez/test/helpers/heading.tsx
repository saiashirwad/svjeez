import { render, type SvgNode } from "svjeez";

export const scene = (...children: SvgNode[]) =>
  render({ width: 400, height: 300, duration: 10, title: "Test" }, <>{children}</>);
