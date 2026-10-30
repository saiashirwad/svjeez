import { describe, expect, test } from "bun:test";
import { enter } from "svjeez";
import { keyframes, scene } from "../helpers/compile-scene";

describe("motion timing", () => {
  test("identical lanes share one @keyframes and one class", () => {
    const fade = () => enter({ at: 1, over: 0.5 });

    const svg = scene(
      <>
        <rect width={10} height={10} animation={fade()} />
        <circle r={4} animation={fade()} />
      </>,
    );

    expect(keyframes(svg)).toHaveLength(1);
    expect(svg.match(/class="a m1"/g)).toHaveLength(2);
  });
});
