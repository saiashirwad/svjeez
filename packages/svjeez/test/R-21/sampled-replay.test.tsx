import { describe, expect, test } from "bun:test";
import { sampled } from "svjeez";
import { PERIOD, circle, lane, replay, scene, translateKeys } from "../helpers/timeline-sampled";

describe("sampled", () => {
  test("a circle at 1px tolerance replays within 1px of every sample, with far fewer keys", () => {
    const step = 0.05;

    const keys = translateKeys(
      scene(sampled(circle, { duration: PERIOD, step, tolerance: { translate: 1 } }), PERIOD),
      PERIOD,
    );

    let worst = 0;

    for (let i = 0; i <= PERIOD / step; i++) {
      const t = i * step;
      const at = replay(keys, t);
      worst = Math.max(worst, Math.hypot(at.x - circle(t).x, at.y - circle(t).y));
    }

    expect(worst).toBeLessThanOrEqual(1);
    expect(keys.length).toBeLessThan(PERIOD / step / 4);
  });

  test("a flat opacity lane keeps only its two end keys beside a moving translate", () => {
    const svg = scene(
      sampled((t) => ({ ...circle(t), opacity: 0.5 }), {
        duration: PERIOD,
        tolerance: { translate: 1, opacity: 0.02 },
      }),
      PERIOD,
    );

    expect(lane(svg, "opacity")).toEqual(["0%,100%{opacity:0.5}"]);
    expect(translateKeys(svg, PERIOD).length).toBeGreaterThan(2);
  });
});
