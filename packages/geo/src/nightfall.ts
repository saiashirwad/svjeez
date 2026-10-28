import { sampledPath, type PathData, type Seconds } from "svjeez";
import type { Turning } from "./globe.ts";
import type { GeoMap } from "./index.ts";
import { RAD } from "./sphere.ts";
import { sun } from "./sun.ts";

export interface NightfallOptions {
  /** Seconds the motion runs. */
  readonly duration: Seconds;
  /** Px. Default 0.5. */
  readonly tolerance?: number;
  /** Columns across the map. Default 73, one every 5 degrees. */
  readonly columns?: number;
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/**
 * The night side of a flat map as one moving path, for a day or a year passing. `date` gives the moment at each
 * second of the motion. The shape is a column of darkness per longitude, so its point count never changes, even at an
 * equinox, when the night covers both poles at once. Clip it to `map.sphere`.
 */
export function nightfall(
  map: GeoMap,
  date: (t: Seconds) => Date,
  options: NightfallOptions,
): Turning {
  const { duration, tolerance = 0.5, columns = 73 } = options;
  const middle = -map.projection.rotate()[0];
  const { frame } = map;

  const lons = Array.from(
    { length: columns },
    (_, i) => middle - 180 + 1e-6 + ((360 - 2e-6) * i) / (columns - 1),
  );

  const place = (lon: number, lat: number): [number, number] => {
    const [x, y] = map.projection([lon, Math.max(-89.9, Math.min(89.9, lat))]) ?? [0, 0];

    return [
      Math.max(frame.x - frame.w, Math.min(frame.x + 2 * frame.w, x)),
      Math.max(frame.y - frame.h, Math.min(frame.y + 2 * frame.h, y)),
    ];
  };

  const sample = (t: Seconds) => {
    const [sunLon, sunLat] = sun(date(t));
    const tilt = Math.tan((Math.abs(sunLat) < 1e-6 ? 1e-6 : sunLat) * RAD);

    const spans = lons.map((lon): [number, number] => {
      const edge = Math.atan(-Math.cos((lon - sunLon) * RAD) / tilt) / RAD;

      return sunLat >= 0 ? [-90, edge] : [edge, 90];
    });

    const top = lons.map((lon, i) => place(lon, spans[i]![1]));
    const bottom = lons.map((lon, i) => place(lon, spans[i]![0])).reverse();

    // SAFETY: the path starts with M.
    return `M${[...top, ...bottom].map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(" ")}Z` as PathData;
  };

  return { d: sample(0), animation: sampledPath(sample, { duration, tolerance }) };
}
