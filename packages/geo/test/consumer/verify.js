import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { project } from "@svjeez/geo";
import { rect, render, el } from "svjeez";
import { Camera } from "svjeez/extras";

const world = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map = project(world, { frame: rect(0, 0, 640, 360) });

const target = map.bounds(
  [
    [-74, 40.7],
    [-0.13, 51.5],
  ],
  20,
);

const svg = render(
  { width: 640, height: 360, duration: 2, title: "World" },
  Camera({
    frame: rect(0, 0, 640, 360),
    stops: [{ during: { at: 1, over: 1 }, target }],
    children: [el.path({ d: map.land }), el.path({ d: map.lines, fill: "none", stroke: "#000" })],
  }),
);

assert.equal(map.regions.length, 177);

assert.match(svg, /^<svg[\s\S]*@keyframes[\s\S]*<path d="M/);

console.log(`rendered ${map.regions.length} countries into ${(svg.length / 1024).toFixed(0)} KB`);
