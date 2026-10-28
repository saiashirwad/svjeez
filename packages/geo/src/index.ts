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
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Polygon } from "geojson";
import { feature, merge, mesh } from "topojson-client";
import type {
  GeometryObject,
  MultiPolygon,
  Polygon as TopoPolygon,
  Topology,
} from "topojson-specification";
import { rect, type Point, type Rect } from "svjeez";
import { Writer } from "./writer.ts";

export type LonLat = readonly [lon: number, lat: number];

export type GeoData = Topology | FeatureCollection | Feature;

export interface ProjectOptions {
  /** Where the map sits in the scene, in px. */
  readonly frame: Rect;
  /** Any d3-geo projection. Default `geoNaturalEarth1()`. It is fitted to `frame` unless `fit` is false. */
  readonly projection?: GeoProjection;
  /** What to fit inside `frame`: the regions (default), `"sphere"` for the whole globe, any GeoJSON, or false to leave the projection as it is. */
  readonly fit?: "regions" | "sphere" | GeoPermissibleObjects | false;
  /** The TopoJSON object to read. Default the topology's first object. */
  readonly object?: string;
  /** Keep only the features this returns true for, before fitting. */
  readonly filter?: (feature: Feature) => boolean;
  /** Px. A point closer than this to the last point kept is dropped. Default 0.5. */
  readonly tolerance?: number;
}

export interface Region {
  /** The feature's `id`, else its `properties.name`, else its index. */
  readonly id: string;
  readonly properties: GeoJsonProperties;
  readonly feature: Feature;
  /** Path data for the whole region. */
  readonly d: string;
  /** The center of the region's largest piece, so France's sits in France rather than out at sea toward French Guiana. */
  readonly centroid: Point;
  /** The bounds of the region's largest piece. `map.bounds(region.feature)` covers every piece. */
  readonly bounds: Rect;
}

export interface Dot {
  readonly at: LonLat;
  /** The id of the feature the dot sits in, as `map.region()` takes it. */
  readonly id: string;
  readonly properties: GeoJsonProperties;
  /** Where the dot lands in the scene, or undefined when the projection clips it, as on the far side of a globe. */
  readonly point: Point | undefined;
}

export interface GeoMap {
  readonly frame: Rect;
  readonly projection: GeoProjection;
  readonly regions: readonly Region[];
  /** Every region filled as one path. From TopoJSON the shared borders are gone, leaving the land. */
  readonly land: string;
  /** Every region's outline as one path, each shared border drawn once when the data is TopoJSON. */
  readonly lines: string;
  /** The outline of the globe. */
  readonly sphere: string;
  /** The region whose id or `properties.name` is `key`. */
  region(key: string | number): Region;
  /** Path data for any GeoJSON, simplified like the regions. */
  path(object: GeoPermissibleObjects): string;
  /** Lines of longitude and latitude every `step` degrees. Default 10. */
  graticule(step?: number): string;
  /** Where a place lands in the scene. */
  point(at: LonLat): Point;
  /**
   * Evenly spaced places on land, for a dot map: rows `step` degrees of latitude apart, and dots about `step` degrees
   * of arc apart along each row, so they stay even toward the poles. Dots on the far side of a globe are kept, so a
   * scene can turn it. Default step 2.
   */
  dots(step?: number): Dot[];
  /** The great-circle arc from `from` to `to`, for `travel()` and `flow()`. `steps` defaults to one per degree. */
  route(from: LonLat, to: LonLat, options?: { readonly steps?: number }): Point[];
  /**
   * The path through `points` along great circles, as a cable, a shipping lane or a flight with stops would run. Where it
   * crosses the edge of the map it is cut, so it comes back as one list of points per piece.
   */
  line(points: readonly LonLat[]): Point[][];
  /** A camera target around a region, a list of regions and places, or any GeoJSON, grown by `pad` px on every side. */
  bounds(target: Region | readonly (Region | LonLat)[] | GeoPermissibleObjects, pad?: number): Rect;
}

