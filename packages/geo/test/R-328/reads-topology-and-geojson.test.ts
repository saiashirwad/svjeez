import { describe, expect, test } from "bun:test";
import { project } from "../../src/index.ts";
import { frame, map } from "../helpers/geo-world.ts";

describe("project()", () => {
  test("reads every country from the topology's first object", () => {
    expect(map.regions).toHaveLength(177);
  });

  test("takes GeoJSON as well as TopoJSON", () => {
    const square = project(
      {
        type: "Feature",
        id: "square",
        properties: {},
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
      { frame },
    );

    expect(square.region("square").d).toMatch(/^M[\d.]+ [\d.]+l.*z$/);
  });
});
