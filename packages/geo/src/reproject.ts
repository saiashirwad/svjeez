import {
  geoArea,
  geoCentroid,
  geoEquirectangular,
  geoStream,
  type GeoProjection,
  type GeoStream,
} from "d3-geo";
import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { feature, merge } from "topojson-client";
import type {
  MultiPolygon as TopoMultiPolygon,
  Polygon as TopoPolygon,
} from "topojson-specification";
import { sampledPath, type PathData, type Rect, type Seconds } from "svjeez";
import type { Turning } from "./globe.ts";
import type { GeoData, GeoMap, LonLat, Region } from "./index.ts";
import { RAD, add, angle, cross, dot, lonLat, scale, unit, vec, type Vec3 } from "./sphere.ts";

export interface ReprojectOptions {
  /** Where the map sits in the scene, in px. Each projection is fitted to it. */
  readonly frame: Rect;
  /** The TopoJSON object to read. Default the topology's first object. */
  readonly object?: string;
  /** Keep only the features this returns true for. Mercator needs Antarctica gone. */
  readonly filter?: (feature: Feature) => boolean;
  /** Degrees. Outlines are simplified once, in longitude and latitude, to within this. Default 0.3. */
  readonly simplify?: number;
  /** Degrees. Longer legs are split so they bend under every projection. Default 2. */
  readonly step?: number;
}

/** One region under every projection, `d[i]` under `projections[i]`, each written with the same commands. */
export interface Reprojection {
  readonly id: string;
  readonly properties: GeoJsonProperties;
  readonly d: readonly PathData[];
}

export interface Reprojected {
  readonly regions: readonly Reprojection[];
  /** Every region as one path per projection. From TopoJSON the shared borders are gone, leaving the land. */
  readonly land: readonly PathData[];
  /** The region whose id or `properties.name` is `key`. */
  region(key: string | number): Reprojection;
}

type Ring = [number, number][];

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** The rings of any GeoJSON in longitude and latitude, cut at the antimeridian the way d3-geo cuts them. */
const rings = (object: Feature | FeatureCollection | Polygon | MultiPolygon): Ring[] => {
  const out: Ring[] = [];
  let ring: Ring = [];

  const sink: GeoStream = {
    point: (x, y) => ring.push([x, -y]),
    lineStart: () => {
      ring = [];
    },
    lineEnd: () => {
      if (ring.length > 2) out.push(ring);
    },
    polygonStart: () => {},
    polygonEnd: () => {},
    sphere: () => {},
  };

  const flat = geoEquirectangular()
    .scale(180 / Math.PI)
    .translate([0, 0])
    .precision(0);

  // SAFETY: d3-geo streams any GeoJSON; the topojson-specification types describe the same shapes as GeoJSON's.
  geoStream(object as Feature, flat.stream(sink));

  return out;
};

/** Douglas–Peucker in degrees, then legs split to at most `step` degrees. */
const tidy = (ring: Ring, simplify: number, step: number): Ring => {
  const keep = new Uint8Array(ring.length);
  const stack: [number, number][] = [[0, ring.length - 1]];
  keep[0] = keep[ring.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [[ax, ay], [bx, by]] = [ring[first]!, ring[last]!];
    const length = Math.hypot(bx - ax, by - ay);
    let far = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const [x, y] = ring[i]!;

      const distance = length
        ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length
        : Math.hypot(x - ax, y - ay);

      if (distance > far) [far, index] = [distance, i];
    }

    if (far > simplify) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const kept = ring.filter((_, i) => keep[i]);

  return kept.flatMap(([x, y], i): Ring => {
    const [nx, ny] = kept[(i + 1) % kept.length]!;
    const pieces = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / step));

    return Array.from({ length: pieces }, (_, k): [number, number] => [
      x + ((nx - x) * k) / pieces,
      y + ((ny - y) * k) / pieces,
    ]);
  });
};

const write = (rings: readonly Ring[]): PathData =>
  // SAFETY: every ring is written starting with M.
  rings
    .map((ring) => `M${ring.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(" ")}Z`)
    .join("") as PathData;

/**
 * The same regions under several projections, written from the same points so `motion({ d })` morphs between them.
 * Outlines are cut at the antimeridian and simplified once, in longitude and latitude, before any projection runs.
 */
