import { describe, expect, test } from "bun:test";
import { Align, Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, inspect, isLane, svg, type Child, type Model } from "svjeez/tools";
import {
  flowchart,
  lanes,
  sequence,
  stateMachine,
  tree,
  type DiagramColors,
} from "../src/index.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#1D1D1F",
  line: "#6E6E73",
  accent: "#0A6CFF",
};

const options = { font: mono, colors };

const draw = (child: Child, duration = 6) =>
  scene({ size: [1200, 800], duration, title: "Diagram", loop: false }, () => (
    <Group>
      <Shape geometry={circle(1)} at={[0, 0]} fill="#FFFFFF" />
      <Group offset={[20, 20]}>{child}</Group>
    </Group>
  ));

const errorsOf = (child: Child) =>
  inspect(draw(child))
    .filter((f) => f.severity === "error")
    .map((f) => f.message);

const thrown = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("it did not throw");
};

const review = () =>
  flowchart(
    {
      nodes: {
        pr: { label: "PR opened", role: "input" },
        lint: { label: "Run linters", role: "tool" },
        ok: { label: "Clean?", role: "decision" },
        post: { label: "Post review", role: "output" },
      },
      groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
      edges: [
        ["pr", "lint"],
        ["lint", "ok"],
        ["ok", "post", "yes"],
        ["ok", "lint", "no"],
      ],
    },
    { ...options, reveal: span(0.5, 0.4) },
  );

