import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("motion timing", () => {
  test("a loop period snaps to divide the scene", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 1 }).at(0.55).set({ opacity: 0 }).loop(1.1)}
      />,
    );

    expect(svg).toContain("animation-duration:1.111s");
  });
});
