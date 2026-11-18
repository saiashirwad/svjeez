import { describe, expect, test } from "bun:test";
import { Shape, ease, pathData, sampled, scene, span, track, type SceneElement } from "svjeez";
import { svg } from "svjeez/tools";
import { blendPaths, commandsOf, matchPaths } from "../src/paths";

const emit = (build: () => SceneElement, reducedMotion?: number | false) =>
  svg.emit(
    scene(
      {
        size: [100, 100],
        duration: 4,
        title: "Test",
        ...(reducedMotion !== undefined && { reducedMotion }),
      },
      build,
    ),
  );

const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

/** The path data an `<animate attributeName="d">` moves through. */
const morphs = (out: string): string[] =>
  /attributeName="d" values="([^"]*)"/.exec(out)?.[1]?.split(";") ?? [];

describe("matchPaths", () => {
  test("rewrites shapes with different commands to the same commands", () => {
    const [square, circle, star] = matchPaths([
      "M0 0H10V10H0Z",
      "M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z",
      "m5 0 2 3h3l-2 3 1 4-4-2-4 2 1-4-2-3h3z",
    ]);

    expect(commands(square!)).toBe(commands(circle!));
    expect(commands(circle!)).toBe(commands(star!));
  });

  test("grows a missing subpath from a point", () => {
    const [one, two] = matchPaths(["M0 0H10V10Z", "M0 0H10V10ZM20 20H30V30Z"]);

    expect(one!.match(/M/g)).toHaveLength(2);
    expect(commands(one!)).toBe(commands(two!));
    expect(one!).toContain("M25 25");
  });

  test("keeps the corners of a polygon it splits", () => {
    const [square] = matchPaths(["M0 0H10V10H0Z", "M0 0L1 0L2 0L3 0L4 0L5 0L6 0L7 0L8 0Z"]);

    for (const corner of ["10 0", "10 10", "0 10"]) expect(square).toContain(corner);
  });
});

describe("the d channel", () => {
  const square = "M0 0H10V10Z";
  const triangle = "M5 0L10 10H0Z";

  test("animates through SMIL with a still twin for reduced motion", () => {
    const out = emit(() => (
      <Shape geometry={track(pathData(square)).to(pathData(triangle), span(1, 1))} fill="#000000" />
    ));

    expect(out).toContain('attributeName="d"');
    expect(new Set(morphs(out).map(commands)).size).toBe(1);
    expect(out).toMatch(/<path[^>]*class="[^"]*ds"[^>]*display="none"/);
    expect(out).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*dm\{display:none\}/);
  });

  test("the still twin draws the shape the morph has reached at the still moment", () => {
    const out = emit(
      () => (
        <Shape
          geometry={track(pathData("M0 0H10")).to(pathData("M0 10H20"), span(1, 2), ease.linear)}
          stroke={{ color: "#000000" }}
        />
      ),
      2,
    );

    expect(out).toMatch(/<path[^>]*d="M0 5h15"[^>]*class="[^"]*ds"/);
  });

  test("needs no twin when reduced motion is off", () => {
    const out = emit(
      () => (
        <Shape
          geometry={track(pathData(square)).to(pathData(triangle), span(0, 1))}
          fill="#000000"
        />
      ),
      false,
    );

    expect(out).toContain('attributeName="d"');
    expect(out).not.toContain('display="none"');
  });
});

describe("sampled with path data", () => {
  test("keeps few keys for a shape that changes steadily", () => {
    const out = emit(() => (
      <Shape
        geometry={sampled((t) => pathData(`M0 0L${5 + 10 * t} 5`), span(0, 4), { tolerance: 0.1 })}
        stroke={{ color: "#000000" }}
      />
    ));

    expect(morphs(out)).toEqual(["M0 0l5 5", "M0 0l45 5"]);
  });

  test("rejects samples with a different structure", () => {
    expect(() =>
      sampled((t) => pathData(t < 1 ? "M0 0L1 1" : "M0 0L1 1L2 2"), span(0, 2), {
        tolerance: 1,
      }),
    ).toThrow("sampled() returned geometry at t=1 that doesn't match the first sample");
  });
});

describe("blendPaths", () => {
  test("reads packed arc flags as two flags", () => {
    expect(blendPaths("M0 0a5 5 0 1010 0", "M10 0a5 5 0 1010 0", 0.5)).toBe("M5 0a5 5 0 1 0 10 0");
    expect(commandsOf("M0 0a5 5 0 1010 0")).toBe("M##a#######");
  });
});
