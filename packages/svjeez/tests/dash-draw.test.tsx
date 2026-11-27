import { describe, expect, test } from "bun:test";
import { Shape, circle, line, scene, span, track, type SceneElement } from "svjeez";
import { check, svg } from "svjeez/tools";

const make = (shape: () => SceneElement) =>
  scene({ size: [100, 100], duration: 2, title: "Test" }, shape);

const emit = (shape: () => SceneElement): string => svg.emit(make(shape));

const dashed = { color: "#FF0000" as const, width: 2, dash: [9, 7] };

describe("dashed stroke with draw or trim", () => {
  test("draw reveals the dashed stroke through a mask of the same path, solid and animated", () => {
    const out = emit(() => (
      <Shape geometry={line([0, 0], [80, 0])} stroke={dashed} draw={track(0).to(1, span(0, 1.4))} />
    ));

    expect(out).toMatch(/<mask id="m\d*"[^>]*>\s*<line [^>]*stroke="#FFFFFF"[^>]*class="a m\d+"/);
    expect(out).not.toMatch(/<mask[^]*stroke-dasharray="9 7"[^]*<\/mask>/);
    expect(out).toMatch(
      /<line [^>]*stroke="#FF0000"[^>]*stroke-dasharray="9 7" mask="url\(#m\d*\)"\/>/,
    );
    expect(out).toContain("stroke-dashoffset:1");
  });

  test("trim reveals the dashed stroke the same way", () => {
    const out = emit(() => (
      <Shape
        geometry={line([0, 0], [80, 0])}
        stroke={dashed}
        trim={track<[number, number]>([0, 0]).to([0, 1], span(0, 1.4))}
      />
    ));

    expect(out).toMatch(/<mask id="m\d*"[^>]*>\s*<line [^>]*stroke="#FFFFFF"[^>]*class="a m\d+"/);
    expect(out).toMatch(/stroke-dasharray="9 7" mask="url\(#m\d*\)"/);
  });

  test("a dashOffset can march the dashes while draw reveals them", () => {
    const out = emit(() => (
      <Shape
        geometry={circle(10)}
        at={[50, 50]}
        stroke={{ ...dashed, dashOffset: track(0).to(16, span(0, 2)) }}
        draw={track(0).to(1, span(0, 1.4))}
      />
    ));

    const mask = /<mask[^]*?<\/mask>/.exec(out)![0];

    expect(mask).not.toContain('stroke-dasharray="9 7"');
    expect(out).toMatch(/stroke-dasharray="9 7"[^>]*mask="url/);
    expect(out.match(/stroke-dashoffset:16/g)?.length).toBeGreaterThan(0);
  });

  test("a still trim with a dashOffset keeps the offset in the dashed stroke", () => {
    const out = emit(() => (
      <Shape
        geometry={line([0, 0], [80, 0])}
        stroke={{ ...dashed, dashOffset: track(0).to(16, span(0, 2)) }}
        trim={[0, 0.5]}
      />
    ));

    expect(out).toMatch(/<mask/);
    expect(out).toContain('stroke-dasharray="9 7"');
  });

  test("a draw without dash writes no mask", () => {
    const out = emit(() => (
      <Shape
        geometry={line([0, 0], [80, 0])}
        stroke={{ color: "#FF0000" }}
        draw={track(0).to(1, span(0, 1.4))}
      />
    ));

    expect(out).not.toContain("<mask");
    expect(out).toContain('pathLength="1" stroke-dasharray="1 2"');
  });

  test("check reports no errors", () => {
    const model = make(() => (
      <Shape
        geometry={line([0, 0], [80, 0])}
        stroke={{ ...dashed, dashOffset: track(0).to(16, span(0, 2)) }}
        draw={track(0).to(1, span(0, 1.4))}
      />
    ));

    expect(check(model).problems.filter((one) => one.severity === "error")).toEqual([]);
  });
});
