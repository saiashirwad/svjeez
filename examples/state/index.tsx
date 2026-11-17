import { render } from "svjeez";
import { stateMachine } from "@svjeez/diagrams";
import { HEIGHT, WIDTH, css, fit, hue, mono, theme } from "../gallery-style";

export const agent = stateMachine(
  {
    states: {
      idle: { label: "Idle", role: "task" },
      working: {
        label: "Working",
        role: "store",
        states: {
          planning: { label: "Planning", role: "task" },
          acting: { label: "Calling tools", role: "input" },
        },
        initial: "planning",
      },
      waiting: { label: "Waiting on user", role: "input" },
      done: { label: "Done", final: true, role: "output" },
      failed: { label: "Failed", final: true, role: "tool" },
      cancelled: { label: "Cancelled", final: true },
    },
    initial: "idle",
    transitions: [
      ["idle", "working", "task"],
      ["planning", "acting", "plan"],
      ["acting", "planning", "result"],
      ["working", "waiting", "ask"],
      ["waiting", "working", "reply"],
      ["working", "done", "finish"],
      ["working", "failed", "error"],
      ["working", "cancelled", "cancel"],
    ],
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

const walk = agent.walk(
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
  { at: 0.2, dwell: 0.7, token: { style: "comet", arrive: true } },
);

const D = Math.ceil(walk.span.end + 1.5);

export default function build(): string {
  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: "Agent lifecycle",
      desc: "A state machine for an agent run, walked once: idle, then working (planning and calling tools in turn), waiting on the user, working again, done.",
      reducedMotion: { at: walk.span.end - 0.3 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(agent.bounds.w, agent.bounds.h)}>
        {agent}
        {walk}
      </g>
    </>,
  );
}
