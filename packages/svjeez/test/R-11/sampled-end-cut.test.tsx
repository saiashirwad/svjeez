import { describe, expect, test } from "bun:test";
import { sampled } from "svjeez";
import { lane, scene, translateKeys } from "../helpers/timeline-sampled";

describe("sampled", () => {
  test("a step that leaves a sliver before the end still renders", () => {
    const svg = scene(
      sampled((t) => ({ x: 10 * t }), {
        duration: 1,
        step: 0.3333333,
        tolerance: { translate: 0.001 },
      }),
      1,
    );

    expect(translateKeys(svg, 1).at(-1)).toMatchObject({ at: 1, x: 10 });
  });

  test("a last step shorter than the scene can tell apart still renders", () => {
    const motion = sampled((t) => ({ x: 100 * t }), {
      duration: 0.1,
      step: 0.09999,
      tolerance: { translate: 0 },
    });

    const [body] = lane(scene(motion, 20), "translate");
    expect(body).toBe(
      "0%{translate:0px 0px}0.5%{translate:9.999px 0px;animation-timing-function:steps(1)}0.501%,100%{translate:10px 0px}",
    );
  });
});
