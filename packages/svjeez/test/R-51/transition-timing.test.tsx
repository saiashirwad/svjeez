import { describe, expect, test } from "bun:test";
import { ease, motion } from "svjeez";
import { keyframes, scene } from "../helpers/compile-scene";

describe("motion timing", () => {
  test("an ease shapes the transition it is passed to, so CSS gets it on that transition's start key", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion().at(1).to({ opacity: 0 }, 1, ease.inOut).at(5).to({ opacity: 1 }, 1)}
      />,
    );

    expect(svg).toMatch(/10%\{opacity:1;animation-timing-function:[^}]+\}/);
    expect(svg).not.toMatch(/20%[^{]*\{opacity:0;animation-timing-function/);
  });

  test("values hold between transitions without hand-written holds", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1)}
      />,
    );

    expect(keyframes(svg)).toEqual(["0%,20%{opacity:0}30%,100%{opacity:1}"]);
  });

  test("a cut right after a transition that ends the scene lands on 100%", () => {
    const svg = scene(
      <rect width={10} height={10} animation={motion({ x: 0 }).to({ x: 50 }, 10).set({ x: 0 })} />,
    );

    expect(keyframes(svg)).toEqual([
      "0%,100%{translate:0px 0px}99.999%{translate:50px 0px;animation-timing-function:steps(1)}",
    ]);
  });
});
