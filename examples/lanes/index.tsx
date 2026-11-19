import { lanes } from "@svjeez/diagrams";
import { Align, Group, Shape, exit, scene, span } from "svjeez";
import { mono, theme } from "../theme";

const run = lanes(
  {
    lanes: {
      lead: { label: "TH-01 lead", role: "input" },
      search: { label: "TH-02 search", role: "task" },
      build: { label: "TH-03 build", role: "tool" },
      test: { label: "TH-04 test", role: "output" },
      docs: { label: "TH-05 docs", role: "store" },
    },
    spans: [
      { lane: "lead", at: 0, over: 2.6, label: "planning" },
      { lane: "lead", at: 4.6, over: 1, label: "review" },
      { lane: "lead", at: 7.2, over: 1.3, label: "merge" },
      { lane: "search", at: 1, over: 3.6, label: "researching" },
      { lane: "build", at: 2.6, over: 4.6, label: "editing" },
      { lane: "test", at: 4.6, over: 2.6, label: "verifying" },
      { lane: "docs", at: 5.6, over: 2.4, label: "writing" },
    ],
    events: [
      { lane: "search", at: 1.8, label: "Read", role: "task" },
      { lane: "search", at: 3.4, label: "Web", role: "output" },
      { lane: "build", at: 3.6, label: "Edit", role: "store" },
      { lane: "build", at: 5.2, label: "Test", role: "decision" },
      { lane: "build", at: 6.6, label: "Edit", role: "store" },
      { lane: "test", at: 5.8, label: "Run", role: "task" },
      { lane: "docs", at: 6.8, label: "Edit", role: "store" },
    ],
    links: [
      { from: "lead", to: "search", at: 1 },
      { from: "lead", to: "build", at: 2.6 },
      { from: "search", to: "lead", at: 4.6 },
      { from: "build", to: "lead", at: 7.2 },
    ],
  },
  {
    font: mono,
    textSize: 14,
    scale: 84,
    reveal: span(0.2),
    colors: {
      background: theme.background,
      text: theme.text,
      line: theme.border,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.orange,
      roles: {
        input: theme.blue,
        task: theme.magenta,
        tool: theme.cyan,
        output: theme.blue,
        store: theme.magenta,
        decision: theme.orange,
      },
    },
  },
);

const LEAVE = run.span!.next(0.6, 1.2);

export default scene(
  {
    size: [960, 540],
    duration: 11,
    title: "Agent threads on a timeline",
    desc: "Five agent threads over time: the lead plans and delegates, search reads and browses, build edits and tests, and each reports back to the lead.",
    theme,
    still: 9,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(LEAVE)}>{run.node}</Align>
    </Group>
  ),
);