const features = (data: GeoData, object: string | undefined): Feature[] => {
  switch (data.type) {
    case "Topology": {
      const read = feature(data, topologyObject(data, object));

      return "features" in read ? read.features : [read];
    }

    case "FeatureCollection":
      return data.features;
    case "Feature":
      return [data];
  }
};

const topologyObject = (
  topology: Topology,
  name: string | undefined,
): Topology["objects"][string] => {
  const names = Object.keys(topology.objects);
  const key = name ?? names[0];
  const object = key === undefined ? undefined : topology.objects[key];

  if (!object)
    throw new Error(
      `project() found no TopoJSON object named ${key}. The topology has ${names.join(", ") || "no objects"}.`,
    );

  return object;
};

const idOf = (f: Feature, index: number) => String(f.id ?? f.properties?.name ?? index);

/** The largest polygon of a feature, by area on the sphere. */
const largest = (f: Feature, area: (o: GeoPermissibleObjects) => number): Feature => {
  if (f.geometry?.type !== "MultiPolygon") return f;

  const pieces = f.geometry.coordinates.map((coordinates): Feature<Polygon> => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates },
  }));

  return pieces.reduce((a, b) => (area(b) > area(a) ? b : a));
};

/** Whether a place sits in a `geoBounds` box, which runs from x0 east to x1 and wraps when it crosses the antimeridian. */
const within = ([[x0, y0], [x1, y1]]: [[number, number], [number, number]], [lon, lat]: LonLat) =>
  lat >= y0 && lat <= y1 && (x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1);

/** The great circle from `from` to `to` as `steps` segments, one per degree by default. */
const arc = (from: LonLat, to: LonLat, steps?: number): [number, number][] => {
  const count = steps ?? Math.max(2, Math.ceil((geoDistance([...from], [...to]) * 180) / Math.PI));
  const along = geoInterpolate([...from], [...to]);

  return Array.from({ length: count + 1 }, (_, i) => along(i / count));
};

/** Kilometres along the great circles through `points`, on a sphere of the Earth's mean radius. */
export function distance(points: readonly LonLat[]): number {
  return points
    .slice(1)
    .reduce((km, to, i) => km + geoDistance([...points[i]!], [...to]) * 6371, 0);
}

const toRect = ([[x0, y0], [x1, y1]]: [[number, number], [number, number]]) =>
  rect(x0, y0, x1 - x0, y1 - y0);

