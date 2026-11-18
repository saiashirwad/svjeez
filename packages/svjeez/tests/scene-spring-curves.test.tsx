/** @jsxImportSource svjeez/scene */
import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Sequence,
  Shape,
  boxesOf,
  circle,
  ease,
  isLane,
  morph,
  motion,
  placements,
  rect,
  ref,
  scene,
  span,
  svg,
  timeline,
  track,
  type Curve,
  type Model,
  type SceneElement,
  type Spanned,
  type Vec,
} from "svjeez/scene";
import { alongCurve, curveLength, splitCurve } from "../src/scene/curve";
import { blendVec, valueAt } from "../src/scene/sample";

/**
 * A spring that turns, written as curved keys (`Key.via`): fewer keys than straight ones, the same motion through
 * every cut, repeat, rewind and loop the steps make, and every reader of the lane agreeing with it.
 */

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [400, 300], duration, title: "Test" }, build);

const red = "#ff0000";
const swing = ease.spring({ stiffness: 150, damping: 11 });
const loose = ease.spring({ stiffness: 120, damping: 6 });

const laneOf = <T,>(value: Model.Animated<T>): Model.Lane<T> => {
  if (!isLane(value)) throw new Error("expected a lane");

  return value;
};

const all = (model: Model.Scene): Model.SceneNode[] => {
  const out: Model.SceneNode[] = [];

  const visit = (node: Model.SceneNode): void => {
    out.push(node);

    if (node.kind === "group") node.children.forEach(visit);
  };

  visit(model.root);

  return out;
};

const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const node = all(model).find((one) => one.key === key || one.key.endsWith(`/${key}`));

  if (!node) throw new Error(`no node "${key}"`);

  return node;
};

const cost = (lane: Model.Lane<Vec>): number =>
  lane.keys.reduce((sum, key) => sum + (key.via ? 1.5 : 1), 0);

const within = (lane: Model.Lane<Vec>): boolean =>
  lane.keys.every(
    (key) =>
      key.ease?.kind !== "bezier" ||
      [key.ease.points[1], key.ease.points[3]].every((y) => y >= 0 && y <= 1),
  );

type Leg = readonly [to: Vec, when: Spanned, curve: Curve];

interface Route {
  readonly start: Vec;
  readonly legs: readonly Leg[];
  readonly finish?: {
    readonly repeat?: { readonly until: number };
    readonly rewind?: number;
    readonly loop?: number;
  };
  /** The Sequence the dot sits in starts here. */
  readonly inside?: number;
  readonly duration?: number;
}

/**
 * The same route as `at`, which may curve, and as a motion layer's `offset`, which never does: two fittings of one
 * motion, each within a small part of the distance of the simulated spring.
 */
const both = ({ start, legs, finish = {}, inside, duration = 4 }: Route) => {
  let at = track<Vec>(start);
  let layer = motion({ offset: start });

  for (const [to, when, curve] of legs) {
    at = at.to(to, when, curve);
    layer = layer.to({ offset: to }, when, curve);
  }

  if (finish.repeat) [at, layer] = [at.repeat(finish.repeat), layer.repeat(finish.repeat)];

  if (finish.rewind !== undefined)
    [at, layer] = [at.rewind(finish.rewind, swing), layer.rewind(finish.rewind, swing)];

  if (finish.loop !== undefined) [at, layer] = [at.loop(finish.loop), layer.loop(finish.loop)];

  const placed = (dot: SceneElement): SceneElement =>
    inside === undefined ? dot : <Sequence at={inside}>{dot}</Sequence>;

  const model = made(
    () => (
      <Group>
        {placed(<Shape key="curved" geometry={circle(4)} anchor="center" at={at} fill={red} />)}
        {placed(
          <Shape key="straight" geometry={circle(4)} anchor="center" motion={layer} fill={red} />,
        )}
      </Group>
    ),
    duration,
  );

  return {
    model,
    curved: laneOf(find(model, "curved").at),
    straight: laneOf(find(model, "straight").layers[0]!.offset),
    duration,
  };
};

/** The farthest the two lanes are apart at any of a thousand moments a second. */
const apart = (a: Model.Lane<Vec>, b: Model.Lane<Vec>, duration: number): number => {
  let worst = 0;

  for (let t = 0; t <= duration; t += 0.001) {
    const [p, q] = [valueAt(a, t, blendVec), valueAt(b, t, blendVec)];

    worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1]));
  }

  return worst;
};

/** A dot thrown along x at 400px/s, then sprung toward a point below: the handoff turns it. */
const thrown: Route = {
  start: [0, 0],
  legs: [
    [[200, 0], span(0, 0.5), ease.linear],
    [[200, 100], span(0.5, 3), swing],
  ],
};

