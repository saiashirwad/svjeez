import {
  geoBounds,
  geoContains,
  geoDistance,
  geoGraticule,
  geoInterpolate,
  geoNaturalEarth1,
  geoPath,
  geoStream,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoStream,
} from "d3-geo";
import type { Feature, GeoJsonProperties, Polygon } from "geojson";
import { polyline, type Geometry, type Vec } from "svjeez";
import { SceneError } from "svjeez/tools";
import { finder, lonLat, read, type GeoData, type LonLat, type ReadOptions } from "./data.ts";
import { Outline } from "./outline.ts";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapOptions extends ReadOptions {
  readonly size: Vec;
  readonly projection?: GeoProjection;
  readonly fit?: "regions" | "sphere" | false;
  readonly tolerance?: number;
}

export interface Region {
  readonly id: string;
  readonly name: string | undefined;
  readonly properties: GeoJsonProperties;
  readonly feature: Feature;
  readonly geometry: Geometry;
  readonly center: Vec;
  readonly box: Box;
}

export interface Dot {
  readonly at: LonLat;
  readonly point: Vec;
  readonly region: Region;
}

export interface GeoMap {
  readonly size: Vec;
  readonly projection: GeoProjection;
  readonly land: Geometry;
  readonly borders: Geometry;
  readonly sphere: Geometry;
  readonly regions: readonly Region[];
  region(key: string | number): Region;
  shape(object: GeoPermissibleObjects): Geometry;
  point(at: LonLat): Vec;
  route(from: LonLat, to: LonLat): Geometry;
  graticule(step?: number): Geometry;
  dots(step?: number): readonly Dot[];
}

const largest = (f: Feature, area: (o: GeoPermissibleObjects) => number): Feature => {
  if (f.geometry?.type !== "MultiPolygon") return f;

  const pieces = f.geometry.coordinates.map((coordinates): Feature<Polygon> => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates },
  }));

  return pieces.reduce((a, b) => (area(b) > area(a) ? b : a));
};

const within = ([[x0, y0], [x1, y1]]: [[number, number], [number, number]], [lon, lat]: LonLat) =>
  lat >= y0 && lat <= y1 && (x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1);

export const arcPoints = (from: LonLat, to: LonLat): [number, number][] => {
  const count = Math.max(2, Math.ceil((geoDistance([...from], [...to]) * 180) / Math.PI));
  const along = geoInterpolate([...from], [...to]);

  return Array.from({ length: count + 1 }, (_, i) => along(i / count));
};

const positive = (value: number, what: string, fix: string): number => {
  if (!(Number.isFinite(value) && value > 0))
    throw new SceneError(`${what} needs a positive number, got ${value}.`, fix);

  return value;
};

