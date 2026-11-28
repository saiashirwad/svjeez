import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  blur,
  circle,
  ease,
  emboss,
  noise,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { check, type Problem } from "svjeez/tools";
import { BUDGET, TURNED, workOf } from "../src/check/inspect-cost";
import { entriesOf, framesOf, hiddenOf, momentsOf, sourcesOf } from "../src/check/survey";
import type { Scene } from "../src/model/ir";
import { startTrace, stopTrace } from "../src/svg/traced";

/** Big enough that a handful of noise layers fills a frame's budget. */
const [W, H] = [2000, 1500];

/** Builds with sources traced, as the CLI does, so messages can name where a node was written. */
const make = (build: () => SceneElement, duration = 4): Scene => {
  startTrace({ within: import.meta.dir });

  try {
    return scene({ size: [W, H], duration, title: "Filters" }, build);
  } finally {
    stopTrace();
  }
};

const filters = (model: Scene): Problem[] =>
  check(model).problems.filter((problem) => problem.code === "moving-filter");

const work = (model: Scene) => {
  const entries = entriesOf(model);

  return workOf({
    scene: model,
    entries,
    sources: sourcesOf(model),
    frames: framesOf(model, momentsOf(model)),
    hidden: new Map(entries.map((entry) => [entry.node.key, hiddenOf(entry, model.duration)])),
    gone: new Set(),
    out: [],
  });
};

const swing = (to: number) =>
  track(1).to(to, span(0, 2), ease.linear).to(1, span(2, 2), ease.linear).loop(4);

const slide = (from: Vec, to: Vec) =>
  track<Vec>(from).to(to, span(0, 2), ease.linear).to(from, span(2, 2), ease.linear).loop(4);

/** A canvas-sized layer textured with noise: the costliest still layer there is. */
const Grain = ({ seed = 1 }: { readonly seed?: number }) => (
  <Shape
    geometry={rect(W, H)}
    fill={noise({ frequency: 0.02, seed, ramp: ["#20180F", "#C8A878"] })}
  />
);

const grains = (count: number) => Array.from({ length: count }, (_, i) => <Grain seed={i + 1} />);