describe("splitCurve", () => {
  test("cuts a curve by length into two that trace it exactly", () => {
    const [from, to]: [Vec, Vec] = [
      [0, 0],
      [100, 0],
    ];

    const via = [
      [10, 80],
      [140, 60],
    ] as const;

    const whole = curveLength(from, via, to);
    const [head, at, tail] = splitCurve(from, via, to, 0.3);

    expect(curveLength(from, head, at)).toBeCloseTo(whole * 0.3, 3);
    const cut = alongCurve(from, via, to, 0.3);

    expect(Math.hypot(at[0] - cut[0], at[1] - cut[1])).toBeLessThan(1e-9);

    for (const share of [0.05, 0.2, 0.3, 0.55, 0.9]) {
      const want = alongCurve(from, via, to, share);

      const got =
        share <= 0.3
          ? alongCurve(from, head, at, share / 0.3)
          : alongCurve(at, tail, to, (share - 0.3) / 0.7);

      expect(Math.hypot(got[0] - want[0], got[1] - want[1])).toBeLessThan(0.01);
    }
  });
});

describe("springs that turn write curved keys", () => {
  test("a turning handoff takes far fewer keys, keeps to the simulated path, and overshoots in geometry", () => {
    const { curved, straight } = both(thrown);

    expect(curved.keys.some((key) => key.via)).toBe(true);
    expect(cost(curved)).toBeLessThan(cost(straight) / 2);
    expect(within(curved)).toBe(true);

    const truth = (t: number): Vec => {
      if (t <= 0.5) return [400 * t, 0];
      const s = t - 0.5;

      return [200 + swing.state(0, 400, s)[0], 100 + swing.state(-100, 0, s)[0]];
    };

    let [worst, deepest] = [0, 0];

    for (let t = 0; t <= 3.5; t += 0.001) {
      const [x, y] = valueAt(curved, t, blendVec);
      const [tx, ty] = truth(t);

      worst = Math.max(worst, Math.hypot(x - tx, y - ty));
      deepest = Math.max(deepest, y);
    }

    expect(worst).toBeLessThan(0.3);
    // The spring swings past y = 100 and back. Every ease stays within 0 and 1, so the curves themselves go past.
    expect(deepest).toBeGreaterThan(120);
  });

  test("a spring along a line, or one that barely turns, keeps its straight keys", () => {
    const { curved } = both({
      start: [0, 0],
      legs: [
        [[100, 50], span(0, 1.3), swing],
        [[0, 0], span(2, 1.3), swing],
      ],
    });

    expect(curved.keys.some((key) => key.via)).toBe(false);
  });

  const cases = {
    "a spring cut by another while it moves": {
      start: [0, 0],
      legs: [
        [[100, 0], span(0, 0.3), ease.linear],
        [[100, 100], span(0.3, 0.2), loose],
        [[0, 100], span(0.5, 0.2), loose],
        [[0, 0], span(0.7, 3.2), loose],
      ],
    },
    "a spring cut by an eased step": {
      start: [0, 0],
      legs: [
        [[200, 0], span(0, 0.5), ease.linear],
        [[200, 100], span(0.5, 3), swing],
        [[50, 50], span(1.1, 0.8), ease.inOut],
      ],
    },
    "a repeat whose last pass is cut inside the spring": {
      start: [0, 0],
      legs: thrown.legs.map(([to, when, curve]): Leg => [
        to,
        span(when.at, Math.min(when.over, 1.6)),
        curve,
      ]),
      finish: { repeat: { until: 3 } },
    },
    "a rewind on a spring": {
      start: [0, 0],
      legs: [
        [[200, 0], span(0, 0.5), ease.linear],
        [[200, 100], span(0.5, 1.6), swing],
      ],
      finish: { rewind: 1.6 },
    },
    "a loop rotated inside a sequence, cut inside a curved key": {
      start: [0, 0],
      legs: [
        [[200, 0], span(0, 0.5), ease.linear],
        [[200, 100], span(0.5, 1.6), swing],
        [[0, 0], span(2.1, 0.4), ease.inOut],
      ],
      finish: { loop: 2.5 },
      inside: 0.8,
      duration: 5,
    },
    "a loop whose period is snapped to the scene": {
      start: [0, 0],
      legs: [
        [[200, 0], span(0, 0.5), ease.linear],
        [[200, 100], span(0.5, 1.6), swing],
        [[0, 0], span(2.1, 0.4), ease.inOut],
      ],
      finish: { loop: 2.5 },
      duration: 4.9,
    },
  } satisfies Record<string, Route>;

  for (const [name, route] of Object.entries<Route>(cases))
    test(`${name} draws the same motion with curves as without`, () => {
      const { curved, straight, duration } = both(route);

      expect(curved.keys.some((key) => key.via)).toBe(true);
      expect(within(curved)).toBe(true);
      expect(cost(curved)).toBeLessThan(cost(straight));
      expect(curved.period).toBe(straight.period);
      expect(apart(curved, straight, duration * 2)).toBeLessThan(0.5);

      // Rotated, the loop starts where it was cut: partway through a curved key, split in two.
      if (route.inside !== undefined) expect(curved.keys[1].via).toBeDefined();
    });

  test("the SVG backend draws a curved spring on a motion path", () => {
    const out = svg.emit(both(thrown).model);

    expect(out).toContain("offset-path:path(");
    expect(out).toContain("offset-distance");
  });
});

