import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Series,
  Shape,
  arc,
  ease,
  enter,
  exit,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import {
  SceneError,
  boxesOf,
  isLane,
  svg,
  valueAt,
  type Hex,
  type Model,
  type SeriesShare,
} from "svjeez/tools";
import { mixGeometry } from "../src/model/geometry";

const LENGTH = 4;

const made = (build: () => SceneElement, duration = 7): Model.Scene =>
  scene({ size: [400, 300], duration, title: "Share", loop: false, still: duration }, build);

const copies = (model: Model.Scene, key = "horizon"): Model.ShapeNode[] => {
  const out: Model.ShapeNode[] = [];

  const visit = (node: Model.SceneNode): void => {
    if (node.key.split("/").at(-1) === key && node.kind === "shape") out.push(node);

    if (node.kind === "group") node.children.forEach(visit);
  };

  visit(model.root);

  return out;
};

/** A shot that crossfades over `fade`, drawing a world (an arc of `radius`) in `color`. */
const shot = (
  radius: number,
  color: Hex,
  {
    start = 0,
    fade = 1,
    first = false,
    last = false,
    world,
  }: Partial<{
    start: number;
    fade: number;
    first: boolean;
    last: boolean;
    world: SceneElement;
  }> = {},
) => (
  <Sequence when={span(start, LENGTH)}>
    <Group
      motion={[
        !first && enter(span(0, fade), { curve: ease.inOut }),
        !last && exit(span(LENGTH - fade, fade), { curve: ease.inOut }),
      ]}
    >
      <Shape geometry={rect(400, 300)} fill="#F0EEE6" />
      {world ?? (
        <Shape
          key="horizon"
          geometry={arc({ radius, start: -110, sweep: 40 })}
          offset={[200, 100 + radius]}
          stroke={{ color, width: 4 }}
        />
      )}
      <Shape geometry={rect(20, 20)} at={[190, 40]} fill="#141413" />
    </Group>
  </Sequence>
);

const film = (
  share?: string | SeriesShare,
  gap = -1,
  second: Partial<Parameters<typeof shot>[2]> = {},
) => (
  <Series gap={gap} {...(share !== undefined && { share })}>
    {shot(100, "#D97757", { first: true, fade: Math.max(0.5, -gap) })}
    {shot(400, "#141413", { last: true, fade: Math.max(0.5, -gap), ...second })}
  </Series>
);

const expectClose = (a: Model.Box, b: Model.Box, within = 1e-6): void => {
  for (const side of ["x", "y", "width", "height"] as const)
    expect(Math.abs(a[side] - b[side])).toBeLessThanOrEqual(within);
};

const radiusAt = (node: Model.ShapeNode, t: number): number => {
  const geometry = valueAt(node.geometry, t, mixGeometry);

  if (geometry.kind !== "arc") throw new Error(`expected an arc, got ${geometry.kind}`);

  return geometry.radius;
};

