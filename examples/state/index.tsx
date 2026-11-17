import { render } from "svjeez";
import { stateMachine, type StateSpec } from "@svjeez/diagrams";
import { choice, defaults, list, text, type Values } from "svjeez/params";
import { HEIGHT, WIDTH, css, fit, hue, mono, theme } from "../gallery-style";

export const params = {
  title: text("Agent lifecycle", { maxLength: 60 }),
  desc: text(
    "A state machine for an agent run, walked once: idle, then working (planning and calling tools in turn), waiting on the user, working again, done.",
    { maxLength: 300, label: "What the machine shows, for screen readers" },
  ),
  states: list(
    {
      id: text("", { maxLength: 24 }),
      label: text("", { maxLength: 20 }),
      role: choice("task", ["task", "store", "input", "output", "tool", "plain"]),
      final: choice("no", ["no", "yes"]),
      parent: text("", { maxLength: 24, label: "The id of the state it sits inside, or empty" }),
    },
    [
      { id: "idle", label: "Idle", role: "task", final: "no", parent: "" },
      { id: "working", label: "Working", role: "store", final: "no", parent: "" },
      { id: "planning", label: "Planning", role: "task", final: "no", parent: "working" },
      { id: "acting", label: "Calling tools", role: "input", final: "no", parent: "working" },
      { id: "waiting", label: "Waiting on user", role: "input", final: "no", parent: "" },
      { id: "done", label: "Done", role: "output", final: "yes", parent: "" },
      { id: "failed", label: "Failed", role: "tool", final: "yes", parent: "" },
      { id: "cancelled", label: "Cancelled", role: "plain", final: "yes", parent: "" },
    ],
    { min: 2, max: 12, label: "The first state of each level is where it starts." },
  ),
  transitions: list(
    {
      from: text("", { maxLength: 24 }),
      to: text("", { maxLength: 24 }),
      label: text("", { maxLength: 16 }),
    },
    [
      { from: "idle", to: "working", label: "task" },
      { from: "planning", to: "acting", label: "plan" },
      { from: "acting", to: "planning", label: "result" },
      { from: "working", to: "waiting", label: "ask" },
      { from: "waiting", to: "working", label: "reply" },
      { from: "working", to: "done", label: "finish" },
      { from: "working", to: "failed", label: "error" },
      { from: "working", to: "cancelled", label: "cancel" },
    ],
    { min: 1, max: 16 },
  ),
  walk: list(
    text("", { maxLength: 24 }),
    [
      "idle",
      "working",
      "planning",
      "acting",
      "planning",
      "acting",
      "waiting",
      "working",
      "planning",
      "acting",
      "done",
    ],
    {
      min: 1,
      max: 16,
      label: "The states a token visits in turn, each one a transition from the last.",
    },
  ),
};

type State = Values<typeof params>["states"][number];

const scope = (states: readonly State[], parent: string): Record<string, StateSpec> =>
  Object.fromEntries(
    states.flatMap(({ id, label, role, final, parent: owner }) => {
      if (owner !== parent) return [];

      const inner = scope(states, id);
      const first = Object.keys(inner)[0];

      return [
        [
          id,
          {
            label,
            ...(role !== "plain" && { role }),
            ...(final === "yes" && { final: true }),
            ...(first !== undefined && { states: inner, initial: first }),
          },
        ] as const,
      ];
    }),
  );

/** The state machine for `p`, laid out but not yet placed on the canvas. */
export const layout = (p: Values<typeof params>) => {
  const states = scope(p.states, "");

  return stateMachine(
    {
      states,
      initial: Object.keys(states)[0] ?? "",
      transitions: p.transitions.map(({ from, to, label }) => [from, to, label]),
    },
    {
      theme,
      x: 0,
      y: 0,
      direction: "LR",
      font: mono,
      fontSize: 16,
      tints: {
        task: hue.blue,
        store: hue.purple,
        input: hue.orange,
        output: hue.cyan,
        tool: hue.red,
      },
    },
  );
};

export const agent = layout(defaults(params));

export default function build(p: Values<typeof params> = defaults(params)): string {
  const machine = layout(p);

  const walk = machine.walk(p.walk, {
    at: 0.2,
    dwell: 0.7,
    token: { style: "comet", arrive: true },
  });

  const D = Math.ceil(walk.span.end + 1.5);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: p.desc,
      reducedMotion: { at: walk.span.end - 0.3 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(machine.bounds.w, machine.bounds.h)}>
        {machine}
        {walk}
      </g>
    </>,
  );
}
