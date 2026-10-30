import { describe, expect, test } from "bun:test";
import { blue, build, green, place, red, topColor, uses } from "../helpers/voxel";

describe("voxel.scene", () => {
  test("blocks with the same skin share one symbol", () => {
    const hrefs = uses(
      build([
        place([0, 0, 0]),
        place([1, 0, 0], { skin: green }),
        place([2, 0, 0]),
        place([3, 0, 0], { skin: green }),
        place([4, 0, 0], { skin: blue }),
      ]),
    );

    expect(hrefs[0]!.href).toBe(hrefs[2]!.href);
    expect(hrefs[1]!.href).toBe(hrefs[3]!.href);
    expect(new Set(hrefs.map((use) => use.href)).size).toBe(3);
  });

  test("a skin names a face and the rest fall back to its side", () => {
    const svg = build([{ at: [0, 0, 0], skin: { side: red, top: green } }]);
    expect(topColor(svg, uses(svg)[0]!.href)).toBe("#00ff00");
  });

  test("nothing animated sits inside a def", () => {
    const svg = build([place([0, 0, 0], { from: 1 })]);
    expect(svg.slice(svg.indexOf("<defs>"), svg.indexOf("</defs>"))).not.toContain('class="a');
  });
});
