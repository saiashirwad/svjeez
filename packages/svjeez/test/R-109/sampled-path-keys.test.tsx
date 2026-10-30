import { describe, expect, test } from "bun:test";
import { sampledPath } from "svjeez";
import { scene } from "../helpers/paths";

describe("sampledPath", () => {
  test("keeps few keys for a shape that moves steadily", () => {
    const m = sampledPath((t) => `M${10 * t} 0L${10 * t + 5} 5`, { duration: 4, tolerance: 0.1 });
    const svg = scene(m);
    const values = svg.match(/values="([^"]*)"/)![1]!.split(";");

    expect(values).toEqual(["M0 0L5 5", "M40 0L45 5"]);
  });

  test("lets points stray by their slack", () => {
    const wave = (t: number) => `M0 0L${50 + 40 * Math.sin(t)} 0`;

    const keys = (slack?: (x: number, y: number) => number) =>
      scene(sampledPath(wave, { duration: 4, tolerance: 0.5, slack }))
        .match(/values="([^"]*)"/)![1]!
        .split(";").length;

    expect(keys((x) => (x > 5 ? 100 : 0))).toBe(2);
    expect(keys()).toBeGreaterThan(5);
  });
});
