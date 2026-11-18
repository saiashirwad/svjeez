/** @jsxImportSource svjeez/scene */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Shape,
  Stack,
  circle,
  ease,
  isLane,
  par,
  rect,
  ref,
  scene,
  seq,
  span,
  stagger,
  timeline,
  track,
  wait,
  type Action,
  type Model,
  type SceneElement,
} from "svjeez/scene";
import { blendNumber, blendVec, valueAt } from "../src/scene/sample";

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
  test("move, moveBy, rotate, scale and fade write the node's own props, from its own values", () => {
    const model = made(() => {
      const dot = ref("dot");

      timeline(
        dot.move([50, 20], 1, ease.linear),
        dot.moveBy([10, 0], 0.5, ease.linear),
        par(dot.rotate(90, 1), dot.scale(2, 1), dot.fade(0.5, 1)),
      );

      return <Shape ref={dot} geometry={circle(4)} anchor="center" at={[10, 20]} rotate={15} />;
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

  test("show and hide fade to 1 and 0; fill, stroke and trim move a shape's paint", () => {
    const model = made(() => {
      const box = ref("box");

      timeline(
        box.show(0.5),
        box.fill("#ff0000", 0.5),
        box.stroke("#00ff00", 0.5),
        box.trim([0, 0.5], 0.5),
        box.hide(0.5),
      );

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

  test("draw cuts the trim to nothing and strokes it on", () => {
    const line = (draw: (action: Action) => void) =>
      made(() => {
        const stroke = ref("s");

        draw(seq(wait(1), stroke.draw(1, ease.linear)));

        return <Shape ref={stroke} geometry={rect(10, 10)} stroke={{ color: "#000000" }} />;
      });

    const node = find(
      line((action) => timeline(action)),
      "s",
    );

    expect(node.kind === "shape" && valueAt(node.trim!, 0.5, blendVec)).toEqual([0, 1]);
    expect(node.kind === "shape" && valueAt(node.trim!, 1.5, blendVec)[1]).toBeCloseTo(0.5);
    expect(node.kind === "shape" && valueAt(node.trim!, 3, blendVec)).toEqual([0, 1]);
  });

  test("to moves several props at once, and set cuts them", () => {
    const model = made(() => {
      const dot = ref("dot");

      timeline(
        dot.to({ at: [40, 0], opacity: 0.5 }, 1, ease.linear),
        wait(1),
        dot.set({ at: [0, 0] }),
      );

      return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
    });

    const dot = find(model, "dot");

    expect(valueAt(dot.at, 1, blendVec)).toEqual([40, 0]);
    expect(valueAt(dot.at, 1.99, blendVec)).toEqual([40, 0]);
    expect(valueAt(dot.at, 2.01, blendVec)).toEqual([0, 0]);
    expect(valueAt(own(dot).opacity, 3, blendNumber)).toBe(0.5);
  });

  test("rewind glides everything the timeline moved on a node back over the clock's last seconds", () => {
    const model = made(() => {
      const dot = ref("dot");

      timeline(par(dot.move([40, 0], 1), dot.rotate(90, 1)), dot.rewind(0.5, ease.linear));

      return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
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

  test("moveTo lands the point the node's at names on another ref's anchor, or a point of it named by options.point", () => {
    const model = made(() => {
      const target = ref("target");
      const a = ref("a");
      const b = ref("b");

      timeline(
        par(
          a.moveTo(target, 1),
          b.moveTo(target.part("pin").topLeft, 1, ease.out, { point: "center" }),
        ),
      );

      return (
        <Group>
          <Group ref={target} at={[100, 50]}>
            <Shape geometry={rect(20, 10)} />
            <Shape key="pin" geometry={rect(4, 4)} at={[30, 30]} />
          </Group>
          <Shape ref={a} geometry={circle(2)} anchor="center" />
          <Group at={[10, 10]}>
            <Shape ref={b} geometry={rect(6, 6)} />
          </Group>
        </Group>
      );
    });

    expect(times(find(model, "a").at).at(-1)).toEqual([4, [117, 67]]);
    expect(times(find(model, "2/b").at).at(-1)).toEqual([4, [117, 67]]);
  });

  test("moveTo a moving anchor lands where the anchor is when the move ends", () => {
    const model = made(() => {
      const card = ref("card");
      const dot = ref("dot");

      timeline(par(card.move([100, 0], 2, ease.linear), dot.moveTo(card.right, 1, ease.linear)));

      return (
        <Group>
          <Shape ref={card} geometry={rect(20, 10)} />
          <Shape ref={dot} geometry={circle(2)} anchor="center" />
        </Group>
      );
    });

    const [x, y] = valueAt(find(model, "dot").at, 1, blendVec);

    expect(x).toBeCloseTo(70, 6);
    expect(y).toBeCloseTo(5, 6);
  });
});

describe("combinators", () => {
  const starts = (build: (dot: ReturnType<typeof ref>) => Action) => {
    const model = made(() => {
      const dot = ref("dot");

      timeline(build(dot));

      return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
    }, 10);

    return times(find(model, "dot").at).map(([t]) => t);
  };

  test("seq plays end to end, wait pauses, par starts together and lasts as long as the longest", () => {
    expect(starts((dot) => seq(dot.move([1, 0], 1), wait(0.5), dot.move([2, 0], 1)))).toEqual([
      0, 1, 1.5, 2.5, 10,
    ]);

    const p = par(wait(2), seq(wait(0.5)));

    expect(p.length).toBe(2);
    expect(seq(p, wait(1)).length).toBe(3);
  });

  test("stagger starts each action a step after the one before", () => {
    const model = made(() => {
      const dots = [ref("a"), ref("b"), ref("c")];

      timeline(stagger(0.25, ...dots.map((dot) => dot.show(1))));

      return (
        <Group>
          {dots.map((dot) => (
            <Shape ref={dot} geometry={circle(2)} anchor="center" opacity={0} />
          ))}
        </Group>
      );
    });

    const lit = (key: string) =>
      times(own(find(model, key)).opacity).find(([, value]) => value === 1)![0];

    expect(["a", "b", "c"].map(lit)).toEqual([1, 1.25, 1.5]);
    expect(stagger(span(0, 1), 3, 0.5).map((each) => each.at)).toEqual([0, 0.5, 1]);
  });

  test("labels read spans back on the timeline's clock, and end is when the last action ends", () => {
    let read: ReturnType<typeof timeline> | undefined;

    made(() => {
      const dot = ref("dot");

      read = timeline(
        dot.move([1, 0], 0.5),
        seq(wait(0.2), dot.move([2, 0], 1).as("grab")).as("tail"),
      );

      return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
    });

    expect(read!.span("grab").at).toBeCloseTo(0.7);
    expect(read!.span("grab").over).toBe(1);
    expect(read!.span("tail").end).toBeCloseTo(1.7);
    expect(read!.end).toBeCloseTo(1.7);
    expect(() => read!.span("nope")).toThrow('It has "grab", "tail"');
    expect(() => seq(wait(1).as("x"), wait(1).as("x"))).toThrow('both named "x"');
  });

  test("a component can make its own verbs over its own refs", () => {
    const lamp = () => {
      const bulb = ref("bulb");

      return {
        node: (
          <Shape ref={bulb} geometry={circle(4)} anchor="center" fill="#000000" opacity={0.2} />
        ),
        blink: (): Action => seq(bulb.show(0.1), wait(0.3), bulb.fade(0.2, 0.1)),
      };
    };

    const model = made(() => {
      const one = lamp();

      timeline(wait(1), one.blink(), one.blink());

      return <Group>{one.node}</Group>;
    });

    expect(times(own(find(model, "bulb")).opacity).map(([, value]) => value)).toEqual([
      0.2, 0.2, 1, 1, 0.2, 1, 1, 0.2, 0.2,
    ]);
  });

  test("combinators take only actions", () => {
    // @ts-expect-error a track is not an action
    expect(() => seq(track(0))).toThrow("seq() takes actions");
  });
});

describe("tracks", () => {
  test("a timeline gives exactly the lanes the same hand-written tracks give", () => {
    const viaTimeline = made(() => {
      const card = ref("card");

      timeline(
        wait(0.25),
        par(
          card.move([80, 40], 1, ease.inOut),
          card.rotate(30, 1, ease.spring({ stiffness: 300, damping: 30 })),
        ),
        card.fade(0.4, 0.5),
        card.rewind(1, ease.linear),
      );

      return <Shape ref={card} geometry={rect(20, 10)} at={[10, 10]} />;
    });

    const byHand = made(() => (
      <Shape
        key="card"
        geometry={rect(20, 10)}
        at={track([10, 10]).to([80, 40], span(0.25, 1), ease.inOut).rewind(1, ease.linear)}
        rotate={track(0)
          .to(30, span(0.25, 1), ease.spring({ stiffness: 300, damping: 30 }))
          .rewind(1, ease.linear)}
        opacity={track(1).to(0.4, span(1.25, 0.5)).rewind(1, ease.linear)}
      />
    ));

    expect(viaTimeline.root).toEqual(byHand.root);
  });

  test("a spring may be cut by the next action on the same prop, which carries its speed on", () => {
    const model = made(() => {
      const dot = ref("dot");
      const spring = ease.spring({ stiffness: 120, damping: 8 });

      timeline(par(dot.move([100, 0], 2, spring), seq(wait(0.3), dot.move([0, 50], 2, spring))));

      return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
    });

    expect(valueAt(find(model, "dot").at, 4, blendVec)).toEqual([0, 50]);
  });

  test("two actions that move one prop at once throw, naming the key and the prop", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        timeline(par(dot.move([1, 0], 1), seq(wait(0.5), dot.moveBy([1, 1], 1))));

        return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
      }),
    ).toThrow('dot.move() and dot.moveBy() both move at on "dot" between 0.5s and 1s');
  });

  test("a prop a track already moves can't be moved by a timeline too", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        timeline(dot.fade(0, 1));

        return (
          <Shape
            ref={dot}
            geometry={circle(4)}
            anchor="center"
            opacity={track(1).to(0.5, span(2, 1))}
          />
        );
      }),
    ).toThrow('dot.fade() moves opacity on "dot", which a track already moves');
  });

  test("a rewind that runs into the actions throws as a track's does", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        timeline(dot.move([1, 0], 3.5), dot.rewind(1));

        return <Shape ref={dot} geometry={circle(4)} anchor="center" />;
      }),
    ).toThrow('rewind(1) on at on "dot" needs the last 1s');
  });
});