/** Projects GeoJSON or TopoJSON into a scene's frame, as simplified path data, points, routes and camera targets. */
export function project(data: GeoData, options: ProjectOptions): GeoMap {
  const { frame, projection = geoNaturalEarth1(), fit = "regions", tolerance = 0.5 } = options;
  const all = features(data, options.object).map((f, index) => ({ f, index, id: idOf(f, index) }));
  const kept = all.filter(({ f }) => options.filter?.(f) ?? true);

  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: kept.map(({ f }) => f),
  };

  if (fit !== false)
    projection.fitExtent(
      [
        [frame.x, frame.y],
        [frame.x + frame.w, frame.y + frame.h],
      ],
      fit === "regions" ? collection : fit === "sphere" ? { type: "Sphere" } : fit,
    );

  const measure = geoPath(projection);

  const path = (object: GeoPermissibleObjects) => {
    const writer = new Writer(tolerance);
    geoPath(projection, writer)(object);

    return writer.toString();
  };

  /** Streams `object` through the projection and collects each line it comes out as, so clipping and the antimeridian cut are honored. */
  const lines = (object: GeoPermissibleObjects): Point[][] => {
    const out: Point[][] = [];
    let open = false;

    const sink: GeoStream = {
      point: (x, y) => {
        const p = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };

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

  const regions = kept.flatMap(({ f, id }): Region[] => {
    const d = path(f);

    if (!d) return [];
    const main = largest(f, measure.area);
    const [x, y] = measure.centroid(main);

    return [
      {
        id,
        properties: f.properties,
        feature: f,
        d,
        centroid: { x, y },
        bounds: toRect(measure.bounds(main)),
      },
    ];
  });

  // topojson-client turns a GeometryCollection into features in order, so geometry i is feature i.
  const source = data.type === "Topology" ? topologyObject(data, options.object) : undefined;

  const topology =
    data.type === "Topology" && source?.type === "GeometryCollection"
      ? {
          data,
          // SAFETY: topojson-client's merge and mesh read only each geometry's type and arcs, never its properties.
          geometries: kept.map(({ index }) => source.geometries[index]!) as GeometryObject[],
        }
      : undefined;

  const locate = (at: LonLat): Point | undefined =>
    lines({ type: "Point", coordinates: [...at] }).flat()[0];

  const point = (at: LonLat): Point => {
    const found = locate(at);

    if (!found)
      throw new Error(
        `point([${at.join(", ")}]) falls outside the projection, on the far side of the globe or past its clip.`,
      );

    return found;
  };

  return {
    frame,
    projection,
    regions,
    land: topology
      ? path(
          merge(
            topology.data,
            topology.geometries.filter(
              (g): g is TopoPolygon | MultiPolygon =>
                g.type === "Polygon" || g.type === "MultiPolygon",
            ),
          ),
        )
      : path(collection),
    lines: topology
      ? path(mesh(topology.data, { type: "GeometryCollection", geometries: topology.geometries }))
      : path(collection),
    sphere: path({ type: "Sphere" }),
    region(key) {
      const found = regions.find((r) => r.id === String(key) || r.properties?.name === key);

      if (!found)
        throw new Error(
          `project() has no region ${JSON.stringify(key)}. Regions are found by id or properties.name, as in ${regions
            .slice(0, 3)
            .map((r) => JSON.stringify(r.id))
            .join(", ")}.`,
        );

      return found;
    },
    path,
    graticule: (step = 10) =>
      path(
        geoGraticule()
          .step([step, step])
          .extentMinor([
            [-180, -90 + 1e-6],
            [180, 90 - 1e-6],
          ])(),
      ),
    point,
    dots(step = 2) {
      const boxes = kept.map(({ f, id }) => ({ f, id, box: geoBounds(f) }));
      const rows = Math.round(180 / step);

      return Array.from({ length: rows }, (_, row) => -90 + ((row + 0.5) * 180) / rows).flatMap(
        (lat) => {
          const count = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));

          return Array.from({ length: count }, (_, i): Dot[] => {
            const at: LonLat = [-180 + ((i + 0.5) * 360) / count, lat];

            const found = boxes.find(({ f, box }) => within(box, at) && geoContains(f, [...at]));

            return found
              ? [{ at, id: found.id, properties: found.f.properties, point: locate(at) }]
              : [];
          }).flat();
        },
      );
    },
    route(from, to, { steps } = {}) {
      const cut = lines({ type: "LineString", coordinates: arc(from, to, steps) });

      if (cut.length !== 1)
        throw new Error(
          `route() from [${from.join(", ")}] to [${to.join(", ")}] crosses the edge of the map. Rotate the projection so both ends sit on one side, as in geoNaturalEarth1().rotate([-150, 0]), or use line(), which cuts it into pieces.`,
        );

      return cut[0]!;
    },
    line(points) {
      if (points.length < 2) throw new Error("line() needs at least two places.");

      return lines({
        type: "LineString",
        coordinates: points.slice(1).flatMap((to, i) => arc(points[i]!, to).slice(i ? 1 : 0)),
      }).filter((piece) => piece.length > 1);
    },
    bounds(target, pad = 0) {
      const box = (() => {
        if ("feature" in target) return target.bounds;

        if ("type" in target) return toRect(measure.bounds(target));

        if (target.length === 0) throw new Error("bounds() needs at least one region or place.");

        return target
          .map((item) => {
            if ("bounds" in item) return item.bounds;
            const { x, y } = point(item);

            return rect(x, y, 0, 0);
          })
          .reduce((a, b) => a.union(b));
      })();

      return pad ? box.pad(pad) : box;
    },
  };
}

export { night, sun } from "./sun.ts";

export type { Feature, FeatureCollection, Geometry, GeoJsonProperties, GeoProjection, Topology };
