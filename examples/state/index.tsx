import { render } from "svjeez";
import { stateMachine } from "@svjeez/diagrams";
import { HEIGHT, WIDTH, css, fit, mono, theme } from "../gallery-style";

export const agent = stateMachine(
  {
    states: {
      idle: "Idle",
      working: {
        label: "Working",
        states: { planning: "Planning", acting: "Calling tools" },
        initial: "planning",
      },
      waiting: "Waiting on user",
      done: { label: "Done", final: true },
      failed: { label: "Failed", final: true },
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
    ],
  },
  { theme, x: 0, y: 0, direction: "LR", font: mono },
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
        {agent.node}
        {walk.node}
      </g>
    </>,
  );
}
