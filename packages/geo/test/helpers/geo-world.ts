import { createRequire } from "node:module";
import { rect, render, type SvgNode } from "svjeez";
import { project, type LonLat, type Topology } from "../../src/index.ts";

export const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
export const frame = rect(20, 10, 960, 500);
export const map = project(world, { frame });

export const NEW_YORK: LonLat = [-74, 40.7];
export const LONDON: LonLat = [-0.13, 51.5];
export const TOKYO: LonLat = [139.7, 35.7];
export const SAN_FRANCISCO: LonLat = [-122.4, 37.8];

export const scene = (node: SvgNode) =>
  render({ width: 1000, height: 520, duration: 10, title: "Test" }, node);
