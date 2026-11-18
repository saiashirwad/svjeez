import { describe, expect, test } from "bun:test";
import { easeAt } from "../src/model/ease-at";
import { alongCurve } from "../src/model/curve";
import {
  Group,
  Sequence,
  Shape,
  circle,
  ease,
  enter,
  motion,
  rect,
  scene,
  span,
  tokens,
  track,
  type SceneElement,
} from "svjeez";
import { isLane, svg, type Model, type Spring } from "svjeez/tools";

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

const laneOf = <T,>(value: Model.Animated<T>): Model.Lane<T> => {
  if (!isLane(value)) throw new Error("expected a lane");

  return value;
};

const valueAt = (lane: Model.Lane<number | Model.Vec>, t: number): number[] => {
  const { keys } = lane;

  const list = (value: number | Model.Vec): number[] => (isNumber(value) ? [value] : [...value]);

  if (t <= keys[0].t) return list(keys[0].value);
  const index = keys.findIndex((key) => key.t >= t);

  if (index < 0) return list(keys.at(-1)!.value);
  const [a, b] = [keys[index - 1]!, keys[index]!];
  const p = easeAt(b.ease!, (t - a.t) / (b.t - a.t));
  const [from, to] = [list(a.value), list(b.value)];

  if (b.via) return [...alongCurve([from[0]!, from[1]!], b.via, [to[0]!, to[1]!], p)];

  return from.map((value, c) => value + (to[c]! - value) * p);
};

const isNumber = (value: number | Model.Vec): value is number => typeof value === "number";

const atOf = (model: Model.Scene, index = 0) => laneOf(model.root.children[index]!.at);

const integrated = (spring: Spring, x0: number, v0: number, until: number): [number, number] => {
  const k = spring.stiffness / spring.mass;
  const c = spring.damping / spring.mass;
  const accel = (x: number, v: number) => -k * x - c * v;
  const h = 1e-4;
  let [x, v] = [x0, v0];

  for (let t = 0; t < until - h / 2; t += h) {
    const [k1x, k1v] = [v, accel(x, v)];
    const [k2x, k2v] = [v + (h / 2) * k1v, accel(x + (h / 2) * k1x, v + (h / 2) * k1v)];
    const [k3x, k3v] = [v + (h / 2) * k2v, accel(x + (h / 2) * k2x, v + (h / 2) * k2v)];
    const [k4x, k4v] = [v + h * k3v, accel(x + h * k3x, v + h * k3v)];
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }

  return [x, v];
};

const bouncy = ease.spring({ stiffness: 170, damping: 10 });

describe("spring physics", () => {
  const cases = [
    ["under", bouncy],
    ["critical", ease.spring({ stiffness: 100, damping: 20 })],
    ["over", ease.spring({ stiffness: 100, damping: 50, mass: 1.5 })],
  ] as const;

  for (const [name, spring] of cases)
    test(`the ${name}-damped closed form matches the integrated equation`, () => {
      expect(
        name === "under" ? spring.zeta < 1 : name === "over" ? spring.zeta > 1 : spring.zeta === 1,
      ).toBe(true);

      for (const t of [0, 0.05, 0.3, 0.7, 1.5])
        for (const [x0, v0] of [
          [1, 0],
          [-40, 300],
          [0, -5],
        ] as const) {
          const [x, v] = spring.state(x0, v0, t);
          const [ix, iv] = integrated(spring, x0, v0, t);

          expect(Math.abs(x - ix)).toBeLessThan(1e-6 * Math.max(1, Math.abs(x0), Math.abs(v0)));
          expect(Math.abs(v - iv)).toBeLessThan(1e-5 * Math.max(1, Math.abs(x0), Math.abs(v0)));
        }
    });

  test("an underdamped spring from rest is the textbook decaying cosine", () => {
    const { omega: w, zeta: z } = bouncy;
    const wd = w * Math.sqrt(1 - z * z);

    for (const t of [0.1, 0.4, 0.9])
      expect(bouncy.state(1, 0, t)[0]).toBeCloseTo(
        Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t)),
        12,
      );
  });

  test("settle is when what is left of the motion is a thousandth of the start, whatever the distance", () => {
    const at = bouncy.settle;

    const left = (t: number) =>
      Math.hypot(...bouncy.state(250, 0, t).map((v, i) => (i === 0 ? v : v / bouncy.omega))) / 250;

    expect(left(at)).toBeCloseTo(1e-3, 6);
    expect(left(at * 0.98)).toBeGreaterThan(1e-3);
    expect(bouncy.settleTime([3], [0])).toBeCloseTo(at, 9);
  });

  test("a spring needs a positive stiffness, damping and mass", () => {
    expect(() => ease.spring({ stiffness: 100, damping: 0 })).toThrow("positive, finite damping");
    expect(() => ease.spring({ stiffness: -1, damping: 10 })).toThrow("stiffness");
  });
});

