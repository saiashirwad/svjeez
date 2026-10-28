import { render } from "svjeez";
import { adaptive, flow, flowchart, systemLight, systemDark } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ light: systemLight, dark: systemDark });
const M = 40;

export const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      gather: { label: "Gather diff", role: "tool" },
      memory: { label: "Review memory", role: "store" },
      analyze: "Analyze changes",
      lint: { label: "Run linters", role: "tool" },
      issues: { label: "Issues?", role: "decision" },
      fix: "Draft fixes",
      post: { label: "Post review", role: "output" },
    },
    groups: {
      agent: { label: "Review agent", nodes: ["gather", "analyze", "lint", "issues", "fix"] },
    },
    edges: [
      ["pr", "gather"],
      ["gather", "analyze"],
      ["memory", "analyze"],
      ["analyze", "lint"],
      ["lint", "issues"],
      ["issues", "fix", { label: "yes" }],
      ["fix", "lint", { label: "re-run" }],
      ["issues", "post", { label: "no" }],
    ],
  },
  { theme, x: M, y: M, font: mono, play: { at: 0.4, step: 0.35 } },
);

const trip = flow(chart.route("pr", "post"), { at: 4, speed: 160, style: "trace", color: theme.base09, arrive: true });
const D = 10;

export default function build(): string {
  return render(
    {
      width: chart.bounds.w + 2 * M,
      height: chart.bounds.h + 2 * M,
      duration: D,
      title: "Review pipeline",
      desc: "A flowchart of an agent review pipeline appears node by node, then a token runs from the opened PR to the posted review.",
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {chart.layers.under}
      {trip.node}
      {chart.layers.over}
    </>,
  );
}
