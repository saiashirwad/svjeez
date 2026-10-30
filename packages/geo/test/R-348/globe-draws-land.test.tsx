import { describe, expect, test } from "bun:test";
import { geoContains } from "d3-geo";
import { render } from "svjeez";
import { globe } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { agreement, commands, frame, land } from "../helpers/moving.ts";

describe("globe()", () => {
  const spin = { from: 20, to: -340, over: 12 };

  test("draws the land a viewer would see, at every facing", () => {
    for (const tilt of [22, 0, -40]) {
      const earth = globe(world, { frame, tilt, spin, simplify: 0.3, step: 3 });
      const pieces = earth.land();

      expect(pieces.length).toBeGreaterThan(4);
      expect(
        agreement(
          pieces.map((p) => p.d),
          earth.facing(0),
          (at) => geoContains(land, at),
        ),
      ).toBeGreaterThan(0.98);
    }
  }, 30_000);

  test("animates every piece of land through d, with the same commands throughout", () => {
    const earth = globe(world, { frame, tilt: 22, spin });

    const svg = render(
      { width: 400, height: 400, duration: 12, title: "Globe" },
      <>
        {earth.land().map((p) => (
          <path {...p} />
        ))}
      </>,
    );

    for (const values of svg.matchAll(/values="([^"]*)"/g)) {
      const keys = values[1]!.split(";");

      expect(new Set(keys.map(commands)).size).toBe(1);
    }

    expect(svg).toContain('attributeName="d"');
  });
});
