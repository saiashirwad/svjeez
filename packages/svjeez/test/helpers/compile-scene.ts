import { render, type Child } from "svjeez";

export const scene = (content: Child, duration = 10) =>
  render({ width: 100, height: 100, duration, title: "Test" }, content);

export const body = (svg: string) => svg.slice(svg.indexOf("</style>"));

export const keyframes = (svg: string) =>
  [...svg.matchAll(/@keyframes ([\w-]+)\{(.*)\}$/gm)].map((match) => match[2]!);
