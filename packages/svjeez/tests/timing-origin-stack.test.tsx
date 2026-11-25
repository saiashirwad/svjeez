/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  Stack,
  Text,
  ease,
  font,
  rect,
  scene,
  span,
  timeAt,
  track,
  type Vec,
} from "svjeez";
import { check, describe as describeScene, type Model } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts";

const regular = await font.load(fontFixture("ABeeZee-Regular"));

describe("timing helpers: open-span springs, loop phase, ease.at, timeAt, distribute, pace", () => {
  test("open-span spring automatically uses spring.settle", () => {
    const pop = ease.spring({ stiffness: 260, damping: 14 });
    const scale = track(0).to(1, span(0.5), pop);

    expect(scale.span.start).toBeCloseTo(0.5, 5);
    expect(scale.span.over).toBeCloseTo(pop.settle, 5);

    const model = scene({ size: [100, 100], duration: 4, loop: false, title: "Spring" }, () => (
      <Group>
        <Shape geometry={rect(20, 20)} at={[40, 40]} fill="#111111" scale={scale} />
      </Group>
    ));

    expect(check(model).problems.filter((p) => p.severity === "error")).toEqual([]);
  });

  test("loop(period, { phase }) starts a looping track mid-cycle", () => {
    const base = track(0).to(100, span(0, 4), ease.linear).loop(4);
    const shifted = track(0).to(100, span(0, 4), ease.linear).loop(4, { phase: 1 });

    const model = scene({ size: [200, 100], duration: 4, title: "Phase" }, () => (
      <Group>
        <Shape key="a" geometry={rect(10, 10)} at={base.map((x): Vec => [x, 10])} fill="#111111" />
        <Shape
          key="b"
          geometry={rect(10, 10)}
          at={shifted.map((x): Vec => [x, 40])}
          fill="#111111"
        />
      </Group>
    ));

    const atZero = describeScene(model, [0]).frames[0]!.nodes;
    const nodeA = atZero.find((n) => n.key === "a")!;
    const nodeB = atZero.find((n) => n.key === "b")!;

    expect(nodeA.box[0]).toBeCloseTo(0, 1);
    expect(nodeB.box[0]).toBeCloseTo(25, 1);
  });

  test("ease.at evaluates built-in, bezier, steps and spring curves", () => {
    expect(ease.at(ease.linear, 0.25)).toBeCloseTo(0.25, 6);
    expect(ease.at(ease.out, 0)).toBe(0);
    expect(ease.at(ease.out, 1)).toBe(1);
    expect(ease.at(ease.out, 0.5)).toBeGreaterThan(0.5);
    expect(ease.at(ease.in, 0.5)).toBeLessThan(0.5);
    expect(ease.at(ease.steps(4), 0.3)).toBeCloseTo(0.25, 6);

    const spring = ease.spring({ stiffness: 220, damping: 14 });
    expect(ease.at(spring, 0)).toBeCloseTo(0, 5);
    expect(ease.at(spring, 1)).toBeCloseTo(1, 2);
  });

  test("timeAt finds when a track crosses a target value", () => {
    const linearTrack = track(0).to(100, span(1, 2), ease.linear);
    expect(timeAt(linearTrack, 50)).toBeCloseTo(2, 4);
    expect(timeAt(linearTrack, 0)).toBeCloseTo(0, 4);
    expect(timeAt(linearTrack, 150)).toBeUndefined();

    const easedTrack = track(0).to(1, span(0.5, 2), ease.inOut);
    const t = timeAt(easedTrack, 0.75)!;
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(2.5);
    expect(ease.at(ease.inOut, (t - 0.5) / 2)).toBeCloseTo(0.75, 4);
  });

  test("span.distribute and span.pace schedule data-driven lists", () => {
    const window = span(1, 5);
    const dist = window.distribute(3, 1);

    expect(dist).toHaveLength(3);
    expect(dist[0]!.start).toBeCloseTo(1, 5);
    expect(dist[1]!.start).toBeCloseTo(3, 5);
    expect(dist[2]!.start).toBeCloseTo(5, 5);
    expect(dist[2]!.end).toBeCloseTo(6, 5);

    const paced = window.pace([1, 2, 1], { gap: 0.5 });
    expect(paced).toHaveLength(3);
    expect(paced[0]!.over).toBeCloseTo(1, 5);
    expect(paced[1]!.over).toBeCloseTo(2, 5);
    expect(paced[2]!.over).toBeCloseTo(1, 5);
    expect(paced[2]!.end).toBeCloseTo(6, 5);
  });
});

describe("origin.frame and Stack baseline / negative gap / child-named errors", () => {
  test("origin={{ frame: [x, y] }} pivots around a point in parent coordinates", () => {
    const model = scene({ size: [200, 200], duration: 1, title: "OriginFrame" }, () => (
      <Group>
        <Shape
          key="arm"
          geometry={rect(20, 40)}
          at={[50, 30]}
          origin={{ frame: [60, 10] }}
          rotate={180}
          fill="#111111"
        />
      </Group>
    ));

    const node = model.root.children[0]!;
    expect(node.origin).toEqual([10, -20]);
  });

  test("Stack direction='row' align='baseline' aligns text baselines", () => {
    const model = scene({ size: [300, 120], duration: 1, title: "Baseline" }, () => (
      <Stack key="row" direction="row" gap={8} align="baseline" at={[10, 10]}>
        <Text key="big" font={regular} size={40} fill="#000000">
          24
        </Text>
        <Text key="small" font={regular} size={16} fill="#000000">
          NOV
        </Text>
      </Stack>
    ));

    const row = model.root.children[0]!;

    if (row.kind !== "group") throw new Error("expected group");

    const big = row.children.find((c): c is Model.TextNode => c.key === "row/big")!;
    const small = row.children.find((c): c is Model.TextNode => c.key === "row/small")!;

    if (!Array.isArray(big.at) || !Array.isArray(small.at)) throw new Error("expected static at");
    const bigY = big.at[1] + big.lines[0]!.at[1];
    const smallY = small.at[1] + small.lines[0]!.at[1];

    expect(bigY).toBeCloseTo(smallY, 4);
  });

  test("Stack accepts negative gap and names widest child on width overflow", () => {
    const tight = scene({ size: [200, 100], duration: 1, title: "NegGap" }, () => (
      <Stack key="col" gap={-4} at={[10, 10]}>
        <Shape key="a" geometry={rect(40, 20)} fill="#111111" />
        <Shape key="b" geometry={rect(40, 20)} fill="#222222" />
      </Stack>
    ));

    expect(check(tight).problems.filter((p) => p.code === "layout-overlap")).toEqual([]);

    expect(() =>
      scene({ size: [200, 100], duration: 1, title: "Overflow" }, () => (
        <Stack key="col" width={50}>
          <Shape key="narrow" geometry={rect(20, 10)} fill="#111111" />
          <Shape key="wide" geometry={rect(80, 10)} fill="#222222" />
        </Stack>
      )),
    ).toThrow(/widest child is <Shape> "wide" at 80 wide/);
  });
});
