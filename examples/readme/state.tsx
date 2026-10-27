import { render } from "svg-motion";
import { state } from "svjeez/extras";
import { CSS, theme } from "./kit";

const M = 24;
const agent = state(
  {
    states: { idle: "Idle", working: { label: "Working", states: { plan: "Plan", act: "Act" }, initial: "plan" }, done: { label: "Done", final: true } },
    initial: "idle",
    transitions: [["idle", "working", "task"], ["plan", "act"], ["act", "plan"], ["working", "done", "finish"]],
  },
  { theme, x: M, y: M, class: "mono", fontSize: 13 },
);
const walk = agent.walk(["idle", "working", "plan", "act", "done"], { at: 1 });

export default function build(): string {
  return render(
    { width: agent.bounds.w + 2 * M, height: agent.bounds.h + 2 * M, duration: Math.ceil(walk.end) + 2, title: "State machine", desc: "An agent's states light up in turn as a token runs from idle through plan and act to done.", css: CSS, reducedMotion: { at: 1 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {agent.node}
      {walk.node}
    </>,
  );
}