describe("readers of a curved spring agree with it", () => {
  test("boxesOf puts the node where the lane is", () => {
    const { model, curved } = both(thrown);

    for (const t of [0.2, 0.6, 0.83, 1.1, 1.7, 3]) {
      const [box, other] = [boxesOf(model, t).curved!, boxesOf(model, t).straight!];
      const [x, y] = valueAt(curved, t, blendVec);

      expect(box.x + box.width / 2).toBeCloseTo(x, 6);
      expect(box.y + box.height / 2).toBeCloseTo(y, 6);
      expect(Math.hypot(box.x - other.x, box.y - other.y)).toBeLessThan(0.5);
    }
  });

  test("an arrow on the anchor of a spring-moved node follows it", () => {
    const model = made(() => {
      const dot = ref("dot");

      return (
        <Group>
          <Shape
            ref={dot}
            geometry={rect(10, 10)}
            at={track<Vec>([0, 0])
              .to([200, 0], span(0, 0.5), ease.linear)
              .to([200, 100], span(0.5, 3), swing)}
            fill={red}
          />
          <Arrow key="arrow" from={[380, 280]} to={dot.right} color={red} />
        </Group>
      );
    });

    expect(laneOf(find(model, "dot").at).keys.some((key) => key.via)).toBe(true);

    for (const t of [0.3, 0.6, 0.75, 0.9, 1.2, 2, 3.5]) {
      const tip = placements(model, t).find((node) => node.key === "arrow/head")!;
      const dot = boxesOf(model, t).dot!;
      const [x, y] = [tip.matrix[4], tip.matrix[5]];

      expect(Math.hypot(x - (dot.x + dot.width), y - (dot.y + dot.height / 2))).toBeLessThan(1);
    }
  });

  test("a node with a curved spring inside a group that a spring morph moves is at both", () => {
    const route = () =>
      track<Vec>([0, 0])
        .to([200, 0], span(0, 0.5), ease.linear)
        .to([200, 100], span(0.5, 3), swing);

    const pop = ease.spring({ stiffness: 170, damping: 14 });

    const model = made(() =>
      morph(
        <Group key="g">
          <Shape key="dot" geometry={circle(4)} anchor="center" at={route()} fill={red} />
        </Group>,
        <Group key="g" at={[30, 20]}>
          <Shape key="dot" geometry={circle(4)} anchor="center" at={route()} fill={red} />
        </Group>,
        span(1, 2),
        { curve: pop },
      ),
    );

    const lane = laneOf(find(model, "dot").at);
    const group = find(model, "g").at;

    expect(lane.keys.some((key) => key.via)).toBe(true);

    for (const t of [0.4, 0.7, 1.2, 1.6, 2.5, 3.5]) {
      const box = boxesOf(model, t)[find(model, "dot").key]!;
      const [x, y] = valueAt(lane, t, blendVec);
      const [gx, gy] = valueAt(group, t, blendVec);
      const share = t < 1 ? 0 : 1 + pop.state(-1, 0, t - 1)[0];

      expect(box.x + box.width / 2).toBeCloseTo(gx + x, 6);
      expect(box.y + box.height / 2).toBeCloseTo(gy + y, 6);
      expect(Math.hypot(gx - 30 * share, gy - 20 * share)).toBeLessThan(0.1);
    }
  });

  test("moveBy after a cut spring carries on from where the curved spring was cut", () => {
    const model = made(() => {
      const dot = ref("dot");

      timeline(
        dot.move([200, 0], 0.5, ease.linear),
        dot.move([200, 100], 0.4, swing),
        dot.moveBy([-50, 0], 1),
      );

      return <Shape ref={dot} geometry={circle(4)} anchor="center" fill={red} />;
    });

    const lane = laneOf(find(model, "dot").at);
    const cut = valueAt(lane, 0.9, blendVec);
    const truth: Vec = [200 + swing.state(0, 400, 0.4)[0], 100 + swing.state(-100, 0, 0.4)[0]];

    expect(lane.keys.some((key) => key.via)).toBe(true);
    expect(Math.hypot(cut[0] - truth[0], cut[1] - truth[1])).toBeLessThan(0.3);

    const after = valueAt(lane, 0.901, blendVec);

    // moveBy moves from the spring's target, as it does after any move, but from where the dot is when it is cut.
    expect(Math.hypot(after[0] - cut[0], after[1] - cut[1])).toBeLessThan(0.5);
    expect(valueAt(lane, 4, blendVec)).toEqual([150, 100]);
  });
});
