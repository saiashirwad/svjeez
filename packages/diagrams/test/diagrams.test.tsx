import { describe, expect, test } from "bun:test";
import { render, type Rect, type SvgNode } from "svjeez";
import { flowchart, lanes, sequence, stateMachine, tree } from "../src/index.ts";

const valid = (node: SvgNode) =>
  render({ width: 800, height: 600, duration: 10, title: "diagram" }, node);

const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.w <= outer.x + outer.w + 1e-6 &&
  inner.y + inner.h <= outer.y + outer.h + 1e-6;

const touches = (p: { x: number; y: number }, b: Rect) =>
  p.x >= b.x - 1e-6 && p.x <= b.x + b.w + 1e-6 && p.y >= b.y - 1e-6 && p.y <= b.y + b.h + 1e-6;

describe("flowchart", () => {
  const chart = flowchart(
    {
      nodes: {
        start: { label: "Start", role: "input" },
        check: { label: "Ok?", role: "decision" },
        work: "Work",
        db: { label: "Save", role: "store" },
        end: { label: "Done", role: "output" },
      },
      groups: { core: { label: "Core", nodes: ["check", "work"] } },
      edges: [
        ["start", "check"],
        ["check", "work", "yes"],
        ["work", "check"],
        ["check", "db", "no"],
        ["db", "end"],
      ],
    },
    { x: 100, y: 50, play: { at: 1 } },
  );

  test("bounds start at x, y and hold every node and group", () => {
    expect([chart.bounds.x, chart.bounds.y]).toEqual([100, 50]);

    for (const id of ["start", "check", "work", "db", "end", "core"] as const)
      expect(inside(chart.bounds, chart.part(id).box)).toBe(true);
    expect(inside(chart.part("core").box, chart.part("work").box)).toBe(true);
  });

  test("route runs edge to edge from the first node to the last, and throws with no path", () => {
    const trip = chart.route("start", "end");
    expect(touches(trip[0]!, chart.part("start").box)).toBe(true);
    expect(touches(trip.at(-1)!, chart.part("end").box)).toBe(true);
    expect(chart.route("work", "end").slice(0, chart.edge("work", "check").length)).toEqual(
      chart.edge("work", "check"),
    );
    expect(() => chart.route("end", "start")).toThrow();
    expect(() => chart.edge("start", "end")).toThrow();
  });

  test("a decision's edges end on the diamond, not its bounding box", () => {
    const into = chart.edge("start", "check").at(-1)!;
    const b = chart.part("check").box;
    expect(
      Math.abs(into.x - b.center.x) / (b.w / 2) + Math.abs(into.y - b.center.y) / (b.h / 2),
    ).toBeCloseTo(1, 6);
  });

  test("renders valid SVG, static and revealed", () => {
    expect(() => valid(chart.node)).not.toThrow();
    expect(() => valid(flowchart({ nodes: { a: "A" }, edges: [] }).node)).not.toThrow();
  });
});

describe("sequence", () => {
  const seq = sequence(
    {
      actors: { user: "User", api: { label: "API" }, db: { label: "Postgres", role: "store" } },
      messages: [
        ["user", "api", "POST /login"],
        ["api", "db", "select"],
        ["db", "api", "row", { reply: true }],
        ["api", "api", "hash"],
        { note: "api", text: "ok" },
      ],
    },
    { play: { at: 2, step: 0.5 } },
  );

  test("message i runs between the two lifelines in its play slot", () => {
    const { span, points } = seq.message(1);
    expect(span).toEqual({ at: 2.5, over: 0.5 });
    expect(points.map((p) => p.x)).toEqual([
      seq.part("api").box.center.x,
      seq.part("db").box.center.x,
    ]);
    expect(seq.message(2).points[0]!.y).toBeGreaterThan(points[0]!.y);
    expect(() => seq.message(5)).toThrow();
  });

  test("renders valid SVG", () => expect(() => valid(seq.node)).not.toThrow());

  test("with one time per row, each message runs until the next starts", () => {
    const timed = sequence(
      {
        actors: { a: "A", b: "B" },
        messages: [["a", "b", "x"], ["b", "a", "y"], { note: "a", text: "z" }],
      },
      { play: { at: [1, 1.5, 4], step: 0.6 } },
    );

    expect([0, 1, 2].map((i) => timed.message(i).span)).toEqual([
      { at: 1, over: 0.5 },
      { at: 1.5, over: 2.5 },
      { at: 4, over: 0.6 },
    ]);
    expect(() =>
      sequence({ actors: { a: "A" }, messages: [["a", "a", "x"]] }, { play: { at: [1, 2] } }),
    ).toThrow();
  });
});

