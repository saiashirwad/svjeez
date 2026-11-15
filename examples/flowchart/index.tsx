import { render, flow } from "svjeez";
import { flowchart } from "@svjeez/diagrams";
import { HEIGHT, WIDTH, css, fit, mono, theme } from "../gallery-style";

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
  { theme, x: 0, y: 0, direction: "LR", font: mono, play: { at: 0.2, step: 0.3 } },
);

const trip = flow(chart.route("pr", "post"), {
  at: 3.5,
  speed: 240,
  style: "trace",
  color: theme.base09,
  arrive: true,
});

const D = 10;

export default function build(): string {
  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: "Review pipeline",
      desc: "A flowchart of an agent review pipeline appears node by node, then a token runs from the opened PR to the posted review.",
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(chart.bounds.w, chart.bounds.h)}>
        {chart.layers.under}
        {trip.node}
        {chart.layers.over}
      </g>
    </>,
  );
}
