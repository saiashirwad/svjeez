import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Sequence,
  Shape,
  Stack,
  circle,
  ease,
  rect,
  motion,
  ref,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { isLane, type Model } from "svjeez/tools";
import type { Spanned } from "../src/author/span";
import { blendVec, valueAt } from "../src/model/sample";

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const visit = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key === key
      ? node
      : node.kind === "group"
        ? node.children.map(visit).find(Boolean)
        : undefined;

  const found = visit(model.root);

  if (!found) throw new Error(`no node "${key}"`);

  return found;
};

const own = (node: Model.SceneNode): Model.Layer => node.layers.at(-1)!;

const times = <T,>(value: Model.Animated<T>): [number, T][] =>
  isLane(value) ? value.keys.map((key) => [key.t, key.value]) : [];

describe("tracks you write", () => {
  test("a track appends steps to itself, and a node reads it as the prop", () => {
    const model = made(() => {
      const pos = track<Vec>([10, 20]);
      const rotate = track(15);
      const scale = track<Vec>([1, 1]);
      const opacity = track(1);

      pos.to([50, 20], span(0, 1), ease.linear);
      pos.to([60, 20], span(1, 0.5), ease.linear);
      rotate.to(90, span(1.5, 1));
      scale.to([2, 2], span(1.5, 1));
      opacity.to(0.5, span(1.5, 1));

      return (
        <Shape
          fill="#000000"
          key="dot"
          geometry={circle(4)}
          anchor="center"
          at={pos}
          rotate={rotate}
          scale={scale}
          opacity={opacity}
        />
      );
    });

    const dot = find(model, "dot");

    expect(times(dot.at)).toEqual([
      [0, [10, 20]],
      [1, [50, 20]],
      [1.5, [60, 20]],
      [4, [60, 20]],
    ]);
    expect(times(own(dot).rotate)).toEqual([
      [0, 15],
      [1.5, 15],
      [2.5, 90],
      [4, 90],
    ]);
    expect(times(own(dot).scale).at(-1)).toEqual([4, [2, 2]]);
    expect(times(own(dot).opacity).at(-1)).toEqual([4, 0.5]);
  });

  test("tracks move opacity, fill, stroke and trim of a shape's paint", () => {
    const model = made(() => {
      const opacity = track(0).to(1, span(0, 0.5));
      const fill = track<`#${string}`>("#000000").to("#ff0000", span(0.5, 0.5));
      const color = track<`#${string}`>("#000000").to("#00ff00", span(1, 0.5));
      const trim = track<Vec>([0, 1]).to([0, 0.5], span(1.5, 0.5));

      opacity.to(0, span(2, 0.5));

      return (
        <Shape
          key="box"
          geometry={rect(10, 10)}
          fill={fill}
          stroke={{ color, width: 2 }}
          trim={trim}
          opacity={opacity}
        />
      );
    });

    const box = find(model, "box");

    if (box.kind !== "shape") throw new Error("not a shape");
    expect(times(own(box).opacity).map(([, value]) => value)).toEqual([0, 1, 1, 0, 0]);
    expect(times(box.fill!).at(-1)).toEqual([4, [1, 0, 0, 1]]);
    expect(times(box.stroke!.color).at(-1)).toEqual([4, [0, 1, 0, 1]]);
    expect(box.stroke!.width).toBe(2);
    expect(times(box.trim!)).toEqual([
      [0, [0, 1]],
      [1.5, [0, 1]],
      [2, [0, 0.5]],
      [4, [0, 0.5]],
    ]);
  });

  test("a cut of the trim to nothing, then a trim to the whole, draws a stroke on", () => {
    const model = made(() => {
      const trim = track<Vec>([0, 1]);

      trim.set([0, 0], span(1));
      trim.to([0, 1], span(1, 1), ease.linear);

      return <Shape key="s" geometry={rect(10, 10)} stroke={{ color: "#000000" }} trim={trim} />;
    });

    const node = find(model, "s");

    expect(node.kind === "shape" && valueAt(node.trim!, 0.5, blendVec)).toEqual([0, 1]);
    expect(node.kind === "shape" && valueAt(node.trim!, 1.5, blendVec)[1]).toBeCloseTo(0.5);
    expect(node.kind === "shape" && valueAt(node.trim!, 3, blendVec)).toEqual([0, 1]);
  });

  test("a track returns itself, so chains and separate calls write the same steps", () => {
    const chained = track(0);
    const same = chained.to(1, span(0, 1)).to(0, span(2, 1));

    expect(same).toBe(chained);
  });

  test("a set cuts a track, and a path back home at the clock's end glides the node home", () => {
    const model = made(() => {
      const pos = track<Vec>([0, 0]);
      const rotate = track(0);

      pos.to([40, 0], span(0, 1));
      rotate.to(90, span(0, 1));
      pos.to([0, 0], span(3.5, 0.5), ease.linear);
      rotate.to(0, span(3.5, 0.5), ease.linear);

      return (
        <Shape
          fill="#000000"
          key="dot"
          geometry={circle(4)}
          anchor="center"
          at={pos}
          rotate={rotate}
        />
      );
    });

    const dot = find(model, "dot");

    expect(times(dot.at).slice(-2)).toEqual([
      [3.5, [40, 0]],
      [4, [0, 0]],
    ]);
    expect(times(own(dot).rotate).slice(-2)).toEqual([
      [3.5, 90],
      [4, 0],
    ]);

    const cut = made(() => {
      const pos = track<Vec>([40, 0]);

      pos.set([0, 0], span(2));

      return <Shape fill="#000000" key="dot" geometry={circle(4)} anchor="center" at={pos} />;
    });

    expect(valueAt(find(cut, "dot").at, 1.99, blendVec)).toEqual([40, 0]);
    expect(valueAt(find(cut, "dot").at, 2.01, blendVec)).toEqual([0, 0]);
  });
});

