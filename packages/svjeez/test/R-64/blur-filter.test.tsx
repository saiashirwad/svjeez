import { describe, expect, test } from "bun:test";
import { def, ease, enter, motion, render, sample } from "svjeez";
import { body, scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("blur compiles to a generated filter whose stdDeviation animates with SMIL", () => {
    const svg = scene(
      <rect width={10} height={10} animation={enter({ at: 1, over: 1 }, { blur: 4 })} />,
    );

    expect(svg).toMatch(
      /<feGaussianBlur stdDeviation="0">\s*<animate attributeName="stdDeviation" values="4;4;0;0" keyTimes="0;0.1;0.2;1" calcMode="spline"/,
    );
    expect(body(svg)).toContain('<rect width="10" height="10" filter="url(#f1)"/>');
  });

  test("the reduced-motion still of a blur is the blur sample() reads at that moment, mid-transition included", () => {
    for (const curve of [ease.linear, ease.out, ease.pop, ease.steps(4)]) {
      const blur = motion({ blur: 0 }).at(1).to({ blur: 4 }, 3, curve);

      const svg = render(
        { width: 100, height: 100, duration: 6, title: "Still", reducedMotion: { at: 3 } },
        <rect width={10} height={10} animation={blur} />,
      );

      const still = svg.match(/<filter id="f1s"[^>]*>\s*<feGaussianBlur stdDeviation="([^"]+)"/);
      expect(Number(still?.[1])).toBeCloseTo(sample(blur, 3, { duration: 6 }).blur, 2);
      expect(Number(still?.[1])).toBeGreaterThan(0);
    }
  });

  test("blur on an element that has its own filter lands on a wrapper", () => {
    const glow = def.filter({}, <feGaussianBlur stdDeviation={2} />);

    const svg = scene(
      <rect
        width={10}
        height={10}
        filter={glow}
        animation={enter({ at: 1, over: 1 }, { blur: 4 })}
      />,
    );

    expect(body(svg)).toMatch(
      /<g filter="url\(#f2\)">\s*<rect width="10" height="10" filter="url\(#f1\)"\/>/,
    );
  });
});
