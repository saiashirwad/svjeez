import assert from "node:assert/strict";
import { GlobeShape, globe, project } from "@svjeez/geo";
import { Group, Shape, scene, span } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { svg as backend } from "svjeez/tools";

const land = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "patch",
      properties: { name: "Patch" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-20, -10],
            [20, -10],
            [20, 30],
            [-20, 30],
            [-20, -10],
          ],
        ],
      },
    },
  ],
};

const map = project(land, { size: [200, 100] });
const earth = globe(land, { radius: 40, facing: [0, 10], turn: { by: -360, over: span(0, 4) } });

const svg = backend.emit(
  scene({ size: [300, 120], duration: 4, title: "Geo" }, () =>
    jsx(Group, {
      children: [
        jsx(Shape, { geometry: map.region("Patch").geometry, fill: "#336699" }),
        jsx(Group, {
          at: [250, 60],
          children: [
            jsx(Shape, { geometry: earth.sphere, fill: "#102030" }),
            jsx(GlobeShape, { of: earth.land, fill: "#88AACC" }),
          ],
        }),
      ],
    }),
  ),
);

assert.match(svg, /<clipPath/);

assert.match(svg, /attributeName="d"/);

console.log(`projected ${map.regions.length} region and turned a globe in ${svg.length} bytes`);