describe("state", () => {
  const machine = stateMachine({
    states: { idle: "Idle", run: { label: "Running" }, done: { label: "Done", final: true } },
    initial: "idle",
    transitions: [
      ["idle", "run", "start"],
      ["run", "idle", "pause"],
      ["run", "done"],
    ],
  });

  test("walk lights each state for its dwell, with travel time between", () => {
    const walk = machine.walk(["idle", "run", "idle", "run", "done"], {
      at: 1,
      dwell: 1,
      speed: 1e9,
    });

    expect(walk.spans.idle.map((s) => s.at)).toEqual([1, expect.closeTo(3.7, 9)]);
    expect(walk.spans.done[0]!.at).toBeCloseTo(1 + 4 * 1.35, 9);
    expect(walk.span.end).toBeCloseTo(1 + 5 + 4 * 0.35, 9);
    expect(() =>
      valid(
        <g>
          {machine.node}
          {walk.node}
        </g>,
      ),
    ).not.toThrow();
  });

  test("with one time per state, each lights then, the token arriving as it does", () => {
    const walk = machine.walk(["idle", "run", "done"], { at: [1, 5, 6], dwell: 2, speed: 1e9 });
    expect([walk.spans.idle[0]!.at, walk.spans.run[0]!.at, walk.spans.done[0]!.at]).toEqual([
      1, 5, 6,
    ]);
    expect(walk.spans.idle[0]!.over).toBeCloseTo(4 - 0.35, 9);
    expect(walk.spans.run[0]!.over).toBeCloseTo(1 - 0.35, 9);
    expect(walk.span.end).toBe(8);
    expect(() => machine.walk(["idle", "run"], { at: [2, 1] })).toThrow();
  });

  test("anchor puts that point of the bounds on x, y", () => {
    const centered = stateMachine(
      { states: { a: "A", b: "B" }, initial: "a", transitions: [["a", "b"]] },
      { x: 400, y: 300, anchor: "center" },
    );

    expect(centered.bounds.center).toEqual({ x: 400, y: 300 });
    const below = sequence({ actors: { a: "A" }, messages: [] }, { x: 50, y: 20, anchor: "top" });
    expect(below.bounds.top).toEqual({ x: 50, y: 20 });
  });

  test("walk throws when consecutive states have no transition", () => {
    expect(() => machine.walk(["idle", "done"], { at: 0 })).toThrow();
  });

  test("the initial state sits below its marker and a final state above its bullseye", () => {
    expect(machine.part("idle").box.y).toBeGreaterThan(machine.bounds.y + 14);
    expect(machine.bounds.y + machine.bounds.h).toBeGreaterThan(
      machine.part("done").box.y + machine.part("done").box.h + 18,
    );
  });

  describe("composite", () => {
    const review = stateMachine({
      states: {
        draft: "Draft",
        review: {
          label: "Review",
          states: { screening: "Screening", decision: "Decision" },
          initial: "screening",
        },
        published: { label: "Published", final: true },
      },
      initial: "draft",
      transitions: [
        ["draft", "review", "submit"],
        ["screening", "decision"],
        ["review", "draft", "rejected"],
        ["decision", "published", "approved"],
      ],
    });

    test("inner states sit inside their container, below its header", () => {
      for (const id of ["screening", "decision"] as const) {
        expect(inside(review.part("review").box, review.part(id).box)).toBe(true);
        expect(review.part(id).box.y).toBeGreaterThan(review.part("review").box.y + 30);
      }
    });

    test("a transition to the composite ends on its border; one from an inner state leaves the container", () => {
      const into = review.edge("draft", "review").at(-1)!;
      expect(into.y).toBeCloseTo(review.part("review").box.y, 6);
      const out = review.edge("decision", "published");
      expect(touches(out[0]!, review.part("review").box)).toBe(true);
      expect(inside(review.part("review").box, review.part("published").box)).toBe(false);
    });

    test("a walk enters a composite through its initial state and leaves through its transitions", () => {
      const walk = review.walk(["draft", "review", "screening", "decision", "published"], {
        at: 0,
      });

      expect(walk.spans.screening).toHaveLength(1);
      expect(() => review.walk(["draft", "decision"], { at: 0 })).toThrow();
      expect(() =>
        valid(
          <g>
            {review.node}
            {walk.node}
          </g>,
        ),
      ).not.toThrow();
    });
  });
});

