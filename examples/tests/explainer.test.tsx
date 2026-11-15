import { describe, expect, test } from "bun:test";
import { enter, render } from "svjeez";

// The explainer shows this scene and the CSS it compiles to. If either changes, update examples/explainer/index.tsx.
describe("the explainer's code is what svjeez outputs", () => {
  const svg = render(
    { width: 320, height: 180, duration: 2, title: "A square" },
    <rect
      x={120} y={50} width={80} height={80} rx={12}
      animation={enter({ at: 0.5, over: 1 }, { x: -120 })}
    />,
  );

  test("the keyframes", () => {
    expect(svg).toContain("@keyframes k1{0%,25%{translate:-120px 0px}75%,100%{translate:0px 0px}}");
    expect(svg).toContain(".m1{animation-name:k1}");
  });

  test("the rule that plays them", () => {
    expect(svg).toContain("animation-duration:2s;animation-iteration-count:infinite;");
    expect(svg).toContain("animation-timing-function:cubic-bezier(.23,1,.32,1)");
  });

  test("no script", () => {
    expect(svg).not.toContain("<script");
  });
});
