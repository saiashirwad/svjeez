import { describe, expect, test } from "bun:test";
import { el, render, type Rect, type SvgNode } from "svjeez";
import { flowchart, lanes, sequence, stateMachine, tree } from "svjeez/extras";

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
        ["check", "work", { label: "yes" }],
        ["work", "check"],
        ["check", "db", { label: "no" }],
        ["db", "end"],
      ],
    },
    { x: 100, y: 50, play: { at: 1 } },
  );

  test("bounds start at x, y and hold every node and group", () => {
    expect([chart.bounds.x, chart.bounds.y]).toEqual([100, 50]);

    for (const id of ["start", "check", "work", "db", "end", "core"] as const)
      expect(inside(chart.bounds, chart.get(id))).toBe(true);
    expect(inside(chart.get("core"), chart.get("work"))).toBe(true);
  });

  test("route runs edge to edge from the first node to the last, and throws with no path", () => {
    const trip = chart.route("start", "end");
    expect(touches(trip[0]!, chart.get("start"))).toBe(true);
    expect(touches(trip.at(-1)!, chart.get("end"))).toBe(true);
    expect(chart.route("work", "end").slice(0, chart.edge("work", "check").length)).toEqual(
      chart.edge("work", "check"),
    );
    expect(() => chart.route("end", "start")).toThrow();
    expect(() => chart.edge("start", "end")).toThrow();
  });

  test("a decision's edges end on the diamond, not its bounding box", () => {
    const into = chart.edge("start", "check").at(-1)!;
    const b = chart.get("check");
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
    expect(points.map((p) => p.x)).toEqual([seq.get("api").center.x, seq.get("db").center.x]);
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
    expect(walk.end).toBeCloseTo(1 + 5 + 4 * 0.35, 9);
    expect(() => valid(el.g({}, [machine.node, walk.node]))).not.toThrow();
  });

  test("with one time per state, each lights then, the token arriving as it does", () => {
    const walk = machine.walk(["idle", "run", "done"], { at: [1, 5, 6], dwell: 2, speed: 1e9 });
    expect([walk.spans.idle[0]!.at, walk.spans.run[0]!.at, walk.spans.done[0]!.at]).toEqual([
      1, 5, 6,
    ]);
    expect(walk.spans.idle[0]!.over).toBeCloseTo(4 - 0.35, 9);
    expect(walk.spans.run[0]!.over).toBeCloseTo(1 - 0.35, 9);
    expect(walk.end).toBe(8);
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
    expect(machine.get("idle").y).toBeGreaterThan(machine.bounds.y + 14);
    expect(machine.bounds.y + machine.bounds.h).toBeGreaterThan(
      machine.get("done").y + machine.get("done").h + 18,
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
        expect(inside(review.get("review"), review.get(id))).toBe(true);
        expect(review.get(id).y).toBeGreaterThan(review.get("review").y + 30);
      }
    });

    test("a transition to the composite ends on its border; one from an inner state leaves the container", () => {
      const into = review.edge("draft", "review").at(-1)!;
      expect(into.y).toBeCloseTo(review.get("review").y, 6);
      const out = review.edge("decision", "published");
      expect(touches(out[0]!, review.get("review"))).toBe(true);
      expect(inside(review.get("review"), review.get("published"))).toBe(false);
    });

    test("a walk enters a composite through its initial state and leaves through its transitions", () => {
      const walk = review.walk(["draft", "review", "screening", "decision", "published"], {
        at: 0,
      });

      expect(walk.spans.screening).toHaveLength(1);
      expect(() => review.walk(["draft", "decision"], { at: 0 })).toThrow();
      expect(() => valid(el.g({}, [review.node, walk.node]))).not.toThrow();
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
    expect(down.get("c").y).toBeGreaterThan(down.get("a").y);
    expect(across.get("c").x).toBeGreaterThan(across.get("a").x);
    expect(across.get("c").y).toBeCloseTo(across.get("a").y, 6);
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
    expect(touches(trip[0]!, team.get("a1"))).toBe(true);
    expect(touches(trip.at(-1)!, team.get("b"))).toBe(true);
    expect(Math.min(...trip.map((p) => p.y))).toBeCloseTo(
      team.get("root").y + team.get("root").h,
      6,
    );
  });

  test("a parent sits centered over its children", () => {
    expect(team.get("root").center.x).toBeCloseTo(
      (team.get("a").center.x + team.get("b").center.x) / 2,
      6,
    );
    expect(() => valid(team.node)).not.toThrow();
  });
});

describe("lanes", () => {
  const run = lanes(
    {
      lanes: { a: "A", b: { label: "B", role: "tool" } },
      spans: [{ lane: "a", from: 0, to: 2, label: "busy" }],
      events: [{ lane: "b", at: 1, label: "READ" }],
      links: [{ from: "a", to: "b", at: 1.5 }],
    },
    { scale: 50, x: 10, y: 20, play: { at: 0 } },
  );

  test("x maps seconds onto the lane axis at the given scale", () => {
    expect(run.x(2) - run.x(1)).toBe(50);
    expect(run.x(0)).toBeGreaterThan(run.get("a").x);
    expect(run.get("b").y).toBe(run.get("a").y + run.get("a").h);
    expect(() => valid(run.node)).not.toThrow();
  });
});
