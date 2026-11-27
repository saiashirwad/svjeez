import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Sequence,
  Shape,
  circle,
  ease,
  enter,
  exit,
  path,
  rect,
  ref,
  ride,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { check, isLane, svg, type Model } from "svjeez/tools";
import { darkOf } from "../src/model/dark";
import { blendVec, valueAt } from "../src/model/sample";

const red = "#FF0000";

/** A point that goes round a 1 s loop. */
const looping = (from: Vec, to: Vec) =>
  track<Vec>(from).to(to, span(0, 0.5), ease.inOut).to(from, span(0.5, 0.5), ease.inOut).loop(1);

/** Two beads riding 1 s loops, with an arrow between them. */
const Beads = (): SceneElement => {
  const [a, b] = [ref(), ref()];

  return (
    <Group>
      <Shape
        ref={a}
        geometry={circle(2)}
        fill={red}
        motion={{ offset: looping([20, 20], [30, 40]) }}
      />
      <Shape
        ref={b}
        geometry={circle(2)}
        fill={red}
        motion={{ offset: looping([150, 60], [170, 30]) }}
      />
      <Arrow
        key="arrow"
        from={a.center}
        to={b.center}
        bend={0.2}
        inset={4}
        stroke={{ color: red }}
      />
    </Group>
  );
};

/** A shot of 5 s that fades in and out, as a film's shots do. */
const Shot = ({ start, children }: { start: number; children: SceneElement }) => (
  <Sequence when={span(start, 5)}>
    <Group motion={[enter(span(0, 0.5)), exit(span(4.5, 0.5))]}>{children}</Group>
  </Sequence>
);

const film = (duration: number, shot: SceneElement): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Film", loop: false }, () => (
    <Group>
      <Shape geometry={rect(200, 100)} fill="#FFFFFF" />
      <Shot start={2}>{shot}</Shot>
    </Group>
  ));

const find = (node: Model.SceneNode, key: string): Model.SceneNode | undefined =>
  node.key.endsWith(key)
    ? node
    : node.kind === "group"
      ? node.children.map((child) => find(child, key)).find(Boolean)
      : undefined;

describe("what is emitted scales with what is on screen", () => {
  test("an arrow between looped ends loops with them", () => {
    const model = scene({ size: [200, 100], duration: 10, title: "Loop" }, () => <Beads />);
    const arrow = find(model.root, "arrow")!;

    if (arrow.kind !== "group") throw new Error("an arrow is a group");

    // SAFETY: an arrow lowers to a group of its shaft, then its head, both shapes.
    const [shaft, head] = arrow.children as Model.ShapeNode[];

    const lanes = [
      shaft!.geometry,
      ...shaft!.layers.map((l) => l.rotate),
      ...head!.layers.map((l) => l.offset),
    ];

    expect(lanes.some(isLane)).toBe(true);

    for (const lane of lanes) if (isLane(lane)) expect(lane.period).toBe(1);

    const offset = head!.layers[1]!.offset;

    for (const t of [0.2, 0.55, 0.9])
      expect(valueAt(offset, t + 7, blendVec)[0]).toBeCloseTo(valueAt(offset, t, blendVec)[0], 6);

    expect(svg.emit(model).length).toBeLessThan(
      svg.emit(scene({ size: [200, 100], duration: 2, title: "Loop" }, () => <Beads />)).length *
        1.05,
    );
  });

  test("an arrow on looped beads inside a short sequence emits the same for a 10 s or a 100 s scene", () => {
    const [short, long] = [10, 100].map((duration) => svg.emit(film(duration, <Beads />)).length);

    expect(long! / short!).toBeLessThan(1.05);
  });

  test("a ride across a short sequence is motion, not a key every frame, however long the scene", () => {
    const route = path().moveTo([0, 50]).curveTo([60, 0], [140, 100], [200, 50]);

    const ridden = (
      <Shape
        key="rider"
        geometry={circle(3)}
        fill={red}
        motion={ride(route, track(0).to(1, span(0, 5), ease.linear), { turn: true })}
      />
    );

    const [short, long] = [film(10, ridden), film(100, ridden)];
    const offset = find(long.root, "rider")!.layers[0]!.offset;

    expect(isLane(offset) && offset.keys.length).toBeLessThan(60);

    expect(svg.emit(long).length / svg.emit(short).length).toBeLessThan(1.05);
  });

  test("a looped fade wraps back up each cycle instead of reading as hidden from its first wrap", () => {
    const fade = track(1).to(0, span(0, 1), ease.out).loop(1);

    const model = scene({ size: [200, 100], duration: 10, title: "Fade" }, () => (
      <Shape geometry={rect(10, 10)} fill={red} opacity={fade} />
    ));

    const opacity = model.root.children[0]!.layers[0]!.opacity;

    expect(darkOf(opacity, 10).every(([from, to]) => to - from < 1e-6)).toBe(true);
  });

  test("a looped ripple in a late shot is not reported never visible", () => {
    const ripple = (
      <Shape
        key="ripple"
        geometry={circle(10)}
        stroke={{ color: red, width: 2 }}
        scale={track(0.15).to(1, span(0, 1.4), ease.out).loop(1.4)}
        opacity={track(0.95).to(0, span(0, 1.4), ease.out).loop(1.4)}
      />
    );

    const model = scene({ size: [200, 100], duration: 14, title: "Rain", loop: false }, () => (
      <Group>
        <Shape geometry={rect(200, 100)} fill="#FFFFFF" />
        <Sequence when={span(7, 7)}>
          <Group motion={enter(span(0, 0.5))}>{ripple}</Group>
        </Sequence>
      </Group>
    ));

    expect(check(model).problems.filter((p) => p.code === "never-visible")).toEqual([]);
  });
});