describe("flowchart", () => {
  test("draws, compiles and checks with no errors", () => {
    const chart = review();

    expect(svg.emit(draw(chart.node))).toContain("<svg");
    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("nodes enter one beat each in rank order, and edges draw on as their later end enters", () => {
    const chart = review();

    expect((["pr", "lint", "ok", "post"] as const).map((id) => chart.when(id)?.start)).toEqual([
      0.5, 0.9, 1.3, 1.7,
    ]);
    expect(chart.when("pr->lint")).toMatchObject({ start: 0.5, over: 0.4 });
    expect(chart.when("agent")?.start).toBe(0.9);
    expect(chart.span).toMatchObject({ start: 0.5 });
  });

  test("a reveal record times the nodes it names and leaves the rest there from the start", () => {
    const chart = flowchart(
      { nodes: { a: "A", b: "B" }, edges: [["a", "b"]] },
      { ...options, reveal: { b: span(2, 0.3) } },
    );

    expect(chart.when("a")).toBeUndefined();
    expect(chart.when("b")).toMatchObject({ start: 2, over: 0.3 });
    expect(chart.when("a->b")).toMatchObject({ start: 1.7, over: 0.3 });
  });

  test("size holds every node, and parts are refs a scene can place against", () => {
    const chart = review();
    const [w, h] = chart.size;

    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(100);

    const placed = draw(
      <Group>
        {chart.node}
        <Align to={chart.part("lint")} place="top">
          <Shape geometry={circle(3)} fill="#FF0000" />
        </Align>
      </Group>,
    );

    expect(svg.emit(placed)).toContain("<svg");
  });

  test("a verb on an edge draws its line, without naming the line", () => {
    const model = scene({ size: [1200, 800], duration: 4, title: "Diagram" }, () => {
      const chart = review();
      const edge = chart.part("pr->lint");

      edge.set({ trim: [0, 0] }, span(0));
      edge.to({ trim: [0, 1] }, span(1, 1));

      return chart.node;
    });

    const lines: Model.SceneNode[] = [];

    const visit = (node: Model.SceneNode): void => {
      if (node.key.endsWith("pr->lint/line")) lines.push(node);

      if (node.kind === "group") node.children.forEach(visit);
    };

    visit(model.root);
    expect(lines.length).toBe(1);
    expect(lines[0]!.kind === "shape" && isLane(lines[0]!.trim!)).toBe(true);
  });

  test("route runs edge to edge, and says so when no edges join the two", () => {
    const chart = review();
    const route = chart.route("pr", "post");

    expect(route.points.length).toBeGreaterThan(4);
    expect(route.length).toBeGreaterThan(0);
    expect(route.at(0)).toEqual(route.points[0]!);
    expect(route.at(1)).toEqual(route.points.at(-1)!);
    expect(thrown(() => chart.route("post", "pr")).message).toBe(
      'flowchart() has no way from "post" to "pr" along its edges. Route between nodes an edge path joins.',
    );
  });

  test("a decision's edges end on the diamond, not its box", () => {
    const chart = flowchart(
      {
        nodes: { q: { label: "Ok?", role: "decision" }, a: "A", b: "B" },
        edges: [
          ["q", "a"],
          ["q", "b"],
        ],
      },
      options,
    );

    const [start] = chart.edge("q", "a").points;
    const [w] = chart.size;

    expect(start![1]).toBeGreaterThan(0);
    expect(start![0]).toBeLessThan(w);
  });

  test("misuse is a SceneError that names the diagram and what to fix", () => {
    const nodes = { a: "A", b: "B" };

    // SAFETY: an edge to an unknown node on purpose, which the types forbid, to read the runtime error
    expect(thrown(() => flowchart({ nodes, edges: [["a", "c" as "b"]] }, options)).message).toBe(
      'flowchart() edge 1 names "c", which is not one of its nodes. Its nodes are "a", "b".',
    );
    expect(thrown(() => flowchart({ nodes: {}, edges: [] }, options)).message).toBe(
      "flowchart() needs at least one node, got none.",
    );
    // SAFETY: no font on purpose, which the types forbid, to read the runtime error
    expect(
      thrown(() => flowchart({ nodes, edges: [] }, { font: undefined as never })).message,
    ).toBe(
      "flowchart() needs a font to measure its labels with. Pass one in its options, as in flowchart(spec, { font: sans }).",
    );
    expect(thrown(() => flowchart({ nodes: { "a/b": "A" }, edges: [] }, options)).problem).toBe(
      'flowchart() has a node named "a/b".',
    );
    expect(
      thrown(() =>
        flowchart(
          {
            nodes,
            groups: { x: { label: "X", nodes: ["a"] }, y: { label: "Y", nodes: ["a"] } },
            edges: [],
          },
          options,
        ),
      ).problem,
    ).toBe('flowchart() puts node "a" in two groups, "x" and "y".');
    // SAFETY: an unknown part on purpose, which the types forbid, to read the runtime error
    expect(thrown(() => review().part("nope" as "pr")).message).toStartWith(
      'flowchart() has no part "nope". Its parts are "pr", "lint", "ok", "post", "agent", "pr->lint"',
    );
    expect(
      thrown(() => flowchart({ nodes, edges: [] }, { ...options, reveal: span(0, 0) })).problem,
    ).toBe(
      "flowchart() reveal needs a span that starts at 0 or later and lasts longer than 0, got span(0, 0).",
    );
  });

  test("with() draws a child over the edges and under the nodes", () => {
    const chart = review();
    const route = chart.route("pr", "post");

    expect(
      errorsOf(
        chart.with(<Shape geometry={route.geometry} stroke={{ color: "#FF8800", width: 2 }} />),
      ),
    ).toEqual([]);
  });
});

describe("tree", () => {
  const team = () =>
    tree(
      {
        nodes: {
          lead: "Lead",
          a: { label: "Search", parent: "lead" },
          b: { label: "Build", parent: "lead" },
        },
      },
      { ...options, reveal: span(0.5, 0.3) },
    );

  test("nodes enter breadth first and edges draw on with their child", () => {
    const t = team();

    expect(t.when("lead")).toMatchObject({ start: 0.5 });
    expect(t.when("a")?.start).toBeCloseTo(0.8);
    expect(t.when("lead->b")?.start).toBeCloseTo(0.8);
    expect(errorsOf(t.node)).toEqual([]);
  });

  test("route goes up to the common ancestor and down again", () => {
    const route = team().route("a", "b");
    const ys = route.points.map(([, y]) => y);

    expect(Math.min(...ys)).toBeLessThan(route.points[0]![1]);
    expect(route.points.at(-1)![1]).toBeCloseTo(route.points[0]![1], 5);
  });

  test("a tree needs one root", () => {
    expect(thrown(() => tree({ nodes: { a: "A", b: "B" } }, options)).message).toBe(
      'tree() needs exactly one node with no parent, got "a", "b". Give every other node a parent.',
    );
  });
});

describe("sequence", () => {
  const login = (reveal = span(0.2, 0.8)) =>
    sequence(
      {
        actors: { user: "Browser", api: "API" },
        messages: [
          ["user", "api", "POST /login"],
          { note: "api", text: "checks" },
          ["api", "user", "200", { reply: true }],
        ],
      },
      { ...options, reveal },
    );

  test("each message has a beat and a route between the lifelines", () => {
    const s = login();
    const reply = s.message(2);

    expect(reply.span).toMatchObject({ start: 1.8, over: 0.8 });
    expect(reply.route.points[0]![0]).toBeGreaterThan(reply.route.points.at(-1)![0]);
    expect(errorsOf(s.node)).toEqual([]);
  });

  test("one span per message, or a clear error", () => {
    expect(
      thrown(() =>
        sequence(
          { actors: { a: "A" }, messages: [["a", "a", "self"]] },
          { ...options, reveal: [span(0, 1), span(1, 1)] },
        ),
      ).problem,
    ).toBe("sequence() reveal has 2 spans for 1 messages and notes.");
    expect(thrown(() => login().message(7)).message).toBe(
      "sequence() has no message 7. Count from 0: it has 3.",
    );
  });
});

describe("state machine", () => {
  const machine = () =>
    stateMachine(
      {
        states: {
          idle: "Idle",
          busy: { label: "Busy", states: { plan: "Plan", act: "Act" }, initial: "plan" },
          done: { label: "Done", final: true },
        },
        initial: "idle",
        transitions: [
          ["idle", "busy", "go"],
          ["plan", "act"],
          ["act", "plan"],
          ["busy", "done"],
        ],
      },
      options,
    );

  test("draws composites with their inner states and checks clean", () => {
    expect(errorsOf(machine().node)).toEqual([]);
  });

  test("a walk lights each state for its span, the token travelling between", () => {
    const walk = machine().walk(["idle", "busy", "plan", "act", "done"], { at: span(0.5, 0.6) });

    expect(walk.spans.idle).toEqual([expect.objectContaining({ start: 0.5, over: 0.6 })]);
    expect(walk.spans.busy[0]!.start).toBeGreaterThan(1.1);
    expect(walk.spans.done).toHaveLength(1);
    expect(walk.span.start).toBe(0.5);
    expect(errorsOf(machine().with(walk.node))).toEqual([]);
  });

  test("a walk with one span per state lights each then", () => {
    const at = [span(0, 1), span(2, 1), span(4, 1)];
    const walk = machine().walk(["idle", "busy", "plan"], { at });

    expect(walk.spans.busy[0]).toMatchObject({ start: 2 });
    expect(walk.spans.plan[0]).toMatchObject({ start: 4 });
  });

  test("a walk needs transitions between its states", () => {
    expect(thrown(() => machine().walk(["idle", "done"], { at: span(0, 1) })).problem).toBe(
      'walk() has no way from "idle" to "done".',
    );
  });

  test("a transition between a composite and its inner state is refused", () => {
    expect(
      thrown(() =>
        stateMachine(
          {
            states: { busy: { label: "Busy", states: { plan: "Plan" }, initial: "plan" } },
            initial: "busy",
            transitions: [["busy", "plan"]],
          },
          options,
        ),
      ).problem,
    ).toBe(
      'stateMachine() can\'t draw a transition between "busy" and "plan", because one holds the other.',
    );
  });
});

describe("lanes", () => {
  const run = (reveal?: { readonly start: number; readonly over?: number }) =>
    lanes(
      {
        lanes: { lead: "Lead", build: "Build" },
        spans: [{ lane: "lead", at: 0, over: 2, label: "plan" }],
        events: [{ lane: "build", at: 1, label: "edit" }],
        links: [{ from: "lead", to: "build", at: 1.5 }],
      },
      { ...options, scale: 50, ...(reveal && { reveal }) },
    );

  test("x maps lane seconds onto the axis at the scale", () => {
    const r = run();

    expect(r.x(2) - r.x(0)).toBeCloseTo(100);
    expect(r.span).toBeUndefined();
  });

  test("a reveal plays lane time from its start, stretched to its length", () => {
    expect(run({ start: 1 }).span).toMatchObject({ start: 1, over: 2 });
    expect(run({ start: 1, over: 4 }).when("build")).toMatchObject({ start: 3 });
    expect(errorsOf(run({ start: 0.5 }).node)).toEqual([]);
  });

  test("a link joins two lanes", () => {
    expect(
      thrown(() =>
        lanes(
          { lanes: { a: "A" }, links: [{ from: "a", to: "a", at: 0 }] },
          { ...options, scale: 10 },
        ),
      ).message,
    ).toBe('lanes() link 1 runs from "a" to itself. Link two different lanes.');
  });
});