describe("tracks that go to anchors", () => {
  test("a step to an anchor lands the node's anchor point on it", () => {
    const model = made(() => {
      const target = ref("target");
      const a = track<Vec>([0, 0]);
      const b = track<Vec>([0, 0]);

      a.to(target.center, span(0, 1));
      b.to(target.part("pin").topLeft, span(0, 1));

      return (
        <Group>
          <Group ref={target} offset={[100, 50]}>
            <Shape fill="#000000" geometry={rect(20, 10)} />
            <Shape fill="#000000" key="pin" geometry={rect(4, 4)} at={[30, 30]} />
          </Group>
          <Shape fill="#000000" key="a" geometry={circle(2)} anchor="center" at={a} />
          <Group offset={[10, 10]}>
            <Shape fill="#000000" key="b" geometry={rect(6, 6)} anchor="center" at={b} />
          </Group>
        </Group>
      );
    });

    expect(times(find(model, "a").at).at(-1)).toEqual([4, [117, 67]]);
    expect(times(find(model, "2/b").at).at(-1)).toEqual([4, [117, 67]]);
  });

  test("a step to a moving anchor lands where the anchor is when the step ends", () => {
    const model = made(() => {
      const card = ref("card");
      const cardAt = track<Vec>([0, 0]).to([100, 0], span(0, 2), ease.linear);
      const dotAt = track<Vec>([0, 0]).to(card.right, span(0, 1), ease.linear);

      return (
        <Group>
          <Shape fill="#000000" ref={card} geometry={rect(20, 10)} at={cardAt} />
          <Shape fill="#000000" key="dot" geometry={circle(2)} anchor="center" at={dotAt} />
        </Group>
      );
    });

    const [x, y] = valueAt(find(model, "dot").at, 1, blendVec);

    expect(x).toBeCloseTo(70, 6);
    expect(y).toBeCloseTo(5, 6);
  });

  test("a track that goes to an anchor can't be read as anything but at", () => {
    expect(() =>
      made(() => {
        const card = ref("card");
        const bad = track<Vec>([1, 1]).to(card.right, span(0, 1));

        return (
          <Group>
            <Shape fill="#000000" ref={card} geometry={rect(20, 10)} />
            <Shape fill="#000000" geometry={circle(2)} scale={bad} />
          </Group>
        );
      }),
    ).toThrow("follows a track with a step that goes to an anchor");
  });

  test("a track that goes to an anchor starts at a point and doesn't loop", () => {
    const card = ref("card");

    expect(() => track(card.right)).toThrow("starts at an anchor");
    expect(() =>
      made(() => (
        <Group>
          <Shape fill="#000000" ref={card} geometry={rect(20, 10)} />
          <Shape
            fill="#000000"
            geometry={circle(2)}
            at={track<Vec>([0, 0]).to(card.right, span(0, 1)).loop(2)}
          />
        </Group>
      )),
    ).toThrow("loops, and a loop can't go to an anchor");
  });

  test("a node a container places can't go to an anchor", () => {
    expect(() =>
      made(() => {
        const card = ref("card");

        return (
          <Group>
            <Shape fill="#000000" ref={card} geometry={rect(20, 10)} />
            <Stack>
              <Shape
                fill="#000000"
                geometry={circle(2)}
                at={track<Vec>([0, 0]).to(card.right, span(0, 1))}
              />
            </Stack>
          </Group>
        );
      }),
    ).toThrow("Wrap it in a <Group>");
  });
});

