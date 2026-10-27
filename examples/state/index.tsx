import { render } from "svjeez";
import { adaptive, state, tomorrow, tomorrowNight } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const M = 40;

export const agent = state(
  {
    states: {
      idle: "Idle",
      working: { label: "Working", states: { planning: "Planning", acting: "Calling tools" }, initial: "planning" },
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
  { theme, x: M, y: M, font: mono },
);

const walk = agent.walk(["idle", "working", "planning", "acting", "planning", "acting", "waiting", "working", "planning", "acting", "done"], { at: 0.6, dwell: 0.8, token: { style: "comet", arrive: true } });
const D = Math.ceil(walk.end + 1.5);

export default function build(): string {
  return render(
    {
      width: agent.bounds.w + 2 * M,
      height: agent.bounds.h + 2 * M,
      duration: D,
      title: "Agent lifecycle",
      desc: "A state machine for an agent run, walked once: idle, then working (planning and calling tools in turn), waiting on the user, working again, done.",
      reducedMotion: { at: walk.end - 0.3 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {agent.node}
      {walk.node}
    </>,
  );
}
