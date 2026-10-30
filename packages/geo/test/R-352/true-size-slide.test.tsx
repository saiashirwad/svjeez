import { describe, expect, test } from "bun:test";
import { geoMercator } from "d3-geo";
import { render } from "svjeez";
import { project, trueSize } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { area, frame } from "../helpers/moving.ts";

describe("trueSize()", () => {
  test("shrinks Greenland as it slides to the equator on Mercator", () => {
    const map = project(world, {
      frame,
      projection: geoMercator(),
      filter: (f) => f.properties?.name !== "Antarctica",
    });

    const slide = trueSize(map, map.region("Greenland"), [-20, 0], { over: 2 });

    const svg = render(
      { width: 400, height: 400, duration: 2, title: "Slide" },
      <path {...slide} />,
    );

    const keys = svg.match(/values="([^"]*)"/)![1]!.split(";");

    expect(area(keys.at(-1)!)).toBeLessThan(area(keys[0]!) / 5);
  });
});
