import { describe, expect, test } from "bun:test";
import { ease, matchPaths, motion, render } from "svjeez";
import { scene } from "../helpers/paths";

describe("the d channel", () => {
  test("animates through SMIL with a still twin for reduced motion", () => {
    const [a, b] = matchPaths(["M0 0H10V10Z", "M5 0L10 10H0Z"]);
    const svg = scene(motion({ d: a! }).at(1).to({ d: b! }, 1));

    expect(svg).toContain('attributeName="d"');
    expect(svg).toMatch(/<path[^>]*class="[^"]*ds"[^>]*display="none"/);
    expect(svg).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*dm\{display:none\}/);
  });

  test("the still twin is the ds copy of the path", () => {
    const svg = render(
      { width: 100, height: 100, duration: 4, title: "Test", reducedMotion: { at: 2 } },
      <path
        d="M0 0H10"
        animation={motion({ d: "M0 0H10" }).at(1).to({ d: "M0 10H20" }, 2, ease.linear)}
      />,
    );

    expect(svg).toMatch(/<path[^>]*class="[^"]*ds"/);
  });

  test("needs no twin when reduced motion is off", () => {
    const [a, b] = matchPaths(["M0 0H10V10Z", "M5 0L10 10H0Z"]);

    expect(scene(motion({ d: a! }).to({ d: b! }, 1), false)).not.toContain('display="none"');
  });
});