describe("springs, arrows and parts", () => {
  test("a span of a spring's settle time runs the step for as long as the spring takes", () => {
    const flick = ease.spring({ stiffness: 320, damping: 22 });

    const model = made(() => {
      const knob = track<Vec>([0, 0]);

      knob.to([20, 0], span(0, flick.settle), flick);

      expect(knob.span.over).toBeCloseTo(flick.settle, 9);

      return <Shape fill="#000000" key="knob" geometry={circle(3)} at={knob} />;
    });

    const keys = times(find(model, "knob").at);

    expect(keys.at(-1)![1][0] - keys[0]![1][0]).toBeCloseTo(20, 9);
  });

  test("trim and stroke on an arrow draw and recolor its shaft and head", () => {
    const model = made(() => {
      const [a, b] = [ref("a"), ref("b")];
      const trim = track<Vec>([0, 0]).to([0, 1], span(0, 1), ease.linear);
      const color = track<`#${string}`>("#000000").to("#ff0000", span(1, 0.5));

      return (
        <Group>
          <Shape fill="#000000" ref={a} geometry={rect(10, 10)} at={[0, 0]} />
          <Shape fill="#000000" ref={b} geometry={rect(10, 10)} at={[100, 0]} />
          <Arrow key="arrow" from={a.right} to={b.left} trim={trim} stroke={{ color }} />
        </Group>
      );
    });

    const shaft = find(model, "arrow/shaft");
    const head = find(model, "arrow/head");

    expect(shaft.kind === "shape" && valueAt(shaft.trim!, 0.5, blendVec)).toEqual([0, 0.5]);
    expect(shaft.kind === "shape" && isLane(shaft.stroke!.color)).toBe(true);
    expect(head.kind === "shape" && isLane(head.stroke!.color)).toBe(true);
  });

  test("tracks on a group's parts, going back to the start, return every part home", () => {
    const model = made(() => {
      const knob = track<Vec>([3, 3]);
      const groove = track<`#${string}`>("#000000");

      knob.to([23, 3], span(0, 0.5));
      groove.to("#ff0000", span(0.5, 0.5));
      knob.to([3, 3], span(3.5, 0.5));
      groove.to("#000000", span(3.5, 0.5));

      return (
        <Group key="toggle">
          <Shape fill={groove} key="groove" geometry={rect(44, 24)} />
          <Shape fill="#ffffff" key="knob" geometry={circle(9)} at={knob} />
        </Group>
      );
    });

    const knob = times(find(model, "toggle/knob").at);
    const groove = find(model, "toggle/groove");
    const fill = groove.kind === "shape" ? times(groove.fill!) : [];

    expect(knob.at(-1)).toEqual([4, knob[0]![1]]);
    expect(fill.at(-1)).toEqual([4, fill[0]![1]]);
  });

  test("cascade() returns as many spans as it is asked for, typed as a tuple", () => {
    const [first, second, third] = span(0, 1).cascade(3, 0.5);
    const pair: [Spanned, Spanned] = span(1, 1).cascade(2, 0.25);

    expect([first.start, second.start, third.start]).toEqual([0, 0.5, 1]);
    expect(pair[1].start).toBe(1.25);
  });
});

