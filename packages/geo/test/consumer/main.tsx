import { project, type GeoMap, type LonLat, type Topology } from "@svjeez/geo";
import { rect, render } from "svjeez";
import { createRequire } from "node:module";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map: GeoMap = project(world, { frame: rect(0, 0, 640, 360) });
const from: LonLat = [-74, 40.7];

export const svg: string = render({ width: 640, height: 360, duration: 1, title: "World" }, [
  <path d={map.land} />,
  <circle {...map.point(from)} r={3} />,
]);