describe("errors", () => {
  const throws = (build: () => SceneElement, message: string) =>
    expect(() => made(build)).toThrow(message);

  test("a prop the node has no such thing for names the node and the kinds that have it", () => {
    throws(() => {
      const g = ref("g");

      timeline(g.fill("#ffffff", 1));

      return <Group ref={g} />;
    }, 'g.fill() moves fill on "g", a group, which has none. Only shape or text nodes have fill.');

    throws(() => {
      const s = ref("s");

      timeline(s.stroke("#ffffff", 1));

      return <Shape ref={s} geometry={circle(2)} anchor="center" />;
    }, 'changes the stroke of "s", which has none');
  });

  test("a ref on no node, or a part no node is, is named", () => {
    throws(() => {
      timeline(ref("ghost").show(1));

      return <Shape geometry={circle(2)} anchor="center" />;
    }, 'ghost.show() moves the ref "ghost", which is on no node');

    throws(() => {
      const card = ref("card");

      timeline(card.part("lid").show(1));

      return <Group ref={card} />;
    }, 'no node is keyed "lid"');
  });

  test("a node a container places can't have its at moved", () => {
    throws(() => {
      const dot = ref("dot");

      timeline(dot.move([5, 5], 1));

      return (
        <Group>
          <Stack>
            <Shape ref={dot} geometry={circle(2)} anchor="center" />
          </Stack>
        </Group>
      );
    }, "Wrap it in a <Group>");
  });

  test("timeline() outside a scene, and verbs with no time, throw", () => {
    expect(() => timeline(wait(1))).toThrow(
      "timeline() is only known while scene()'s callback runs",
    );
    expect(() => ref("a").move([0, 0], 0)).toThrow(
      "a.move() needs a positive number of seconds, got 0. Use set() for a cut.",
    );
    // SAFETY: a deliberately wrong prop, as untyped code could pass, to see the error it gets.
    expect(() => ref("a").to({ size: 3 } as never, 1)).toThrow('a.to() can\'t move "size"');
  });
});

describe("clocks", () => {
  test("a timeline given to a sequence runs on its clock", () => {
    const model = made(() => {
      const dot = ref("dot");
      const steps = timeline(dot.move([10, 0], 1, ease.linear));

      return (
        <Sequence at={1.5} timeline={steps}>
          <Shape ref={dot} geometry={circle(2)} anchor="center" />
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

  test("a node on another clock than its timeline's throws, and says where to give the timeline", () => {
    expect(() =>
      made(() => {
        const dot = ref("dot");

        timeline(dot.show(1));

        return (
          <Sequence at={1}>
            <Shape ref={dot} geometry={circle(2)} anchor="center" />
          </Sequence>
        );
      }),
    ).toThrow("Give the timeline to that sequence: <Sequence at={…} timeline={…}>");

    expect(() =>
      made(() => {
        const dot = ref("dot");
        const steps = timeline(dot.show(1));

        return (
          <Group>
            <Shape ref={dot} geometry={circle(2)} anchor="center" />
            <Sequence at={1} timeline={steps} />
          </Group>
        );
      }),
    ).toThrow('dot.show() moves "dot", which sits outside the <Sequence> its timeline is given to');
  });
});
