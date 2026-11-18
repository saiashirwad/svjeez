import { font, span } from "svjeez";
import { flowchart, lanes, sequence, stateMachine, tree } from "../src/index.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const o = { font: mono };

const machine = stateMachine(
  {
    states: {
      idle: "Idle",
      busy: { label: "Busy", states: { plan: "Plan", act: "Act" }, initial: "plan" },
    },
    initial: "idle",
    transitions: [
      ["idle", "busy"],
      ["plan", "act"],
    ],
  },
  o,
);

const chart = flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "b"]] }, o);

export const diagrams = [
  machine.walk(["idle", "busy", "plan", "act"], { at: span(0, 1) }),
  chart.route("a", "b"),
  chart.part("a->b"),
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "root" } } }, o).part("root->kid"),
  lanes({ lanes: { a: "A" }, spans: [{ lane: "a", at: 0, over: 1 }] }, { ...o, scale: 10 }),
];

export const badDiagrams = [
  // @ts-expect-error an edge to a node that does not exist
  flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "c"]] }, o),
  // @ts-expect-error a group member that does not exist
  flowchart({ nodes: { a: "A" }, groups: { g: { label: "G", nodes: ["b"] } }, edges: [] }, o),
  // @ts-expect-error a misspelled id, through route
  chart.route("a", "c"),
  // @ts-expect-error a part the chart does not have
  chart.part("b->a"),
  // @ts-expect-error a reveal for a node that does not exist
  flowchart({ nodes: { a: "A" }, edges: [] }, { ...o, reveal: { b: span(0, 1) } }),
  // @ts-expect-error a diagram needs a font
  flowchart({ nodes: { a: "A" }, edges: [] }, {}),
  // @ts-expect-error a message from an actor that does not exist
  sequence({ actors: { user: "User", api: "API" }, messages: [["usr", "api", "hi"]] }, o),
  // @ts-expect-error a note on an actor that does not exist
  sequence({ actors: { user: "User" }, messages: [{ note: "db", text: "hi" }] }, o),
  // @ts-expect-error a transition to a state that does not exist
  stateMachine({ states: { a: "A", b: "B" }, initial: "a", transitions: [["a", "c"]] }, o),
  // @ts-expect-error an initial state that does not exist
  stateMachine({ states: { a: "A" }, initial: "b", transitions: [] }, o),
  stateMachine(
    {
      // @ts-expect-error a composite whose initial is not one of its own states
      states: { a: { label: "A", states: { x: "X" }, initial: "y" } },
      initial: "a",
      transitions: [],
    },
    o,
  ),
  // @ts-expect-error a walk through a state that does not exist
  machine.walk(["idle", "bsy"], { at: span(0, 1) }),
  // @ts-expect-error a parent that does not exist
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "rot" } } }, o),
  // @ts-expect-error a span on a lane that does not exist
  lanes({ lanes: { a: "A" }, spans: [{ lane: "b", at: 0, over: 1 }] }, { ...o, scale: 10 }),
  // @ts-expect-error a link to a lane that does not exist
  lanes({ lanes: { a: "A" }, links: [{ from: "a", to: "b", at: 1 }] }, { ...o, scale: 10 }),
];
