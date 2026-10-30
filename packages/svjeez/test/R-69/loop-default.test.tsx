import { describe, expect, test } from "bun:test";
import { motion, render } from "svjeez";

describe("loop", () => {
  const scene = (loop?: boolean) =>
    render(
      { width: 100, height: 100, duration: 6, title: "Loop", loop },
      <>
        <rect
          width={10}
          height={10}
          animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1)}
        />
        <circle r={4} animation={motion({ rotate: 0 }).to({ rotate: 90 }, 1).loop(2)} />
        <path d="M0 0H10" stroke="#fff" animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)} />
      </>,
    );

  test("scenes loop by default", () => {
    const svg = scene();
    expect(svg).toBe(scene(true));
    expect(svg).toContain("animation-iteration-count:infinite");
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).not.toContain('fill="freeze"');
  });

  test("loop: false plays once, repeating shorter loops to fill the scene, and holds the end", () => {
    const svg = scene(false);
    expect(svg).toContain("animation-iteration-count:1;animation-fill-mode:both");
    expect(svg).toContain("animation-duration:2s;animation-iteration-count:3");
    expect(svg).toContain('repeatCount="1" fill="freeze"');
    expect(svg).not.toContain("infinite");
    expect(svg).not.toContain("indefinite");
  });
});
