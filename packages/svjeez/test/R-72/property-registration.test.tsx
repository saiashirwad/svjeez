import { describe, expect, test } from "bun:test";
import { css, render } from "svjeez";
import { px, spin, tint, yaw } from "../helpers/compile-fixtures";
import { body, keyframes, scene } from "../helpers/compile-scene";

describe("properties", () => {
  test("an animated property is registered once and keyframed under its render name", () => {
    const svg = scene(
      <>
        <g animation={spin()} />
        <g animation={spin()} />
      </>,
    );

    expect(svg).toContain("@property --p1{syntax:'<angle>';inherits:true;initial-value:0deg}");
    expect(svg.match(/@property/g)).toHaveLength(1);
    expect(keyframes(svg)).toEqual(["0%{--p1:0deg}10%,100%{--p1:90deg}"]);
    expect(body(svg).match(/<g class="a m1"\/>/g)).toHaveLength(2);
  });

  test("style sets properties per element, with units from the syntax", () => {
    const svg = scene(
      <circle r={2} style={{ [px]: 0.25, [yaw]: 30, [tint]: "#f80", opacity: 0.5 }} />,
    );

    expect(body(svg)).toContain('style="--p1:0.25;--p2:30deg;--p3:#f80;opacity:0.5"');
    expect(svg).toContain("@property --p3{syntax:'<color>';inherits:false;initial-value:#000}");
  });

  test("a declared property that nothing uses is not registered", () => {
    expect(scene(<rect width={1} height={1} style={{ opacity: 0.5 }} />)).not.toContain(
      "@property",
    );
  });

  test("css holes register the property they read", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "T", css: css`.d{rotate:calc(${yaw} * ${2})}` },
      <g animation={spin()} />,
    );

    expect(svg.match(/@property --p1\{/g)).toHaveLength(1);
  });

  test("names follow first use in the render, not declaration order", () => {
    const svg = scene(<circle r={2} style={{ [tint]: "#fff", [px]: 1 }} />);
    expect(body(svg)).toContain('style="--p1:#fff;--p2:1"');
  });
});
