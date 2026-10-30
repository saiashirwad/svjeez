import { render, type Child } from "svjeez";
import { axes } from "svjeez/extras";

export const graph = () =>
  axes({ x: [-3, 3], y: [-1, 9], width: 400, height: 260, at: { x: 300, y: 60 } });

export const svgOf = (...nodes: Child[]): string =>
  render({ width: 800, height: 400, duration: 6, title: "Calculus", reducedMotion: false }, nodes);

export const smilValues = (svg: string): string[] =>
  [...svg.matchAll(/attributeName="d" values="([^"]*)"/g)].flatMap(([, v]) => v!.split(";"));

export const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

export const square = (x: number) => x * x;
