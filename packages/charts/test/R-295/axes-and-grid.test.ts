import { describe, expect, test } from "bun:test";
import { defaultDark, tint } from "svjeez/extras";
import { chart } from "../../src/index.ts";
import { band, quarters, scene } from "../helpers/charts.ts";

describe("chart frame", () => {
  test("it draws its axes in the colors axes() uses", () => {
    const svg = scene(band().node);
    expect(svg).toContain(tint(defaultDark, "comment"));
    expect(svg).toContain(tint(defaultDark, "muted"));

    for (const q of quarters) expect(svg).toContain(`>${q}</text>`);
  });

  test("grid adds faint lines across the plot", () => {
    const [plain, gridded] = [false, true].map((grid) =>
      scene(
        chart({
          width: 400,
          height: 200,
          grid,
          x: { kind: "band", domain: quarters },
          data: [["Q1", 5]],
        }).node,
      ),
    );

    expect(plain).not.toContain("stroke-opacity");
    expect(gridded).toContain("stroke-opacity");
  });
});
