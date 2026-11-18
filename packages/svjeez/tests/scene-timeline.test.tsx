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
  ref,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { isLane, type Model } from "svjeez/tools";
import type { Spanned } from "../src/author/span";
import { blendNumber, blendVec, valueAt } from "../src/model/sample";

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

describe("verbs", () => {
  test("move, to and set write the node's own props, from its own values", () => {
    const model = made(() => {
      const dot = ref("dot");

      dot.move([50, 20], span(0, 1), ease.linear);
      dot.move([60, 20], span(1, 0.5), ease.linear);
      dot.to({ rotate: 90, scale: 2, opacity: 0.5 }, span(1.5, 1));

      return (
        <Shape
          fill="#000000"
          ref={dot}
          geometry={circle(4)}
          anchor="center"
          at={[10, 20]}
          rotate={15}
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

  test("to moves opacity, fill, stroke and trim of a shape's paint", () => {
    const model = made(() => {
      const box = ref("box");

      box.to({ opacity: 1 }, span(0, 0.5));
      box.to({ fill: "#ff0000" }, span(0.5, 0.5));
      box.to({ stroke: { color: "#00ff00" } }, span(1, 0.5));
      box.to({ trim: [0, 0.5] }, span(1.5, 0.5));
      box.to({ opacity: 0 }, span(2, 0.5));

      return (
        <Shape
          ref={box}
          geometry={rect(10, 10)}
          fill="#000000"
          stroke={{ color: "#000000", width: 2 }}
          opacity={0}
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
      const stroke = ref("s");

      stroke.set({ trim: [0, 0] }, span(1));
      stroke.to({ trim: [0, 1] }, span(1, 1), ease.linear);

      return <Shape ref={stroke} geometry={rect(10, 10)} stroke={{ color: "#000000" }} />;
    });

    const node = find(model, "s");

    expect(node.kind === "shape" && valueAt(node.trim!, 0.5, blendVec)).toEqual([0, 1]);
    expect(node.kind === "shape" && valueAt(node.trim!, 1.5, blendVec)[1]).toBeCloseTo(0.5);
    expect(node.kind === "shape" && valueAt(node.trim!, 3, blendVec)).toEqual([0, 1]);
  });

  test("to moves several props at once, and set cuts them", () => {
    const model = made(() => {
      const dot = ref("dot");

      dot.to({ at: [40, 0], opacity: 0.5 }, span(0, 1), ease.linear);
      dot.set({ at: [0, 0] }, span(2));

      return <Shape fill="#000000" ref={dot} geometry={circle(4)} anchor="center" />;
    });

    const dot = find(model, "dot");

    expect(valueAt(dot.at, 1, blendVec)).toEqual([40, 0]);
    expect(valueAt(dot.at, 1.99, blendVec)).toEqual([40, 0]);
    expect(valueAt(dot.at, 2.01, blendVec)).toEqual([0, 0]);
    expect(valueAt(own(dot).opacity, 3, blendNumber)).toBe(0.5);
  });

  test("verbs going back to the initial values at the clock's end glide the node home", () => {
    const model = made(() => {
      const dot = ref("dot");

      dot.move([40, 0], span(0, 1));
      dot.to({ rotate: 90 }, span(0, 1));
      dot.move([0, 0], span(3.5, 0.5), ease.linear);
      dot.to({ rotate: 0 }, span(3.5, 0.5), ease.linear);

      return <Shape fill="#000000" ref={dot} geometry={circle(4)} anchor="center" />;
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
  });

  test("move lands the point the node's at names on another ref's anchor, or a point of it named by options.point", () => {
    const model = made(() => {
      const target = ref("target");
      const a = ref("a");
      const b = ref("b");

      a.move(target, span(0, 1));
      b.move(target.part("pin").topLeft, span(0, 1), ease.out, { point: "center" });

      return (
        <Group>
          <Group ref={target} offset={[100, 50]}>
            <Shape fill="#000000" geometry={rect(20, 10)} />
            <Shape fill="#000000" key="pin" geometry={rect(4, 4)} at={[30, 30]} />
          </Group>
          <Shape fill="#000000" ref={a} geometry={circle(2)} anchor="center" />
          <Group offset={[10, 10]}>
            <Shape fill="#000000" ref={b} geometry={rect(6, 6)} />
          </Group>
        </Group>
      );
    });

    expect(times(find(model, "a").at).at(-1)).toEqual([4, [117, 67]]);
    expect(times(find(model, "2/b").at).at(-1)).toEqual([4, [117, 67]]);
  });

  test("move to a moving anchor lands where the anchor is when the move ends", () => {
    const model = made(() => {
      const card = ref("card");
      const dot = ref("dot");

      card.move([100, 0], span(0, 2), ease.linear);
      dot.move(card.right, span(0, 1), ease.linear);

      return (
        <Group>
          <Shape fill="#000000" ref={card} geometry={rect(20, 10)} />
          <Shape fill="#000000" ref={dot} geometry={circle(2)} anchor="center" />
        </Group>
      );
    });

    const [x, y] = valueAt(find(model, "dot").at, 1, blendVec);

    expect(x).toBeCloseTo(70, 6);
    expect(y).toBeCloseTo(5, 6);
  });
});

describe("springs, arrows and parts", () => {
  test("a span of a spring's settle time runs the verb for as long as the spring takes", () => {
    const flick = ease.spring({ stiffness: 320, damping: 22 });

    const model = made(() => {
      const knob = ref("knob");
      const ran = knob.move([20, 0], span(0, flick.settle), flick);

      expect(ran.over).toBeCloseTo(flick.settle, 9);

      return <Shape fill="#000000" ref={knob} geometry={circle(3)} at={[0, 0]} />;
    });

    const keys = times(find(model, "knob").at);

    expect(keys.at(-1)![1][0] - keys[0]![1][0]).toBeCloseTo(20, 9);
  });

  test("trim and stroke on an arrow's ref draw and recolor its shaft and head", () => {
    const model = made(() => {
      const [a, b, arrow] = [ref("a"), ref("b"), ref("arrow")];

      arrow.set({ trim: [0, 0] }, span(0));
      arrow.to({ trim: [0, 1] }, span(0, 1), ease.linear);
      arrow.to({ stroke: { color: "#ff0000" } }, span(1, 0.5));

      return (
        <Group>
          <Shape fill="#000000" ref={a} geometry={rect(10, 10)} at={[0, 0]} />
          <Shape fill="#000000" ref={b} geometry={rect(10, 10)} at={[100, 0]} />
          <Arrow ref={arrow} from={a.right} to={b.left} stroke={{ color: "#000000" }} />
        </Group>
      );
    });

    const shaft = find(model, "arrow/shaft");
    const head = find(model, "arrow/head");

    expect(shaft.kind === "shape" && valueAt(shaft.trim!, 0.5, blendVec)).toEqual([0, 0.5]);
    expect(shaft.kind === "shape" && isLane(shaft.stroke!.color)).toBe(true);
    expect(head.kind === "shape" && isLane(head.stroke!.color)).toBe(true);
  });

  test("verbs on a group's parts, going back to the start, return every part home", () => {
    const model = made(() => {
      const toggle = ref("toggle");

      toggle.part("knob").move([23, 3], span(0, 0.5));
      toggle.part("groove").to({ fill: "#ff0000" }, span(0.5, 0.5));
      toggle.part("knob").move([3, 3], span(3.5, 0.5));
      toggle.part("groove").to({ fill: "#000000" }, span(3.5, 0.5));

      return (
        <Group ref={toggle}>
          <Shape fill="#000000" key="groove" geometry={rect(44, 24)} />
          <Shape fill="#ffffff" key="knob" geometry={circle(9)} at={[3, 3]} />
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
  test("a verb returns the span it ran in, and next() chains the verb after it", () => {
    const model = made(() => {
      const dot = ref("dot");
      const first = dot.move([1, 0], span(0, 1));

      expect([first.start, first.over, first.end]).toEqual([0, 1, 1]);
      dot.move([2, 0], first.next(1, 0.5));

      return <Shape fill="#000000" ref={dot} geometry={circle(4)} anchor="center" />;
    }, 10);

    expect(times(find(model, "dot").at).map(([t]) => t)).toEqual([0, 1, 1.5, 2.5, 10]);
  });

  test("cascade starts each verb a step after the one before", () => {
    const model = made(() => {
      const dots = [ref("a"), ref("b"), ref("c")];
      const spans = span(0, 1).cascade(3, 0.25);

      dots.forEach((dot, i) => dot.to({ opacity: 1 }, spans[i]!));

      return (
        <Group>
          {dots.map((dot) => (
            <Shape fill="#000000" ref={dot} geometry={circle(2)} opacity={0} />
          ))}
        </Group>
      );
    });

    const lit = (key: string) =>
      times(own(find(model, key)).opacity).find(([, value]) => value === 1)![0];

    expect(["a", "b", "c"].map(lit)).toEqual([1, 1.25, 1.5]);
  });

  test("a component can make its own verbs over its own refs", () => {
    const lamp = () => {
      const bulb = ref("bulb");

      return {
        node: <Shape ref={bulb} geometry={circle(4)} fill="#000000" opacity={0.2} />,
        blink: (at: number) => {
          const on = bulb.to({ opacity: 1 }, span(at, 0.1));

          return bulb.to({ opacity: 0.2 }, on.next(0.1, 0.3));
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
  test("verbs give exactly the lanes the same hand-written tracks give", () => {
    const viaVerbs = made(() => {
      const card = ref("card");

      card.move([80, 40], span(0.25, 1), ease.inOut);
      card.to({ rotate: 30 }, span(0.25, 1), ease.spring({ stiffness: 300, damping: 30 }));
      card.to({ opacity: 0.4 }, span(1.25, 0.5));
      card.move([10, 10], span(3, 1), ease.linear);
      card.to({ rotate: 0 }, span(3, 1), ease.linear);
      card.to({ opacity: 1 }, span(3, 1), ease.linear);

      return <Shape fill="#000000" ref={card} geometry={rect(20, 10)} at={[10, 10]} />;
    });

    const byHand = made(() => (
      <Shape
        fill="#000000"
        key="card"
        geometry={rect(20, 10)}
        at={track([10, 10]).to([80, 40], span(0.25, 1), ease.inOut).rewind(1, ease.linear)}
        rotate={track(0)
          .to(30, span(0.25, 1), ease.spring({ stiffness: 300, damping: 30 }))
          .rewind(1, ease.linear)}
        opacity={track(1).to(0.4, span(1.25, 0.5)).rewind(1, ease.linear)}
      />
    ));

    expect(viaVerbs.root).toEqual(byHand.root);
  });

  test("a spring may be cut by the next verb on the same prop, which carries its speed on", () => {
    const model = made(() => {
      const dot = ref("dot");
      const spring = ease.spring({ stiffness: 120, damping: 8 });

      dot.move([100, 0], span(0, 2), spring);
      dot.move([0, 50], span(0.3, 2), spring);

      return <Shape fill="#000000" ref={dot} geometry={circle(4)} anchor="center" />;
    });

    expect(valueAt(find(model, "dot").at, 4, blendVec)).toEqual([0, 50]);
  });

  test("two verbs that move one prop at once throw, naming the key and the prop", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        dot.move([1, 0], span(0, 1));
        dot.move([2, 1], span(0.5, 1));

        return <Shape fill="#000000" ref={dot} geometry={circle(4)} anchor="center" />;
      }),
    ).toThrow(
      'dot.move() moves at on <Shape> "dot" from 0s to 1s, and dot.move() moves it too from 0.5s to 1.5s, before the first one ends. Start dot.move() at 1s or later',
    );
  });

  test("a prop a track already moves can't be moved by a verb too", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        dot.to({ opacity: 0 }, span(0, 1));

        return (
          <Shape
            fill="#000000"
            ref={dot}
            geometry={circle(4)}
            anchor="center"
            opacity={track(1).to(0.5, span(2, 1))}
          />
        );
      }),
    ).toThrow('dot.to() moves opacity on <Shape> "dot", which a track already moves');
  });
});

describe("errors", () => {
  const throws = (build: () => SceneElement, message: string) =>
    expect(() => made(build)).toThrow(message);

  test("a prop the node has no such thing for names the node and the kinds that have it", () => {
    throws(() => {
      const g = ref("g");

      g.to({ fill: "#ffffff" }, span(0, 1));

      return <Group ref={g} />;
    }, 'g.to() moves fill on <Group> "g", which has none. Only shape or text or container nodes have fill.');

    throws(() => {
      const s = ref("s");

      s.to({ stroke: { color: "#ffffff" } }, span(0, 1));

      return <Shape fill="#000000" ref={s} geometry={circle(2)} anchor="center" />;
    }, 'changes the stroke of <Shape> "s", which has none');
  });

  test("a ref on no node, or a part no node is, is named", () => {
    throws(() => {
      ref("ghost").to({ opacity: 1 }, span(0, 1));

      return <Shape fill="#000000" geometry={circle(2)} />;
    }, 'ghost.to() moves the ref "ghost", which is on no node');

    throws(() => {
      const card = ref("card");

      card.part("lid").to({ opacity: 1 }, span(0, 1));

      return <Group ref={card} />;
    }, 'no node is keyed "lid"');
  });

  test("a node a container places can't have its at moved", () => {
    throws(() => {
      const dot = ref("dot");

      dot.move([5, 5], span(0, 1));

      return (
        <Group>
          <Stack>
            <Shape fill="#000000" ref={dot} geometry={circle(2)} anchor="center" />
          </Stack>
        </Group>
      );
    }, "Wrap it in a <Group>");
  });

  test("a verb outside a scene, and verbs with no time, throw", () => {
    expect(() => ref("a").to({ opacity: 1 }, span(0, 1))).toThrow(
      "is only known while scene()'s callback runs",
    );
    expect(() => ref("a").move([0, 0], span(0, 0))).toThrow(
      "a.move() needs a span with a positive length, got 0s. Use set() for a cut.",
    );
    // SAFETY: a deliberately wrong prop, as untyped code could pass, to see the error it gets.
    expect(() => ref("a").to({ size: 3 } as never, span(0, 1))).toThrow(
      'a.to() can\'t move "size"',
    );
  });
});

describe("clocks", () => {
  test("a verb inside a sequence runs on its clock", () => {
    const model = made(() => {
      const dot = ref("dot");

      dot.move([10, 0], span(0, 1), ease.linear);

      return (
        <Sequence when={span(1.5)}>
          <Shape fill="#000000" ref={dot} geometry={circle(2)} anchor="center" />
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
