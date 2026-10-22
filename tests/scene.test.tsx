import { describe, expect, test } from "bun:test";
import { Scene, anim, revealWindow, type SvgNode } from "svg-motion";

const Badge = ({ label, x }: { label: string; x: number }): SvgNode => (
  <g>
    <circle cx={x} cy={10} r={4} fill="#a3b9a0" />
    <text x={x + 8} y={13} class="ui">
      {label}
    </text>
  </g>
);

describe("jsx scene", () => {
  test("resolves animation metadata into a class and keyframes", () => {
    const doc = new Scene({ width: 200, height: 100, duration: 10, title: "Test", desc: "A test scene." });
    doc.add(
      <g animation={anim("card", revealWindow({ in: [1, 2], out: [8, 9], from: { opacity: 0, y: 8 }, to: { opacity: 1, y: 0 } }))}>
        <rect x={10} y={10} width={50} height={20} fill="#111" />
      </g>,
    );
    const svg = doc.render();
    expect(svg).toContain('<g class="a a-card">');
    expect(svg).toContain("@keyframes card{");
    expect(svg).toContain(".a-card{animation-name:card}");
    expect(svg).not.toContain("animation={");
    expect(svg).not.toContain('animation="');
    expect(svg).toContain('<desc id="d">A test scene.</desc>');
    expect(svg).toContain("prefers-reduced-motion");
  });

  test("composes custom components and fragments", () => {
    const doc = new Scene({ width: 100, height: 100, duration: 5, title: "Components" });
    doc.add(
      <>
        <Badge label="Scout" x={10} />
        <Badge label="Atlas" x={40} />
      </>,
    );
    const output = doc.render();
    expect(output.match(/Scout/g)?.length).toBe(1);
    expect(output.match(/Atlas/g)?.length).toBe(1);
    expect(output).toContain('class="ui"');
  });

  test("includes ambient CSS and a custom reduced-motion hold", () => {
    const doc = new Scene({
      width: 100,
      height: 100,
      duration: 8,
      title: "Ambient",
      ambientCss: "@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}} .blink{animation:blink 1s infinite}",
      reducedMotion: { at: 6, selector: ".a, .blink" },
    });
    doc.add(<rect x={1} y={1} width={10} height={10} class="blink" />);
    const output = doc.render();
    expect(output).toContain("@keyframes blink");
    expect(output).toContain("animation-delay:-6s!important");
    expect(output).toContain(".a, .blink{");
  });

  test("fails validation on duplicate ids", () => {
    const doc = new Scene({ width: 100, height: 100, duration: 5, title: "Dupes" });
    doc.add(
      <g>
        <rect id="x" width={10} height={10} />
        <rect id="x" width={10} height={10} />
      </g>,
    );
    expect(() => doc.render()).toThrow(/Duplicate id/);
  });

  test("fails validation on a missing url reference", () => {
    const doc = new Scene({ width: 100, height: 100, duration: 5, title: "Refs" });
    doc.add(<rect width={10} height={10} fill="url(#missing)" />);
    expect(() => doc.render()).toThrow(/url\(#missing\)/);
  });
});
