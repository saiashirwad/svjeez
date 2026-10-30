import { describe, expect, test } from "bun:test";
import { legend, palettes, sequential } from "../../src/index.ts";
import { scene } from "../helpers/geo-world.ts";

describe("legend()", () => {
  test("draws a swatch per class and labels the edges", () => {
    const scale = sequential(palettes.viridis, { domain: [0, 80], steps: 4 });
    const svg = scene(legend(scale, { x: 10, y: 10, width: 200, every: 1, title: "Years" }));

    expect(svg.match(/<rect/g)).toHaveLength(4);

    for (const label of ["0", "20", "40", "60", "80", "Years"]) expect(svg).toContain(`>${label}<`);
  });
});
