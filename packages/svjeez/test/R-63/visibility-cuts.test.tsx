import { describe, expect, test } from "bun:test";
import { draw, ease, motion } from "svjeez";
import { keyframes, scene } from "../helpers/compile-scene";

describe("motion timing", () => {
  test("a loop period that snaps to divide the scene still toggles visibility", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 1 }).at(0.55).set({ opacity: 0 }).loop(1.1)}
      />,
    );

    expect(keyframes(svg)).toEqual(["0%{visibility:visible}50%,100%{visibility:hidden}"]);
  });

  test("a step 0/1 opacity is a visibility toggle, so the browser skips painting it", () => {
    const svg = scene(
      <rect width={10} height={10} animation={motion({ opacity: 0 }).at(2).set({ opacity: 1 })} />,
    );

    expect(keyframes(svg)[0]).toContain("visibility:hidden");
    expect(keyframes(svg)[0]).toContain("visibility:visible");
    expect(svg).not.toContain("opacity:0");
  });

  test("a cut inside a cut cannot show through its hidden parent", () => {
    const cut = (at: number) => motion({ opacity: 0 }).at(at).set({ opacity: 1 });

    const nested = scene(
      <g animation={cut(5)}>
        <rect width={10} height={10} animation={cut(1)} />
        <path d="M0 0h10" stroke="#000" animation={draw({ at: 1, over: 1 })} />
      </g>,
    );

    const stacked = scene(<rect width={10} height={10} animation={[cut(5), cut(1)]} />);

    for (const svg of [nested, stacked])
      expect(keyframes(svg).filter((frames) => frames.includes("visibility:visible"))).toHaveLength(
        1,
      );
  });

  test("a fade, a stepped fade, or a static opacity keeps animating opacity", () => {
    const fade = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1)}
      />,
    );

    const stepped = scene(
      <rect
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(2).to({ opacity: 1 }, 1, ease.steps(4))}
      />,
    );

    const pinned = scene(
      <rect
        width={10}
        height={10}
        opacity={0.5}
        animation={motion({ opacity: 0 }).at(2).set({ opacity: 1 })}
      />,
    );

    expect(keyframes(fade)[0]).toContain("opacity:");
    expect(keyframes(stepped)[0]).toContain("opacity:");
    expect(keyframes(pinned)[0]).toContain("opacity:");
  });
});