describe("<Series share>", () => {
  test("both copies tween from one version to the next over the overlap, in step", () => {
    const [before, after] = copies(made(() => film("horizon")));

    for (const node of [before!, after!]) {
      expect(radiusAt(node, 2.9)).toBe(100);
      expect(radiusAt(node, 3.5)).toBeGreaterThan(100);
      expect(radiusAt(node, 3.5)).toBeLessThan(400);
      expect(radiusAt(node, 4.1)).toBe(400);
      expect(isLane(node.stroke!.color)).toBe(true);
      expect(isLane(node.at)).toBe(true);
    }

    expect(before!.geometry).toEqual(after!.geometry);
    expect(before!.stroke).toEqual(after!.stroke);
    expect(before!.key).not.toBe(after!.key);
  });

  test("a middle child's copy tweens in from the one before and out into the one after", () => {
    const model = made(
      () => (
        <Series gap={-1} share="horizon">
          {shot(100, "#D97757", { first: true })}
          {shot(400, "#141413")}
          {shot(200, "#2B6CB0", { last: true })}
        </Series>
      ),
      10,
    );

    const [, middle] = copies(model);

    expect(radiusAt(middle!, 2.9)).toBe(100);
    expect(radiusAt(middle!, 4.5)).toBe(400);
    expect(radiusAt(middle!, 6.5)).toBeLessThan(400);
    expect(radiusAt(middle!, 7.1)).toBe(200);
  });

  test("copies in parents that sit apart still tween as one: the tween runs in scene space", () => {
    const nested = (
      <Group offset={[30, -20]}>
        <Group scale={1.5} rotate={10} origin={[0, 0]}>
          <Shape
            key="horizon"
            geometry={arc({ radius: 300, start: -110, sweep: 40 })}
            offset={[80, 320]}
            stroke={{ color: "#141413", width: 4 }}
          />
        </Group>
      </Group>
    );

    const model = made(() => film("horizon", -1, { world: nested }));
    const [a, b] = copies(model).map((node) => node.key);
    const alone = made(() => film(undefined, -1, { world: nested }));

    for (const t of [3, 3.25, 3.5, 3.75, 4]) {
      const boxes = boxesOf(model, t);

      expectClose(boxes[a!]!, boxes[b!]!);
    }

    // Outside the seam each copy is where its own shot draws it.
    expectClose(boxesOf(model, 2)[a!]!, boxesOf(alone, 2)[a!]!);
    expectClose(boxesOf(model, 5)[b!]!, boxesOf(alone, 5)[b!]!);
  });

  test("a copy whose parent drifts over its shot follows the drift and still meets the other copy", () => {
    const drifting = (
      <Group offset={track<Vec>([6, 0]).to([-34, 15], span(0, LENGTH), ease.linear)}>
        <Shape
          key="horizon"
          geometry={arc({ radius: 400, start: -110, sweep: 40 })}
          offset={[200, 500]}
          stroke={{ color: "#141413", width: 4 }}
        />
      </Group>
    );

    const model = made(() => film("horizon", -1, { world: drifting }));
    const [a, b] = copies(model).map((node) => node.key);
    const alone = made(() => film(undefined, -1, { world: drifting }));

    for (const t of [3, 3.2, 3.5, 3.8, 4]) {
      const boxes = boxesOf(model, t);

      expectClose(boxes[a!]!, boxes[b!]!, 0.5);
    }

    for (const t of [4.5, 6]) expectClose(boxesOf(model, t)[b!]!, boxesOf(alone, t)[b!]!);
  });

  test("with no overlap the copies snap, unless an over gives the tween a span centered on the seam", () => {
    const [before, after] = copies(made(() => film("horizon", 0.2), 8.2));

    expect(isLane(before!.geometry)).toBe(false);
    expect(radiusAt(before!, 5)).toBe(100);
    expect(isLane(after!.geometry)).toBe(false);
    expect(radiusAt(after!, 0)).toBe(400);

    const [tweened] = copies(made(() => film({ keys: "horizon", over: 0.6 }, 0.2), 8.2));

    expect(radiusAt(tweened!, 3.79)).toBe(100);
    expect(radiusAt(tweened!, 4.1)).toBeGreaterThan(100);
    expect(radiusAt(tweened!, 4.41)).toBe(400);
  });

  test("copies that can't be matched are refused, with a fix", () => {
    const grouped = <Group key="horizon" />;

    expect(() => made(() => film("horizon", -1, { world: grouped }))).toThrow(SceneError);
    expect(() => made(() => film("horizon", -1, { world: grouped }))).toThrow(
      /<Series share="horizon"> can't tween "horizon" from child 1 into child 2/,
    );

    const dashed = (
      <Shape
        key="horizon"
        geometry={arc({ radius: 400, start: -110, sweep: 40 })}
        stroke={{ color: "#141413", width: 4, dash: [4, 4] }}
      />
    );

    expect(() => made(() => film("horizon", -1, { world: dashed }))).toThrow(
      /stroke's cap, join, dash.*Give the stroke the same style/,
    );

    expect(() => made(() => film("ground"))).toThrow(/finds a node keyed "ground" in no child/);
  });

  test("a series without share emits what it did", () => {
    const plain = svg.emit(made(() => film()));

    const written = svg.emit(
      made(() => (
        <>
          {shot(100, "#D97757", { first: true })}
          {shot(400, "#141413", { start: LENGTH - 1, last: true })}
        </>
      )),
    );

    expect(plain).toBe(written);
    expect(plain).not.toBe(svg.emit(made(() => film("horizon"))));
  });

  test("a shot is still culled outside its window, and no filter is added", () => {
    const out = svg.emit(made(() => film("horizon"), 7));
    const toggles = out.match(/<animateTransform\b[^>]*type="scale"[^>]*>/g) ?? [];

    // The first shot stops drawing half a second after it fades out; the second shows in the still frame, so stays.
    expect(toggles).toEqual([
      '<animateTransform attributeName="transform" type="scale" values="1;0" keyTimes="0;0.64286" calcMode="discrete" dur="7s" fill="freeze"/>',
    ]);
    expect(out).not.toContain("<filter");
  });
});
