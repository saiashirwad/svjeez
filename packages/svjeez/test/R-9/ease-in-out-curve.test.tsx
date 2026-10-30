import { describe, expect, test } from "bun:test";
import { ease, motion } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("motion timing", () => {
  test("ease.inOut writes its cubic-bezier points into the transition's timing function", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion().at(1).to({ opacity: 0 }, 1, ease.inOut).at(5).to({ opacity: 1 }, 1)}
      />,
    );

    expect(svg).toContain("animation-timing-function:cubic-bezier(.77,0,.175,1)");
  });
});
