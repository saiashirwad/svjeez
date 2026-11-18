import { globe, project, type GeoData, type GeoMap, type Globe, type Turning } from "@svjeez/geo";
import { span, type Geometry, type Vec } from "svjeez";

const land: GeoData = { type: "FeatureCollection", features: [] };

export const map: GeoMap = project(land, { size: [200, 100] });

export const point: Vec = map.point([0, 0]);

export const outline: Geometry = map.land;

export const earth: Globe = globe(land, {
  radius: 40,
  facing: [0, 10],
  turn: { by: -360, over: span(0, 4) },
});

export const turning: Turning = earth.land;
