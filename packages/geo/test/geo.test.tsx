import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import type { FeatureCollection } from "geojson";
import { Group, Shape, scene, span } from "svjeez";
import { SceneError, isScene, svg } from "svjeez/tools";
import {
  GlobeShape,
  geoOrthographic,
  globe,
  night,
  project,
  sun,
  type Topology,
} from "../src/index.ts";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const square: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "sq",
      properties: { name: "Square" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

const thrown = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("expected a SceneError");
};

const emit = (build: () => ReturnType<typeof Group>, duration = 4) =>
  svg.emit(scene({ size: [400, 300], duration, title: "geo" }, build));

describe("project", () => {
  const map = project(world, { size: [800, 400] });

  test("fits every region inside its size", () => {
    expect(map.regions.length).toBeGreaterThan(150);

    for (const region of map.regions) {
      expect(region.box.x).toBeGreaterThanOrEqual(-0.5);
      expect(region.box.y).toBeGreaterThanOrEqual(-0.5);
      expect(region.box.x + region.box.width).toBeLessThanOrEqual(800.5);
      expect(region.box.y + region.box.height).toBeLessThanOrEqual(400.5);
    }
  });

  test("finds regions by name or id, and centers them on their largest piece", () => {
    const france = map.region("France");
    const paris = map.point([2.35, 48.86]);

    expect(map.region(france.id)).toBe(france);
    expect(Math.hypot(france.center[0] - paris[0], france.center[1] - paris[1])).toBeLessThan(20);
  });

  test("routes run from one place to the other", () => {
    const from = map.point([-0.13, 51.51]);
    const to = map.point([151.21, -33.87]);
    const route = map.route([-0.13, 51.51], [151.21, -33.87]);

    expect(route).toMatchObject({ kind: "polygon", closed: false });

    if (!("points" in route)) throw new Error("a route is a polyline");
    expect(route.points[0]).toEqual(from);
    expect(route.points.at(-1)).toEqual(to);
  });

  test("draws land, borders, sphere and graticule as path geometry", () => {
    for (const geometry of [map.land, map.borders, map.sphere, map.graticule(30)])
      expect(geometry).toMatchObject({ kind: "path" });

    const out = emit(() => (
      <Group>
        <Shape geometry={map.land} fill="#336699" />
        <Shape geometry={map.borders} stroke={{ color: "#FFFFFF", width: 0.5 }} />
      </Group>
    ));

    expect(out.match(/<path /g)?.length).toBe(2);
  });

  test("lays dots on land only", () => {
    const dots = map.dots(6);

    expect(dots.length).toBeGreaterThan(100);
    expect(dots.every((dot) => dot.region.geometry !== undefined)).toBe(true);
  });

  test("says what to change when it is misused", () => {
    expect(thrown(() => map.region("france")).fix).toContain('"France"');
    expect(thrown(() => map.region("Narnia")).problem).toBe('project() has no region "Narnia".');
    expect(thrown(() => map.point([51.5, -0.13 + 100])).fix).toContain("longitude first");
    expect(thrown(() => map.route([-170, 0], [170, 0])).problem).toContain("crosses the edge");
    expect(thrown(() => project(square, { size: [100, 100] }).borders).fix).toContain("TopoJSON");
    expect(thrown(() => project(world, { size: [0, 100] })).problem).toContain("size");

    expect(thrown(() => project(world, { size: [100, 100], object: "states" })).fix).toContain(
      '"countries"',
    );

    expect(
      thrown(() => project(JSON.parse('{"type":"Point"}'), { size: [100, 100] })).problem,
    ).toBe('project() reads GeoJSON or TopoJSON, got data of type "Point".');
  });

  test("names a region the projection hides", () => {
    const facing = project(world, {
      size: [200, 200],
      projection: geoOrthographic().rotate([0, -90]),
      fit: "sphere",
    });

    expect(thrown(() => facing.region("Antarctica")).problem).toContain("clips all of it away");
  });
});

describe("globe", () => {
  const still = globe(world, { radius: 100, facing: [0, 20] });

  const turning = globe(world, {
    radius: 100,
    facing: [0, 20],
    turn: { by: -360, over: span(0, 8) },
    simplify: 1,
  });

  test("a still globe draws static outlines", () => {
    for (const piece of still.land.pieces) expect(piece).toMatchObject({ kind: "path" });
    const { offset, opacity } = still.place([0, 20]);

    expect(offset).toEqual([0, expect.closeTo(0, 9)]);
    expect(opacity).toBe(1);
  });

  test("a turning globe ends where it starts", () => {
    const [x0, y0] = turning.locate([10, 10], 0).point;
    const [x1, y1] = turning.locate([10, 10], 8).point;

    expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(1e-6);
    expect(turning.facing(4)).toEqual([-180, 20]);
  });

  test("draws turning outlines clipped to its disc", () => {
    const out = emit(
      () => (
        <Group offset={[200, 150]}>
          <Shape geometry={turning.sphere} fill="#102030" />
          <GlobeShape of={turning.land} fill="#88AACC" />
          <GlobeShape
            of={turning.route([-0.13, 51.51], [139.69, 35.69])}
            stroke={{ color: "#FF8800", width: 2 }}
          />
          <Group {...turning.place([2.35, 48.86])}>
            <Shape geometry={turning.sphere} fill="#FF0000" scale={0.02} />
          </Group>
        </Group>
      ),
      8,
    );

    expect(out).toContain("<clipPath");
    expect(out).toContain('attributeName="d"');
  });

  test("its night and terminator follow the sun", () => {
    const date = new Date(Date.UTC(2026, 5, 21, 12));
    const [lon, lat] = sun(date);

    expect(Math.abs(lon)).toBeLessThan(2);
    expect(lat).toBeCloseTo(23.4, 0);
    expect(night(date).type).toBe("Polygon");
    expect(turning.night(date).pieces).toHaveLength(1);
    expect(turning.terminator((t) => new Date(date.getTime() + t * 3_600_000)).pieces).toHaveLength(
      1,
    );
  });

  test("says what to change when it is misused", () => {
    expect(thrown(() => globe(world, { radius: -1, facing: [0, 0] })).problem).toContain("radius");

    expect(
      thrown(() =>
        globe(world, { radius: 10, facing: [0, 0], turn: { by: 360, over: span(1, 0) } }),
      ).fix,
    ).toContain("span(0, 24)");

    expect(thrown(() => turning.route([0, 0], [0, 0])).problem).toContain("starts where it ends");
    expect(thrown(() => turning.night(new Date(Number.NaN))).problem).toContain("needs a Date");
    expect(thrown(() => globe(square, { radius: 10, facing: [0, 0] }).borders).fix).toContain(
      "TopoJSON",
    );

    expect(
      thrown(() =>
        emit(() => (
          <Group>
            <GlobeShape of={turning.land} />
          </Group>
        )),
      ).problem,
    ).toBe("<GlobeShape> of the globe's land paints nothing: it has no fill and no stroke.");
  });

  test("builds inside a scene", () => {
    expect(isScene(scene({ size: [10, 10], duration: 1, title: "t" }, () => <Group />))).toBe(true);
  });
});
