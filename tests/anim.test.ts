import { describe, expect, test } from "bun:test";
import { Animator, EASE, anim, drawWindow, frame, motionDeclarations, normalizeFrames, revealWindow, typewriter } from "../src";

describe("animator", () => {
  test("fills the timeline edges and emits percentages", () => {
    const animator = new Animator(10);
    const cls = animator.add(anim("fade", [
      frame(2, { opacity: 0 }),
      frame(8, { opacity: 1 }),
    ]));
    const css = animator.css();
    expect(cls).toBe("a a-fade");
    expect(css).toContain("@keyframes fade{");
    expect(css).toContain("0%{opacity:0}");
    expect(css).toContain("20%{opacity:0}");
    expect(css).toContain("80%{opacity:1}");
    expect(css).toContain("100%{opacity:1}");
    expect(css).toContain(".a-fade{animation-name:fade}");
  });

  test("reuses identical requests without duplicating keyframes", () => {
    const animator = new Animator(10);
    const request = anim("pulse", revealWindow({ in: [1, 2], out: [8, 9] }));
    expect(animator.add(request)).toBe("a a-pulse");
    expect(animator.add(request)).toBe("a a-pulse");
    expect(animator.css().match(/@keyframes pulse/g)?.length).toBe(1);
  });

  test("rejects a reused name with different frames", () => {
    const animator = new Animator(10);
    animator.add(anim("same", [frame(0, { opacity: 0 }), frame(5, { opacity: 1 })]));
    expect(() => animator.add(anim("same", [frame(0, { opacity: 0 }), frame(5, { opacity: 0 })]))).toThrow();
  });

  test("builds translate and dashoffset declarations", () => {
    expect(motionDeclarations({ opacity: 0.5, x: 4, y: 8, scale: 0.9, rotate: 4 })).toEqual([
      ["opacity", "0.5"],
      ["transform", "translate(4px,8px) rotate(4deg) scale(0.9)"],
    ]);
    expect(motionDeclarations({ dashoffset: 1, strokeOpacity: 0.4 })).toEqual([
      ["stroke-dashoffset", "1"],
      ["stroke-opacity", "0.4"],
    ]);
  });

  test("emits a caller-supplied ease per keyframe", () => {
    const animator = new Animator(10);
    animator.add(anim("typing", typewriter({ start: 2, end: 4, distance: 100, steps: 12 })));
    const css = animator.css();
    expect(css).toContain("animation-timing-function:steps(12, end)");
    expect(css).toContain("translateX(100px)");
  });

  test("draw windows animate pathLength-normalized lines", () => {
    const frames = drawWindow({ in: [1, 3], out: [8, 9], opacity: 0.6 });
    const normalized = normalizeFrames(frames, 10, "thread");
    expect(normalized[0]?.props).toEqual({ opacity: 0, dashoffset: 1 });
    expect(normalized.some((entry) => entry.props.dashoffset === 0)).toBe(true);
    expect(normalized.at(-1)?.props).toEqual({ opacity: 0, dashoffset: 0 });
  });

  test("validates overlapping reveal windows", () => {
    expect(() => revealWindow({ in: [5, 4] })).toThrow();
    expect(() => revealWindow({ in: [2, 6], out: [5, 7] })).toThrow();
  });

  test("exposes the motion easing tokens", () => {
    expect(EASE.out).toContain("cubic-bezier");
    expect(EASE.steps(6)).toBe("steps(6, end)");
  });
});