describe("diagram options", () => {
  const spec = {
    nodes: { a: "A", b: "B", c: "C" },
    edges: [
      ["a", "b"],
      ["b", "c"],
    ],
  } as const;

  test("direction is an option and turns the ranks sideways", () => {
    const [down, across] = [flowchart(spec), flowchart(spec, { direction: "LR" })];
    expect(down.part("c").box.y).toBeGreaterThan(down.part("a").box.y);
    expect(across.part("c").box.x).toBeGreaterThan(across.part("a").box.x);
    expect(across.part("c").box.y).toBeCloseTo(across.part("a").box.y, 6);
  });

  test("play takes a start and a step, or one time per node after the first", () => {
    const times = (svg: string) =>
      [...svg.matchAll(/animation-delay:(-?[\d.]+)s/g)].map((m) => Number(m[1]));

    const stepped = times(valid(flowchart(spec, { play: { at: 1, step: 2 } }).node));
    const listed = times(valid(flowchart(spec, { play: { at: [1, 3] } }).node));
    expect(stepped.length).toBeGreaterThan(0);
    expect(Math.max(...stepped)).toBeCloseTo(Math.max(...listed), 6);
    expect(() => flowchart(spec, { play: { at: [1] } })).toThrow(/needs 2 times, got 1/);
    expect(() =>
      tree({ nodes: { r: "R", k: { label: "K", parent: "r" } } }, { play: { at: [1, 2] } }),
    ).toThrow(/needs 1 times, got 2/);
  });
});

describe("tree", () => {
  const team = tree(
    {
      nodes: {
        root: "Root",
        a: { label: "A", parent: "root" },
        b: { label: "B", parent: "root", role: "tool" },
        a1: { label: "A1", parent: "a" },
      },
    },
    { play: { at: 1 } },
  );

  test("route runs from one node up through the common ancestor and down to the other", () => {
    const trip = team.route("a1", "b");
    expect(touches(trip[0]!, team.part("a1").box)).toBe(true);
    expect(touches(trip.at(-1)!, team.part("b").box)).toBe(true);
    expect(Math.min(...trip.map((p) => p.y))).toBeCloseTo(
      team.part("root").box.y + team.part("root").box.h,
      6,
    );
  });

  test("a parent sits centered over its children", () => {
    expect(team.part("root").box.center.x).toBeCloseTo(
      (team.part("a").box.center.x + team.part("b").box.center.x) / 2,
      6,
    );
    expect(() => valid(team.node)).not.toThrow();
  });
});

