import { geoCircle } from "d3-geo";
import type { Polygon } from "geojson";
import { SceneError } from "svjeez/tools";
import type { LonLat } from "./data.ts";

const RAD = Math.PI / 180;

const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

export function sun(date: Date): LonLat {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()))
    throw new SceneError(
      `sun() needs a valid Date, got ${String(date)}.`,
      "Pass a Date such as new Date(Date.UTC(2026, 5, 21)).",
    );

  const n = date.getTime() / 86_400_000 - 10_957.5;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const ecliptic = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const tilt = (23.439 - 0.0000004 * n) * RAD;
  const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic));
  const ascension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic));
  const sidereal = 280.46061837 + 360.98564736629 * n;

  return [wrap(ascension / RAD - sidereal), declination / RAD];
}

export function night(date: Date): Polygon {
  const [lon, lat] = sun(date);

  return geoCircle()
    .center([wrap(lon + 180), -lat])
    .radius(90)();
}