export function project(data: GeoData, options: MapOptions): GeoMap {
  const { size, projection = geoNaturalEarth1(), fit = "regions", tolerance = 0.5 } = options;
  const [width, height] = size ?? [];

  if (!(Number.isFinite(width) && Number.isFinite(height) && width! > 0 && height! > 0))
    throw new SceneError(
      `project() needs a size of [width, height] greater than 0, got ${JSON.stringify(size)}.`,
      "The map is drawn from [0, 0] to its size; place it with a <Group at={…}>.",
    );

  positive(
    tolerance,
    "project()'s tolerance",
    "It is the px a point must move to be kept, such as 0.5.",
  );
  const { places, all, land, borders } = read(data, options, "project()");

  if (fit !== false)
    projection.fitExtent(
      [
        [0, 0],
        [width!, height!],
      ],
      fit === "regions" ? all : { type: "Sphere" },
    );

  const measure = geoPath(projection);

  const outline = (object: GeoPermissibleObjects): Geometry | undefined => {
    const writer = new Outline(tolerance);
    geoPath(projection, writer)(object);

    return writer.geometry();
  };

  const strands = (object: GeoPermissibleObjects): Vec[][] => {
    const out: Vec[][] = [];
    let open = false;

    const sink: GeoStream = {
      point: (x, y) => {
        const p: Vec = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];

        if (open) out.at(-1)!.push(p);
        else out.push([p]);
      },
      lineStart: () => {
        open = true;
        out.push([]);
      },
      lineEnd: () => {
        open = false;
      },
      polygonStart: () => {},
      polygonEnd: () => {},
      sphere: () => {},
    };

    geoStream(object, projection.stream(sink));

    return out.filter((line) => line.length > 0);
  };

  const hidden = new Set<string>();

  const regions = places.flatMap((place): Region[] => {
    const geometry = outline(place.feature);

    if (!geometry) {
      hidden.add(place.id);

      if (place.name !== undefined) hidden.add(place.name);

      return [];
    }

    const main = largest(place.feature, measure.area);
    const [x, y] = measure.centroid(main);
    const [[x0, y0], [x1, y1]] = measure.bounds(main);

    return [
      {
        ...place,
        geometry,
        center: [Math.round(x * 10) / 10, Math.round(y * 10) / 10],
        box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
      },
    ];
  });

  const find = finder(regions, "project()");

  const shape = (object: GeoPermissibleObjects, what: string): Geometry => {
    const geometry = outline(object);

    if (!geometry)
      throw new SceneError(
        `${what} draws nothing: the projection clips all of it away or it is smaller than the tolerance.`,
        "Fit or rotate the projection so it faces the map, or lower tolerance.",
      );

    return geometry;
  };

  const locate = (at: LonLat): Vec | undefined =>
    strands({ type: "Point", coordinates: [...at] }).flat()[0];

  return {
    size: [width!, height!],
    projection,
    get land() {
      return shape(land, "The map's land");
    },
    get borders() {
      if (!borders)
        throw new SceneError(
          "project() reads borders only from TopoJSON, which knows which edges two regions share, and this data is GeoJSON.",
          "Load TopoJSON, such as world-atlas's countries-110m.json, or stroke each region's geometry.",
        );

      return shape(borders, "The map's borders");
    },
    sphere: shape({ type: "Sphere" }, "The map's sphere"),
    regions,
    region(key) {
      if (hidden.has(String(key)))
        throw new SceneError(
          `project() has ${JSON.stringify(key)}, but the projection clips all of it away.`,
          "Fit or rotate the projection so it faces the map.",
        );

      return find(key);
    },
    shape: (object) => shape(object, "shape()"),
    point(at) {
      const found = locate(lonLat(at, "point()"));

      if (!found)
        throw new SceneError(
          `point([${at.join(", ")}]) is not on the map: the projection clips it away.`,
          "Rotate the projection so the place faces the viewer.",
        );

      return found;
    },
    route(from, to) {
      const what = `route([${from.join(", ")}], [${to.join(", ")}])`;

      const cut = strands({
        type: "LineString",
        coordinates: arcPoints(lonLat(from, "route()"), lonLat(to, "route()")),
      });

      if (cut.length === 0)
        throw new SceneError(
          `${what} is not on the map: the projection clips all of it away.`,
          "Rotate the projection so the route faces the viewer.",
        );

      if (cut.length > 1)
        throw new SceneError(
          `${what} crosses the edge of the map, so it would be drawn in ${cut.length} pieces.`,
          "Rotate the projection so both ends sit on one side, as in geoNaturalEarth1().rotate([-150, 0]).",
        );

      return polyline(cut[0]!);
    },
    graticule(step = 10) {
      positive(step, "graticule()", "Give the degrees between lines, such as 15.");

      return shape(
        geoGraticule()
          .step([step, step])
          .extentMinor([
            [-180, -90 + 1e-6],
            [180, 90 - 1e-6],
          ])(),
        "graticule()",
      );
    },
    dots(step = 2) {
      positive(step, "dots()", "Give the degrees between dots, such as 2.");
      const boxes = regions.map((region) => ({ region, box: geoBounds(region.feature) }));
      const rows = Math.round(180 / step);

      return Array.from({ length: rows }, (_, row) => -90 + ((row + 0.5) * 180) / rows).flatMap(
        (lat) => {
          const count = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));

          return Array.from({ length: count }, (_, i): Dot[] => {
            const at: LonLat = [-180 + ((i + 0.5) * 360) / count, lat];

            const found = boxes.find(
              ({ region, box }) => within(box, at) && geoContains(region.feature, [...at]),
            );

            const point = found && locate(at);

            return found && point ? [{ at, point, region: found.region }] : [];
          }).flat();
        },
      );
    },
  };
}
