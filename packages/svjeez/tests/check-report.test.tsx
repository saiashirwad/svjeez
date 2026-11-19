import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Group, Shape, blur, circle, morph, rect, scene, span, track } from "svjeez";
import { check, svg, type LaneReport } from "svjeez/tools";
import { startTrace, stopTrace } from "../src/svg/traced";

const traced = <T,>(build: () => T): T => {
  startTrace({ within: import.meta.dir });

  try {
    return build();
  } finally {
    stopTrace();
  }
};

const model = traced(() =>
  scene({ size: [200, 100], duration: 4, title: "Lanes" }, () => (
    <Group>
      <Shape geometry={rect(200, 100)} fill="#111111" />
      <Shape
        key="fade"
        geometry={rect(20, 20)}
        fill="#FFFFFF"
        opacity={track(0).to(1, span(0.5, 1))}
      />
      {morph(
        <Shape key="blob" geometry={rect(40, 20)} fill="#FF0000" at={[60, 20]} />,
        <Shape key="blob" geometry={circle(12)} fill="#FF0000" at={[60, 20]} />,
        span(1, 1),
      )}
      <Shape
        key="glow"
        geometry={rect(20, 20)}
        fill="#00FF00"
        at={[140, 20]}
        effects={[blur(track(8).to(2, span(0, 2)))]}
      />
    </Group>
  )),
);

const find = (lanes: readonly LaneReport[], key: string, lane: string) =>
  lanes.find((each) => each.key === key && each.lane === lane);

describe("check(scene)", () => {
  test("reports every animated lane with its backend, source and spans", () => {
    const { lanes } = check(model);

    expect(find(lanes, "fade", "opacity")).toMatchObject({
      backend: "css",
      spans: [{ start: 0.5, over: 1 }],
      period: 4,
    });
    expect(find(lanes, "blob", "d")).toMatchObject({ backend: "smil" });
    expect(find(lanes, "glow", "stdDeviation")).toMatchObject({
      backend: "smil",
      spans: [{ start: 0, over: 2 }],
    });

    for (const key of ["fade", "blob", "glow"])
      expect(lanes.find((each) => each.key === key)?.source?.file).toBe(
        join(import.meta.dir, "check-report.test.tsx"),
      );
  });

  test("a lane written twice is reported once, and a still scene has none", () => {
    const names = check(model).lanes.map((each) => `${each.key} ${each.lane}`);

    expect(new Set(names).size).toBe(names.length);
    expect(
      check(
        scene({ size: [10, 10], duration: 1, title: "Still" }, () => (
          <Shape geometry={rect(4, 4)} fill="#000000" />
        )),
      ).lanes,
    ).toEqual([]);
  });

  test("emitting with onLane writes the same SVG as emitting without it", () => {
    const seen: LaneReport[] = [];

    expect(svg.emit(model, { onLane: (lane) => seen.push(lane) })).toBe(svg.emit(model));
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe("svjeez check", () => {
  const cli = (...flags: string[]) =>
    Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), "check", ...flags]);

  const file = join(import.meta.dir, "fixtures/check/lanes.tsx");

  test("prints the lanes block with one line per SMIL lane", () => {
    const out = cli(file).stdout.toString();

    expect(out).toMatch(/^lanes: \d+ css, 2 smil$/m);
    expect(out).toMatch(/^ {2}smil {2}d on <Shape> "blob" {2}.*lanes\.tsx:\d+$/m);
    expect(out).toMatch(/^ {2}smil {2}stdDeviation on <Shape> "glow" {2}.*lanes\.tsx:\d+$/m);
  });

  test("--json lists the same lanes, with sources as objects", () => {
    const report = JSON.parse(cli(file, "--json").stdout.toString());

    expect(Object.keys(report)).toEqual(["ok", "file", "scene", "problems", "lanes"]);
    expect(report.ok).toBe(true);
    expect(report.lanes.filter((lane: LaneReport) => lane.backend === "smil")).toHaveLength(2);
    expect(report.lanes[0].source).toEqual({
      file: expect.stringMatching(/lanes\.tsx$/),
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });
});
