import { stateMachine } from "@svjeez/diagrams";
import { Align, Group, Shape, canvas, exit, scene, span } from "svjeez";
import { mono, theme } from "../theme";

const agent = stateMachine(
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
    font: mono,
    size: 14,
    direction: "LR",
    colors: {
      background: theme.background,
      text: theme.text,
      line: theme.muted,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.orange,
      roles: { store: theme.magenta, input: theme.orange, output: theme.cyan, tool: theme.red },
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
  { at: span(0.4, 0.7) },
);

const LEAVE = walk.span.next(0.6, 0.8);

export default scene(
  {
    size: [960, 540],
    duration: Math.ceil(LEAVE.end + 0.2),
    title: "Agent lifecycle",
    desc: "A state machine for an agent run, walked once: idle, then working (planning and calling tools in turn), waiting on the user, working again, done.",
    theme,
    reducedMotion: walk.span.end - 0.3,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(LEAVE)}>
        <Group scale={900 / agent.size[0]}>{agent.with(walk.node)}</Group>
      </Align>
    </Group>
  ),
);
