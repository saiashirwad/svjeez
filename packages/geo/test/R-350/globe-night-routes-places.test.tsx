import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { globe, sun, type LonLat } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { agreement, frame, rings } from "../helpers/moving.ts";

describe("globe()", () => {
  const spin = { from: 20, to: -340, over: 12 };

  test("covers the night side and leaves the day side", () => {
    const date = new Date(Date.UTC(2026, 2, 20, 12));
    const earth = globe(world, { frame, tilt: 10, spin });
    const night = earth.night(date).d;
    const [lon, lat] = sun(date);
    expect(
      agreement([night], earth.facing(0), ([x, y]) => {
        const r = Math.PI / 180;

        return (
          Math.sin(y * r) * Math.sin(lat * r) +
            Math.cos(y * r) * Math.cos(lat * r) * Math.cos((x - lon) * r) <
          0
        );
      }),
    ).toBeGreaterThan(0.98);
  });

  test("starts a route at its first place while both ends face the viewer", () => {
    const earth = globe(world, { frame, tilt: 22, spin: { from: -40, to: -40, over: 1 } });
    const london: LonLat = [-0.13, 51.5];
    const first = rings(earth.route(london, [-74, 40.7]).d)[0]![0]!;
    const { point } = earth.locate(london, 0);

    expect(Math.hypot(first[0] - point.x, first[1] - point.y)).toBeLessThan(0.2);
  });

  test("fades a place out behind the globe", () => {
    const earth = globe(world, { frame, tilt: 0, spin: { from: 0, to: -180, over: 4 } });

    const svg = render(
      { width: 400, height: 400, duration: 4, title: "Place" },
      <g {...earth.place([0, 0])} />,
    );

    expect(svg).toMatch(/opacity:1/);
    expect(svg).toMatch(/opacity:0/);
  });
});
