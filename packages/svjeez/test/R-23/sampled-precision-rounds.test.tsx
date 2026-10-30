import { describe, expect, test } from "bun:test";
import { sampled } from "svjeez";
import { PERIOD, scene, translateKeys } from "../helpers/timeline-sampled";

describe("sampled", () => {
  test("precision rounds every sample before the keys are kept", () => {
    const wave = (t: number) => ({ x: 10.123456 * Math.sin(t), y: 3.98765 * t });

    const keys = translateKeys(
      scene(
        sampled(wave, { duration: PERIOD, precision: 1, tolerance: { translate: 0.2 } }),
        PERIOD,
      ),
      PERIOD,
    );

    expect(keys.length).toBeGreaterThan(4);

    for (const key of keys) {
      expect(String(key.x)).toMatch(/^-?\d+(\.\d)?$/);
      expect(String(key.y)).toMatch(/^-?\d+(\.\d)?$/);
    }
  });
});
