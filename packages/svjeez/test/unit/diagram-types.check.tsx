import { flowchart, lanes, sequence, stateMachine, tree } from "svjeez/extras";

const machine = stateMachine({
  states: { idle: "Idle", busy: { label: "Busy", states: { plan: "Plan", act: "Act" }, initial: "plan" } },
  initial: "idle",
  transitions: [["idle", "busy"], ["plan", "act"]],
});

const chart = flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "b"]] });

export const diagrams = [
  machine.walk(["idle", "busy", "plan", "act"], { at: 0 }),
  chart.route("a", "b"),
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "root" } } }),
  lanes({ lanes: { a: "A" }, spans: [{ lane: "a", from: 0, to: 1 }] }, { scale: 10 }),
];

export const badDiagrams = [
  // @ts-expect-error an edge to a node that does not exist
  flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "c"]] }),
  // @ts-expect-error a group member that does not exist
  flowchart({ nodes: { a: "A" }, groups: { g: { label: "G", nodes: ["b"] } }, edges: [] }),
  // @ts-expect-error a misspelled id, through route
  chart.route("a", "c"),
  // @ts-expect-error a message from an actor that does not exist
  sequence({ actors: { user: "User", api: "API" }, messages: [["usr", "api", "hi"]] }),
  // @ts-expect-error a note on an actor that does not exist
  sequence({ actors: { user: "User" }, messages: [{ note: "db", text: "hi" }] }),
  // @ts-expect-error a transition to a state that does not exist
  stateMachine({ states: { a: "A", b: "B" }, initial: "a", transitions: [["a", "c"]] }),
  // @ts-expect-error an initial state that does not exist
  stateMachine({ states: { a: "A" }, initial: "b", transitions: [] }),
  // @ts-expect-error a composite whose initial is not one of its own states
  stateMachine({ states: { a: { label: "A", states: { x: "X" }, initial: "y" } }, initial: "a", transitions: [] }),
  // @ts-expect-error a walk through a state that does not exist
  machine.walk(["idle", "bsy"], { at: 0 }),
  // @ts-expect-error a parent that does not exist
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "rot" } } }),
  // @ts-expect-error a span on a lane that does not exist
  lanes({ lanes: { a: "A" }, spans: [{ lane: "b", from: 0, to: 1 }] }, { scale: 10 }),
  // @ts-expect-error a link to a lane that does not exist
  lanes({ lanes: { a: "A" }, links: [{ from: "a", to: "b", at: 1 }] }, { scale: 10 }),
];