describe("spans", () => {
  test("span is the step written last, and next() chains the next step after it", () => {
    const model = made(() => {
      const dot = track<Vec>([0, 0]);

      dot.to([1, 0], span(0, 1));
      expect([dot.span.start, dot.span.over, dot.span.end]).toEqual([0, 1, 1]);
      dot.to([2, 0], dot.span.next(1, 0.5));

      return <Shape fill="#000000" key="dot" geometry={circle(4)} anchor="center" at={dot} />;
    }, 10);

    expect(times(find(model, "dot").at).map(([t]) => t)).toEqual([0, 1, 1.5, 2.5, 10]);
  });

  test("span before anything is written, and on a motion, says what is missing", () => {
    expect(() => track(0).span).toThrow("nothing is written on this track yet");
    expect(() => motion().span).toThrow("nothing is written on this motion yet");
    expect(motion().to({ opacity: 0 }, span(1, 2)).span.end).toBe(3);
    expect(track(0).set(1, span(2)).span.over).toBe(0);
  });

  test("cascade starts each step a step after the one before", () => {
    const model = made(() => {
      const spans = span(0, 1).cascade(3, 0.25);
      const fades = spans.map((when) => track(0).to(1, when));

      return (
        <Group>
          {fades.map((fade, i) => (
            <Shape fill="#000000" key={String(i)} geometry={circle(2)} opacity={fade} />
          ))}
        </Group>
      );
    });

    const lit = (key: string) =>
      times(own(find(model, key)).opacity).find(([, value]) => value === 1)![0];

    expect(["0", "1", "2"].map(lit)).toEqual([1, 1.25, 1.5]);
  });

  test("a component can make its own tracks and write them in scene order", () => {
    const lamp = () => {
      const glow = track(0.2);

      return {
        node: <Shape key="bulb" geometry={circle(4)} fill="#000000" opacity={glow} />,
        blink: (at: number) => {
          glow.to(1, span(at, 0.1));

          return glow.to(0.2, glow.span.next(0.1, 0.3)).span;
        },
      };
    };

    const model = made(() => {
      const one = lamp();
      const done = one.blink(1);

      one.blink(done.end);

      return <Group>{one.node}</Group>;
    });

    expect(times(own(find(model, "bulb")).opacity).map(([, value]) => value)).toEqual([
      0.2, 0.2, 1, 1, 0.2, 1, 1, 0.2, 0.2,
    ]);
  });
});

describe("tracks", () => {
  test("a spring may be cut by the next step on the same track, which carries its speed on", () => {
    const model = made(() => {
      const dot = track<Vec>([0, 0]);
      const spring = ease.spring({ stiffness: 120, damping: 8 });

      dot.to([100, 0], span(0, 2), spring);
      dot.to([0, 50], span(0.3, 2), spring);

      return <Shape fill="#000000" key="dot" geometry={circle(4)} anchor="center" at={dot} />;
    });

    expect(valueAt(find(model, "dot").at, 4, blendVec)).toEqual([0, 50]);
  });

  test("two steps that overlap throw, naming both spans and how to fix it", () => {
    expect(() => track<Vec>([0, 0]).to([1, 0], span(0, 1)).to([2, 1], span(0.5, 1))).toThrow(
      "Two steps move this track at once: one from 0s to 1s, and another from 0.5s to 1.5s, before the first ends. Start the later step at 1s or later: the first step's span.next(over) starts where it ends.",
    );
    expect(() => motion().to({ opacity: 0 }, span(0, 1)).to({ opacity: 1 }, span(0.5, 1))).toThrow(
      "Two steps move `opacity` on this motion at once",
    );
  });

  test("a track written after a scene read it throws", () => {
    const glow = track(0);

    made(() => <Shape fill="#000000" geometry={circle(4)} opacity={glow} />);
    expect(() => glow.to(1, span(0, 1))).toThrow(
      "to() writes a track that opacity on <Shape> has already read.",
    );
    expect(() => glow.set(1, span(0))).toThrow("set() writes a track");
  });

  test("a track read on two clocks throws, naming both nodes", () => {
    const glow = track(0).to(1, span(0, 1));

    expect(() =>
      made(() => (
        <Group>
          <Shape fill="#000000" key="early" geometry={circle(4)} opacity={glow} />
          <Sequence when={span(2)}>
            <Shape fill="#000000" key="late" geometry={circle(4)} opacity={glow} />
          </Sequence>
        </Group>
      )),
    ).toThrow(
      "read the same track, but they count time on different clocks: the scene's clock and the clock of a sequence that starts at 2s.",
    );
  });

  test("a track read by two nodes on one clock is shared", () => {
    const glow = track(0).to(1, span(0, 1));

    const model = made(() => (
      <Group>
        <Shape fill="#000000" key="a" geometry={circle(4)} opacity={glow} />
        <Shape fill="#000000" key="b" geometry={circle(4)} opacity={glow} />
      </Group>
    ));

    expect(own(find(model, "a")).opacity).toEqual(own(find(model, "b")).opacity);
  });
});

describe("clocks", () => {
  test("a track inside a sequence runs on its clock", () => {
    const model = made(() => {
      const dot = track<Vec>([0, 0]).to([10, 0], span(0, 1), ease.linear);

      return (
        <Sequence when={span(1.5)}>
          <Shape fill="#000000" key="dot" geometry={circle(2)} anchor="center" at={dot} />
        </Sequence>
      );
    });

    expect(times(find(model, "dot").at)).toEqual([
      [0, [0, 0]],
      [1.5, [0, 0]],
      [2.5, [10, 0]],
      [4, [10, 0]],
    ]);
  });
});