describe("lanes", () => {
  const run = lanes(
    {
      lanes: { a: "A", b: { label: "B", role: "tool" } },
      spans: [{ lane: "a", at: 0, over: 2, label: "busy" }],
      events: [{ lane: "b", at: 1, label: "READ" }],
      links: [{ from: "a", to: "b", at: 1.5 }],
    },
    { scale: 50, x: 10, y: 20, play: { at: 0 } },
  );

  test("x maps seconds onto the lane axis at the given scale", () => {
    expect(run.x(2) - run.x(1)).toBe(50);
    expect(run.x(0)).toBeGreaterThan(run.part("a").box.x);
    expect(run.part("b").box.y).toBe(run.part("a").box.y + run.part("a").box.h);
    expect(() => valid(run.node)).not.toThrow();
  });
});

describe("named errors", () => {
  test("walk() names a state the machine does not have", () => {
    const machine = stateMachine({
      states: { a: "A", b: "B" },
      initial: "a",
      transitions: [["a", "b"]],
    });

    // @ts-expect-error "zz" is not a state
    expect(() => machine.walk(["a", "zz"], { at: 0 })).toThrow('walk() has no state "zz"');
  });

  test("flowchart() needs a node", () => {
    expect(() => flowchart({ nodes: {}, edges: [] })).toThrow(
      "flowchart() needs at least one node",
    );
  });

  test("lanes() rejects a link from a lane to itself", () => {
    expect(() =>
      lanes({ lanes: { a: "A" }, links: [{ from: "a", to: "a", at: 1 }] }, { scale: 10 }),
    ).toThrow("lanes() needs a link between two different lanes");
  });
});

describe("state scopes", () => {
  test("a composite and its inner state cannot share an id", () => {
    expect(() =>
      stateMachine({
        states: { a: { label: "A", initial: "a", states: { a: "Inner" } } },
        initial: "a",
        transitions: [],
      }),
    ).toThrow('two states named "a"');
  });

  test("a transition between a composite and its own inner state is rejected, not drawn as a loop", () => {
    expect(() =>
      stateMachine({
        states: { box: { label: "Box", initial: "in", states: { in: "In" } } },
        initial: "box",
        transitions: [["box", "in"]],
      }),
    ).toThrow("one holds the other");
  });
});

describe("span", () => {
  const chain = {
    nodes: { a: "A", b: "B", c: "C" },
    edges: [
      ["a", "b"],
      ["b", "c"],
    ],
  } as const;

  const window = (s: { at: number; end: number }) => [s.at, s.end];

  test("a diagram without play is the instant 0", () => {
    expect(window(flowchart(chain).span)).toEqual([0, 0]);
    expect(window(tree({ nodes: { r: "R", k: { label: "K", parent: "r" } } }).span)).toEqual([
      0, 0,
    ]);
  });

  test("a flowchart runs from its first reveal to the last node settling", () => {
    const { span } = flowchart(chain, { play: { at: [1, 3] } });

    expect(span.at).toBeGreaterThan(0);
    expect(span.at).toBeLessThan(1);
    expect(span.end).toBeCloseTo(3.35, 6);
  });

  test("a tree ends when its last node has popped in", () => {
    const { span } = tree(
      { nodes: { r: "R", k: { label: "K", parent: "r" }, j: { label: "J", parent: "r" } } },
      { play: { at: 2, step: 1 } },
    );

    expect(span.at).toBeGreaterThanOrEqual(1.65);
    expect(span.end).toBeCloseTo(3.35, 6);
  });

  test("a sequence covers its first message to the end of its last", () => {
    const { span } = sequence(
      {
        actors: { a: "A", b: "B" },
        messages: [
          ["a", "b", "x"],
          ["b", "a", "y"],
        ],
      },
      { play: { at: 2, step: 0.8 } },
    );

    expect(span.at).toBe(2);
    expect(span.end).toBeCloseTo(3.3, 6);
  });

  test("lanes end with the playhead", () => {
    const { span } = lanes(
      { lanes: { a: "A" }, spans: [{ lane: "a", at: 0, over: 2 }] },
      { scale: 50, play: { at: 1 } },
    );

    expect(span.at).toBe(1);
    expect(span.end).toBeGreaterThanOrEqual(3);
  });
});

