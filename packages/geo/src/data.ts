import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiLineString,
  MultiPolygon as MultiPolygonGeometry,
} from "geojson";
import { feature, merge, mesh } from "topojson-client";
import type { GeometryObject, MultiPolygon, Polygon, Topology } from "topojson-specification";
import { SceneError } from "svjeez/tools";

export type LonLat = readonly [lon: number, lat: number];

export type GeoData = Topology | FeatureCollection | Feature;

export interface ReadOptions {
  readonly object?: string;
  readonly filter?: (feature: Feature) => boolean;
}

export interface Place {
  readonly feature: Feature;
  readonly id: string;
  readonly name: string | undefined;
  readonly properties: GeoJsonProperties;
}

export interface Read {
  readonly places: readonly Place[];
  readonly all: FeatureCollection;
  readonly land: FeatureCollection | MultiPolygonGeometry;
  readonly borders: MultiLineString | undefined;
}

const KINDS: readonly string[] = ["Topology", "FeatureCollection", "Feature"];

const nameOf = (properties: GeoJsonProperties): string | undefined => {
  const name = properties?.["name"];

  return name === undefined || name === null ? undefined : String(name);
};

export const read = (data: GeoData, options: ReadOptions, caller: string): Read => {
  if (!KINDS.includes(data?.type))
    throw new SceneError(
      `${caller} reads GeoJSON or TopoJSON, got data of type ${JSON.stringify(data?.type)}.`,
      "Pass a Topology, a FeatureCollection or a Feature, such as world-atlas's countries-110m.json.",
    );

  const objects = data.type === "Topology" ? data.objects : {};
  const names = Object.keys(objects);
  const key = options.object ?? names[0];

  if (data.type !== "Topology" && options.object !== undefined)
    throw new SceneError(
      `${caller} was given object: ${JSON.stringify(options.object)}, but its data is GeoJSON, which has no named objects.`,
      "Leave object out, or pass the TopoJSON it names.",
    );

  const source = key === undefined ? undefined : objects[key];

  if (data.type === "Topology" && !source)
    throw new SceneError(
      `${caller} found no TopoJSON object named ${JSON.stringify(key)}.`,
      names.length
        ? `Name one the topology has: ${names.map((name) => JSON.stringify(name)).join(", ")}.`
        : "The topology has no objects.",
    );

  const features = (() => {
    if (data.type === "FeatureCollection") return data.features;

    if (data.type === "Feature") return [data];
    const found = feature(data, source!);

    return "features" in found ? found.features : [found];
  })();

  const listed = features.map((f, index) => ({ f, index }));
  const kept = options.filter ? listed.filter(({ f }) => options.filter!(f)) : listed;

  if (kept.length === 0)
    throw new SceneError(
      `${caller} has nothing to draw: ${features.length ? "its filter keeps none of the regions" : "the data holds no regions"}.`,
      features.length ? "Loosen the filter." : "Pass data with at least one feature.",
    );

  const places = kept.map(({ f, index }): Place => ({
    feature: f,
    id: String(f.id ?? nameOf(f.properties) ?? index),
    name: nameOf(f.properties),
    properties: f.properties,
  }));

  const all: FeatureCollection = { type: "FeatureCollection", features: kept.map(({ f }) => f) };

  if (data.type !== "Topology" || source?.type !== "GeometryCollection")
    return { places, all, land: all, borders: undefined };

  // SAFETY: topojson-client's merge and mesh read only each geometry's type and arcs, never its properties.
  const geometries = kept.map(({ index }) => source.geometries[index]!) as GeometryObject[];

  const areas = geometries.filter(
    (g): g is Polygon | MultiPolygon => g.type === "Polygon" || g.type === "MultiPolygon",
  );

  return {
    places,
    all,
    land: areas.length ? merge(data, areas) : all,
    borders: mesh(data, { type: "GeometryCollection", geometries }, (a, b) => a !== b),
  };
};

export const finder = <T extends { readonly id: string; readonly name: string | undefined }>(
  items: readonly T[],
  caller: string,
) => {
  const byKey = new Map<string, T>();

  for (const item of items) {
    byKey.set(item.id, item);

    if (item.name !== undefined && !byKey.has(item.name)) byKey.set(item.name, item);
  }

  return (key: string | number): T => {
    const found = byKey.get(String(key));

    if (found) return found;
    const lower = String(key).toLowerCase();
    const near = items.find((item) => item.name?.toLowerCase() === lower);

    throw new SceneError(
      `${caller} has no region ${JSON.stringify(key)}.`,
      near?.name !== undefined
        ? `Names match exactly: write ${JSON.stringify(near.name)}.`
        : `Regions are found by id or name, such as ${items
            .slice(0, 3)
            .map((item) => JSON.stringify(item.name ?? item.id))
            .join(", ")}.`,
    );
  };
};

export const lonLat = (at: LonLat, caller: string): [number, number] => {
  const [lon, lat] = at;

  if (!Number.isFinite(lon) || !Number.isFinite(lat))
    throw new SceneError(
      `${caller} takes a place as [longitude, latitude] in degrees, got [${at.join(", ")}].`,
      "Give two finite numbers.",
    );

  if (Math.abs(lat) > 90)
    throw new SceneError(
      `${caller} got [${at.join(", ")}], whose latitude ${lat} is past a pole.`,
      Math.abs(lon) <= 90
        ? `A place is [longitude, latitude]: longitude first, as in [${lat}, ${lon}].`
        : "Latitude runs from -90 to 90.",
    );

  return [lon, lat];
};