export function reproject(
  data: GeoData,
  projections: readonly GeoProjection[],
  options: ReprojectOptions,
): Reprojected {
  const { frame, simplify = 0.3, step = 2 } = options;

  if (projections.length < 2) throw new Error("reproject() needs at least two projections.");

  const read = (() => {
    if (data.type !== "Topology")
      return { data, features: data.type === "Feature" ? [data] : data.features };
    const key = options.object ?? Object.keys(data.objects)[0];
    const source = key === undefined ? undefined : data.objects[key];

    if (!source)
      throw new Error(
        `reproject() found no TopoJSON object named ${key}. The topology has ${Object.keys(data.objects).join(", ") || "no objects"}.`,
      );
    const all = feature(data, source);
    const list = "features" in all ? all.features : [all];
    const geometries = source.type === "GeometryCollection" ? source.geometries : undefined;

    return { data, features: list, geometries };
  })();

  const kept = read.features
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => options.filter?.(f) ?? true);

  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: kept.map(({ f }) => f),
  };

  for (const projection of projections)
    projection.fitExtent(
      [
        [frame.x, frame.y],
        [frame.x + frame.w, frame.y + frame.h],
      ],
      collection,
    );

  const reach = Math.max(frame.w, frame.h);

  const draw = (name: string, list: readonly Ring[]): PathData[] =>
    projections.map((projection, i) =>
      write(
        list.map((ring) =>
          ring.map((point) => {
            const [x, y] = projection(point) ?? [Number.NaN, Number.NaN];

            if (
              !Number.isFinite(x) ||
              !Number.isFinite(y) ||
              x < frame.x - reach ||
              x > frame.x + frame.w + reach ||
              y < frame.y - reach ||
              y > frame.y + frame.h + reach
            )
              throw new Error(
                `reproject() puts ${name} far outside the frame under projection ${i}. Filter it out: Mercator stretches the poles without end.`,
              );

            return [x, y];
          }),
        ),
      ),
    );

  const ready = (object: Parameters<typeof rings>[0]) =>
    rings(object)
      .map((ring) => tidy(ring, simplify, step))
      .filter((ring) => ring.length > 2);

  const regions = kept.flatMap(({ f, index }): Reprojection[] => {
    const id = String(f.id ?? f.properties?.name ?? index);
    const list = ready(f);

    return list.length > 0
      ? [{ id, properties: f.properties, d: draw(f.properties?.name ?? id, list) }]
      : [];
  });

  const geometries = "geometries" in read ? read.geometries : undefined;

  const land =
    read.data.type === "Topology" && geometries
      ? ready(
          merge(
            read.data,
            kept
              .map(({ index }) => geometries[index]!)
              .filter(
                (g): g is TopoPolygon | TopoMultiPolygon =>
                  g.type === "Polygon" || g.type === "MultiPolygon",
              ),
          ),
        )
      : ready(collection);

  return {
    regions,
    land: draw("the land", land),
    region(key) {
      const found = regions.find((r) => r.id === String(key) || r.properties?.name === key);

      if (!found)
        throw new Error(
          `reproject() has no region ${JSON.stringify(key)}. Regions are found by id or properties.name.`,
        );

      return found;
    },
  };
}

export interface TrueSizeOptions {
  /** Seconds the motion runs. Default `at + over`. */
  readonly duration?: Seconds;
  readonly at?: Seconds;
  readonly over: Seconds;
  /** Shapes the slide, from 0 to 1. Default a cubic ease in and out. */
  readonly ease?: (u: number) => number;
  /** Px. Default 0.5. */
  readonly tolerance?: number;
  /** Degrees. Longer legs are split so the outline bends as it moves. Default 1. */
  readonly step?: number;
}

const inOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Turns `p` about `axis` by `theta` radians. */
const turn = (p: Vec3, axis: Vec3, theta: number): Vec3 =>
  add(
    add(scale(p, Math.cos(theta)), scale(cross(axis, p), Math.sin(theta))),
    scale(axis, dot(axis, p) * (1 - Math.cos(theta))),
  );

/**
 * A region's real outline sliding over the globe so its middle lands on `to`, drawn through the map's projection at
 * every step: on Mercator, Greenland shrinks as it slides to the equator. Spread it onto a `<path>`.
 */
export function trueSize(
  map: GeoMap,
  region: Region | Feature,
  to: LonLat,
  options: TrueSizeOptions,
): Turning {
  const { at = 0, over, ease = inOut, tolerance = 0.5, step = 1 } = options;
  const duration = options.duration ?? at + over;
  const outlined = "feature" in region ? region.feature : region;
  const geometry = outlined.geometry;

  if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon")
    throw new Error("trueSize() needs a region with polygons.");

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  const main = polygons.reduce((a, b) =>
    geoArea({ type: "Polygon", coordinates: b }) > geoArea({ type: "Polygon", coordinates: a })
      ? b
      : a,
  );

  const from = vec(geoCentroid({ type: "Polygon", coordinates: main }));
  const target = vec(to);
  const theta = angle(from, target);
  const axis = theta > 1e-9 ? unit(cross(from, target)) : ([0, 0, 1] as const);

  const outline = polygons.flatMap((polygon) =>
    polygon.map((ring) => {
      const points = ring.slice(0, -1).map(vec);

      return points.flatMap((p, i) => {
        const q = points[(i + 1) % points.length]!;
        const pieces = Math.max(1, Math.ceil(angle(p, q) / (step * RAD)));

        return Array.from({ length: pieces }, (_, k) => {
          const u = k / pieces;

          return unit(add(scale(p, 1 - u), scale(q, u)));
        });
      });
    }),
  );

  const sample = (t: Seconds) => {
    const u = ease(Math.min(1, Math.max(0, (t - at) / over)));

    return write(
      outline.map((ring) =>
        ring.map((p) => {
          const [x, y] = map.projection([...lonLat(turn(p, axis, theta * u))]) ?? [0, 0];

          return [x, y];
        }),
      ),
    );
  };

  return { d: sample(0), animation: sampledPath(sample, { duration, tolerance }) };
}
