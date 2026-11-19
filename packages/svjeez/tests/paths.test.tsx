import { describe, expect, test } from "bun:test";
import { Shape, ease, path, sampled, scene, span, track, type SceneElement } from "svjeez";
import { svg } from "svjeez/tools";
import { contoursOf } from "../src/model/geometry";
import { blendPaths, commandsOf, matchRings, ringsOf, type Ring } from "../src/model/paths";

const emit = (build: () => SceneElement, still?: number | false) =>
  svg.emit(
    scene(
      {
        size: [100, 100],
        duration: 4,
        title: "Test",
        ...(still !== undefined && { still }),
      },
      build,
    ),
  );

const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

const morphs = (out: string): string[] =>
  /attributeName="d" values="([^"]*)"/.exec(out)?.[1]?.split(";") ?? [];

const shape = (rings: readonly Ring[]) => rings.map((ring) => [ring.curves.length, ring.closed]);

const ends = (ring: Ring) => ring.curves.map(([, , to]) => to.join(" "));

test("paths, parsed commands, and normalized lines use the same cubic segments", () => {
  const from = [-3, 2] as const;
  const to = [8, -4] as const;
  const drawn = path().moveTo(from).lineTo(to).quadTo([11, 9], [16, 3]).close();
  const parsed = ringsOf("M-3 2L8 -4Q11 9 16 3Z");
  const line = contoursOf({ kind: "line", from, to });

  expect(drawn.contours).toEqual(parsed);
  expect(line[0]?.curves[0]).toEqual(parsed[0]?.curves[0]);
});

describe("matchRings", () => {
  test("gives shapes with different commands the same rings and curve counts", () => {
    const [square, circle, star] = matchRings(
      [
        "M0 0H10V10H0Z",
        "M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z",
        "m5 0 2 3h3l-2 3 1 4-4-2-4 2 1-4-2-3h3z",
      ].map(ringsOf),
    );

    expect(shape(square!)).toEqual(shape(circle!));
    expect(shape(circle!)).toEqual(shape(star!));
  });

  test("grows a missing ring from a point", () => {
    const [one, two] = matchRings(["M0 0H10V10Z", "M0 0H10V10ZM20 20H30V30Z"].map(ringsOf));

    expect(one).toHaveLength(2);
    expect(shape(one!)).toEqual(shape(two!));
    expect(one![1]!.start).toEqual([25, 25]);
  });

  test("keeps the corners of a polygon it splits", () => {
    const [square] = matchRings(
      ["M0 0H10V10H0Z", "M0 0L1 0L2 0L3 0L4 0L5 0L6 0L7 0L8 0Z"].map(ringsOf),
    );

    for (const corner of ["10 0", "10 10", "0 10"]) expect(ends(square![0]!)).toContain(corner);
  });
});

describe("the d channel", () => {
  const square = "M0 0H10V10Z";
  const triangle = "M5 0L10 10H0Z";

  test("animates through SMIL with a still twin for reduced motion", () => {
    const out = emit(() => (
      <Shape
        geometry={track(path.parse(square)).to(path.parse(triangle), span(1, 1))}
        fill="#000000"
      />
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
          geometry={track(path.parse("M0 0H10")).to(
            path.parse("M0 10H20"),
            span(1, 2),
            ease.linear,
          )}
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
          geometry={track(path.parse(square)).to(path.parse(triangle), span(0, 1))}
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
        geometry={sampled((t) => path.parse(`M0 0L${5 + 10 * t} 5`), span(0, 4), {
          tolerance: 0.1,
        })}
        stroke={{ color: "#000000" }}
      />
    ));

    expect(morphs(out)).toEqual(["M0 0l5 5", "M0 0l45 5"]);
  });

  test("rejects samples with a different structure", () => {
    expect(() =>
      sampled((t) => path.parse(t < 1 ? "M0 0L1 1" : "M0 0L1 1L2 2"), span(0, 2), {
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