describe("parts", () => {
  const chain = {
    nodes: { a: "A", b: "B", c: "C" },
    groups: { pair: { label: "Pair", nodes: ["b", "c"] } },
    edges: [
      ["a", "b"],
      ["b", "c"],
    ],
  } as const;

  const window = (s: { at: number; end: number }) => [s.at, s.end];

  test("each node's span is when it pops in, and the first rank's is the instant 0", () => {
    const chart = flowchart(chain, { play: { at: 1, step: 0.5 } });

    expect(chart.parts.map((p) => p.id)).toEqual(["a", "b", "c", "pair"]);
    expect(window(chart.part("a").span)).toEqual([0, 0]);
    expect(window(chart.part("b").span)).toEqual([1, 1.35]);
    expect(window(chart.part("c").span)).toEqual([1.5, 1.85]);
    expect(window(chart.part("pair").span)).toEqual([1, 1.4]);
    expect(chart.part("c").box).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
  });

  test("play takes a time per node, and the nodes it leaves out are there from the start", () => {
    const chart = flowchart(chain, { play: { at: { c: 1, a: 2 } } });

    expect(window(chart.part("c").span)).toEqual([1, 1.35]);
    expect(window(chart.part("a").span)).toEqual([2, 2.35]);
    expect(window(chart.part("b").span)).toEqual([0, 0]);
    // The edge from a to b draws on as a appears, which ends the reveal.
    expect(chart.span.end).toBeCloseTo(2.4, 6);
    expect(
      render({ width: 400, height: 400, duration: 3, title: "Schedule" }, [chart.node]),
    ).toContain("@keyframes");

    const team = tree(
      { nodes: { r: "R", k: { label: "K", parent: "r" }, j: { label: "J", parent: "r" } } },
      { play: { at: { j: 0.5, k: 3 } } },
    );

    expect([team.part("r"), team.part("j"), team.part("k")].map((p) => p.span.at)).toEqual([
      0, 0.5, 3,
    ]);
  });

  test("a schedule names only nodes, at times of 0 or later", () => {
    // @ts-expect-error: "z" is not a node
    expect(() => flowchart(chain, { play: { at: { z: 1 } } })).toThrow(
      'flowchart() play names "z", which is not a node. Its nodes are "a", "b", "c".',
    );
    expect(() => flowchart(chain, { play: { at: { a: -1 } } })).toThrow(
      'flowchart() play needs a time of 0 or later for "a", got -1.',
    );
  });

  test("part() is typed by id, and names the parts it has when one is missing", () => {
    const chart = flowchart(chain);

    // @ts-expect-error: "d" is not a node or group
    expect(() => chart.part("d")).toThrow(
      'flowchart() has no "d". Its parts are "a", "b", "c", "pair".',
    );
  });

  test("a lane's span covers what plays on it", () => {
    const run = lanes(
      {
        lanes: { a: "A", b: "B", c: "C" },
        spans: [{ lane: "a", at: 0.5, over: 2 }],
        events: [{ lane: "b", at: 3 }],
        links: [{ from: "a", to: "b", at: 1 }],
      },
      { scale: 50, play: { at: 1 } },
    );

    expect(window(run.part("a").span)).toEqual([1.5, 3.5]);
    expect(window(run.part("b").span)).toEqual([2, 4.3]);
    expect(window(run.part("c").span)).toEqual([1, 1]);
  });

  test("a state machine's states and a sequence's actors are there from the start", () => {
    const machine = stateMachine({
      states: { idle: "Idle", run: "Run" },
      initial: "idle",
      transitions: [["idle", "run"]],
    });

    const seq = sequence(
      { actors: { a: "A", b: "B" }, messages: [["a", "b", "x"]] },
      { play: { at: 1 } },
    );

    expect(window(machine.part("run").span)).toEqual([0, 0]);
    expect(window(machine.span)).toEqual([0, 0]);
    expect(window(seq.part("b").span)).toEqual([0, 0]);
  });
});