describe("moving-filter causes", () => {
  test("content moving inside a filter re-runs it, named with where it was written", () => {
    const [problem, ...rest] = filters(
      make(() => (
        <Group effects={[emboss()]}>
          <Shape geometry={rect(40, 40)} fill="#FFFFFF" at={slide([40, 40], [120, 40])} />
        </Group>
      )),
    );

    expect(rest).toEqual([]);
    expect(problem!.severity).toBe("info");
    expect(problem!.message).toMatch(/<Shape> at filter-work\.test\.tsx:\d+ inside it moves\.$/);
    expect(problem!.fix).toContain("Keep the filtered layer still and move something unfiltered");
  });

  test("a transform animated on an ancestor re-runs every filter under it", () => {
    const [problem] = filters(
      make(() => (
        <Group scale={swing(1.04)} origin="own">
          <Group effects={[emboss()]}>
            <Shape geometry={rect(200, 100)} fill="#FFFFFF" at={[200, 150]} />
          </Group>
        </Group>
      )),
    );

    expect(problem!.message).toMatch(
      /<Group> at filter-work\.test\.tsx:\d+ above it animates its scale, so the filter is rastered again/,
    );
    expect(problem!.fix).toContain("Move the transform below the filter");
    expect(problem!.related?.length).toBe(1);
  });

  test("moving a filtered layer, or a group above it, is free", () => {
    expect(
      filters(
        make(() => (
          <Group offset={slide([0, 0], [40, 0])}>
            <Group effects={[emboss()]} at={slide([200, 150], [220, 150])}>
              <Shape geometry={rect(200, 100)} fill="#FFFFFF" />
            </Group>
          </Group>
        )),
      ),
    ).toEqual([]);
  });

  test("a full-frame layer moving over a filtered one re-runs it where it repaints", () => {
    const [problem, ...rest] = filters(
      make(() => (
        <Group>
          {grains(2)}
          <Shape geometry={rect(W, H)} fill="#6F849A40" at={slide([0, 0], [0, 20])} />
        </Group>
      )),
    );

    expect(problem!.message).toMatch(/<Shape> at filter-work\.test\.tsx:\d+ moves over its region/);
    expect(problem!.fix).toContain("Keep large motion off filtered layers");
    // Both layers are written at one place, so they fold into one problem.
    expect(problem!.message).toContain("and 1 more written at the same place");
    expect(rest).toEqual([]);
  });

  test("a small mover over a filtered layer is not worth a word", () => {
    expect(
      filters(
        make(() => (
          <Group>
            <Grain />
            <Shape geometry={circle(4)} fill="#FFFFFF" at={slide([20, 20], [40, 20])} />
          </Group>
        )),
      ),
    ).toEqual([]);
  });

  test("motion inside a filter costs the filtered layers under it far more than plain motion", () => {
    const over = (filtered: boolean) =>
      work(
        make(() => (
          <Group>
            <Grain />
            <Group effects={filtered ? [blur(2)] : []}>
              <Shape geometry={rect(100, 100)} fill="#FFFFFF40" at={[200, 150]} />
              <Shape geometry={rect(4, 4)} fill="#FFFFFF" at={slide([180, 150], [220, 150])} />
            </Group>
          </Group>
        )),
      ).sustained;

    expect(over(true)).toBeGreaterThan(over(false) * 5);
  });

  test("a full-frame layer moving under a filtered one leaves it alone", () => {
    expect(
      filters(
        make(() => (
          <Group>
            <Shape geometry={rect(W, H)} fill="#6F849A" at={slide([0, 0], [0, 20])} />
            <Grain />
          </Group>
        )),
      ),
    ).toEqual([]);
  });

  test("a filter turned on the canvas costs more than a square one", () => {
    const turned = (rotate: number) =>
      work(
        make(() => (
          <Group scale={swing(1.04)} origin="own">
            <Group rotate={rotate} origin={{ frame: [W / 2, H / 2] }}>
              <Grain />
            </Group>
          </Group>
        )),
      ).sustained;

    expect(turned(30) / turned(0)).toBeGreaterThan(TURNED * 0.8);
    // A quarter turn stays square to the canvas: it costs only for the 1500×1500 it still covers.
    expect(turned(90) / turned(0)).toBeCloseTo(0.75, 1);
  });

  test("a filter is not counted while a faded group around it is culled", () => {
    const model = make(
      () => (
        <Group opacity={track(1).to(0, span(1, 0.5)).to(1, span(6, 0.5))}>
          <Group effects={[emboss()]}>
            <Shape geometry={rect(40, 40)} fill="#FFFFFF" at={slide([40, 40], [120, 40])} />
          </Group>
        </Group>
      ),
      8,
    );

    const found = work(model);
    const filter = found.filters[0]!;
    const counted = found.times.filter((_, i) => filter.work[i]! > 0);

    expect(counted.some((t) => t > 2.5 && t < 5)).toBe(false);
    expect(counted.some((t) => t < 1)).toBe(true);
  });
});

describe("moving-filter budget", () => {
  const stack = (count: number) =>
    make(() => (
      <Group scale={swing(1.04)} origin="own">
        {grains(count)}
      </Group>
    ));

  const one = work(stack(1)).sustained;
  const fits = Math.floor(BUDGET / one);

  test("work adds up over the filters a frame re-runs", () => {
    expect(work(stack(3)).sustained).toBeCloseTo(3 * one, -3);
  });

  test("under the budget is info, past it a warning naming the work", () => {
    expect(fits).toBeGreaterThan(1);
    expect(filters(stack(fits)).map((problem) => problem.severity)).toEqual(["info"]);

    const over = filters(stack(fits + 1));

    expect(over.map((problem) => problem.severity)).toEqual(["warning"]);
    expect(over[0]!.message).toMatch(
      /^<Group> animates its scale above \d+ filters \(noise\) from 0s to 4s, so Chromium rasters them again every frame: [\d.]+M units² of filter raster a frame, past the 21M a 60 fps frame has room for, 100% of it\.$/,
    );
  });

  test("a spike shorter than the sustain window stays info", () => {
    const model = make(() => (
      <Group scale={track(1).to(1.04, span(1, 0.2), ease.linear)} origin="own">
        {grains(fits + 4)}
      </Group>
    ));

    expect(filters(model).map((problem) => problem.severity)).toEqual(["info"]);
  });
});