describe("spring steps", () => {
  test("a spring step follows the simulated spring, overshoot and all, in a few keys", () => {
    const model = made(() => (
      <Shape
        fill="#000000"
        geometry={circle(4)}
        anchor="center"
        at={track([0, 0]).to([300, 0], span(0.5, bouncy.settle), bouncy)}
      />
    ));

    const lane = atOf(model);

    expect(lane.keys.length).toBeLessThanOrEqual(20);

    for (let t = 0.5; t < 0.5 + bouncy.settle; t += 0.01)
      expect(
        Math.abs(valueAt(lane, t)[0]! - (300 + bouncy.state(-300, 0, t - 0.5)[0])),
      ).toBeLessThan(0.35);

    expect(Math.max(...lane.keys.map((key) => key.value[0]))).toBeGreaterThan(330);
    expect(lane.keys.at(-1)!.value).toEqual([300, 0]);
  });

  test("scale overshoots on a springy pop", () => {
    const pop = ease.spring({ stiffness: 260, damping: 14 });

    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={rect(10, 10)}
          motion={enter(span(0, pop.settle), { from: { scale: 0 }, curve: pop })}
        />
      )),
    );

    const scale = laneOf(node.layers[0]!.scale);

    const peak = Math.max(
      ...Array.from({ length: 101 }, (_, i) => valueAt(scale, (pop.settle * i) / 100)[0]!),
    );

    expect(peak).toBeGreaterThan(1.2);
    expect(scale.keys.length).toBeLessThan(16);
  });

  test("a span too short for the spring throws with the time it needs", () => {
    expect(() =>
      made(() => (
        <Shape
          fill="#000000"
          key="dot"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([100, 0], span(0, 0.5), bouncy)}
        />
      )),
    ).toThrow(
      `The spring on at on <Shape> "dot" from 0s needs ${Math.ceil(bouncy.settle * 100) / 100}s to settle, but its span is 0.5s.`,
    );
  });

  test("a step that starts while a spring moves cuts it, and a spring that cuts in keeps its speed", () => {
    const lane = atOf(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([200, 0], span(0, 2), bouncy).to([60, 0], span(0.3, 2), bouncy)}
        />
      )),
    );

    const h = 1e-4;
    const x = (t: number) => valueAt(lane, t)[0]!;
    const [x0, v0] = bouncy.state(-200, 0, 0.3);

    expect(x(0.3)).toBeCloseTo(200 + x0, 1);
    expect(Math.abs((x(0.3) - x(0.3 - h)) / h - v0)).toBeLessThan(Math.abs(v0) * 0.03);
    expect(Math.abs((x(0.3 + h) - x(0.3)) / h - v0)).toBeLessThan(Math.abs(v0) * 0.03);
    expect(lane.keys.at(-1)!.value).toEqual([60, 0]);
  });

  test("in two dimensions the handoff is continuous in both, and the path ends on the target", () => {
    const lane = atOf(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([200, 0], span(0, 2), bouncy).to([200, 120], span(0.4, 2), bouncy)}
        />
      )),
    );

    const first = (t: number) => bouncy.state(-200, 0, t);
    const [cut, speed] = first(0.4);

    const truth = (t: number): number[] => {
      if (t <= 0.4) return [200 + first(t)[0], 0];
      const s = t - 0.4;

      return [200 + bouncy.state(cut, speed, s)[0], 120 + bouncy.state(-120, 0, s)[0]];
    };

    for (let t = 0; t < 2.4; t += 0.005) {
      const [x, y] = valueAt(lane, t);
      const [tx, ty] = truth(t);

      expect(Math.hypot(x! - tx!, y! - ty!)).toBeLessThan(0.5);
    }

    expect(lane.keys.at(-1)!.value).toEqual([200, 120]);
  });

  test("a spring that starts as a linear step ends takes the step's speed", () => {
    const lane = atOf(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([100, 0], span(0, 1), ease.linear).to([150, 0], span(1, 2), bouncy)}
        />
      )),
    );

    const h = 1e-4;

    expect((valueAt(lane, 1 + h)[0]! - valueAt(lane, 1)[0]!) / h).toBeCloseTo(100, 0);
  });

  test("a spring after ease.out, or after a gap, starts at rest", () => {
    const after = (gap: number, curve = ease.out) =>
      atOf(
        made(() => (
          <Shape
            fill="#000000"
            geometry={circle(4)}
            anchor="center"
            at={track([0, 0])
              .to([100, 0], span(0, 1), curve)
              .to([150, 0], span(1 + gap, 2), bouncy)}
          />
        )),
      );

    const h = 1e-4;

    expect(Math.abs(valueAt(after(0), 1 + h)[0]! - 100) / h).toBeLessThan(1);
    expect(Math.abs(valueAt(after(0.2, ease.linear), 1.2 + h)[0]! - 100) / h).toBeLessThan(1);
  });

  test("an eased step can cut a spring, but nothing cuts an eased step, and two can't start together", () => {
    const cut = atOf(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([100, 0], span(0, 2), bouncy).to([0, 0], span(0.5, 0.5))}
        />
      )),
    );

    expect(cut.keys.find((key) => key.t === 1)?.value).toEqual([0, 0]);
    expect(valueAt(cut, 0.5)[0]).toBeCloseTo(100 + bouncy.state(-100, 0, 0.5)[0], 1);
    expect(() => track(0).to(1, span(0, 1)).to(2, span(0.5, 1), bouncy)).toThrow(
      "Two steps move this track at once",
    );
    expect(() => track(0).to(1, span(0, 2), bouncy).to(2, span(0, 1))).toThrow(
      "Two steps move this track at once",
    );
  });

  test("colors don't spring", () => {
    const theme = tokens({
      light: { a: "#111111", b: "#222222" },
      dark: { a: "#EEEEEE", b: "#DDDDDD" },
    });

    expect(() =>
      made(() => (
        <Shape
          key="dot"
          geometry={circle(4)}
          fill={track(theme.a).to(theme.b, span(0, 2), bouncy)}
        />
      )),
    ).toThrow(
      'fill on <Shape> "dot" moves on a spring, and a spring moves only numbers and points.',
    );
  });

  test("a spring inside a Sequence runs on the sequence's clock", () => {
    const motionOf = (at: number) => {
      const model = made(() => (
        <Group>
          <Sequence when={span(at)}>
            <Shape
              fill="#000000"
              geometry={circle(4)}
              anchor="center"
              at={track([0, 0]).to([80, 0], span(0, bouncy.settle), bouncy)}
            />
          </Sequence>
        </Group>
      ));

      return atOf(model);
    };

    const [early, late] = [motionOf(0), motionOf(1.5)];

    const moving = (lane: Model.Lane<Model.Vec>, from: number) =>
      lane.keys.filter((key) => key.t >= from && key.t < 4).map((key) => key.t - from);

    expect(moving(late, 1.5)).toEqual(moving(early, 0).map((t) => expect.closeTo(t, 9)));
  });

  test("repeat plays the spring again from rest", () => {
    const lane = atOf(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([50, 0], span(0, 1.5), bouncy).repeat(2)}
        />
      )),
    );

    for (const t of [0.05, 0.2, 0.37, 0.8, 1.2])
      expect(valueAt(lane, 1.5 + t)[0]).toBeCloseTo(valueAt(lane, t)[0]!, 6);
  });

  test("a loop closes only when the spring settles inside it", () => {
    expect(() => track(0).to(1, span(0, 0.5), bouncy).loop(0.5)).not.toThrow();
    expect(() =>
      made(() => (
        <Shape
          fill="#000000"
          key="dot"
          geometry={circle(4)}
          rotate={track(0).to(90, span(0, 0.5), bouncy).loop(0.5)}
        />
      )),
    ).toThrow("needs");

    const model = made(() => (
      <Shape
        fill="#000000"
        geometry={circle(4)}
        rotate={track(0).to(90, span(0, 1.5), bouncy).to(0, span(1.5, 0.5)).loop(2)}
      />
    ));

    expect(laneOf(only(model).layers[0]!.rotate).period).toBe(2);
  });

  test("a motion layer springs a point, and rewinds on a spring", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          motion={motion()
            .to({ offset: [40, 20] }, span(0, 1.5), bouncy)
            .rewind(1.5, bouncy)}
        />
      )),
    );

    const offset = laneOf(node.layers[0]!.offset);

    expect(offset.keys.at(-1)).toMatchObject({ t: 4, value: [0, 0] });
    expect(Math.max(...offset.keys.map((key) => key.value[0]))).toBeGreaterThan(44);
  });

  test("the SVG backend writes spring keys as CSS keyframes", () => {
    const out = svg.emit(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([0, 0]).to([100, 0], span(0, bouncy.settle), bouncy)}
        />
      )),
    );

    expect(out).toContain("@keyframes");
    expect(out).toContain("cubic-bezier(.333");
  });
});
