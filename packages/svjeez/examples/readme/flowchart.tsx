import { render } from "svjeez";
import { flow, flowchart } from "svjeez/extras";
import { css, mono, theme } from "../style";

const M = 24;

const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      lint: { label: "Run linters", role: "tool" },
      ok: { label: "Clean?", role: "decision" },
      post: "Post review",
    },
    groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
    edges: [
      ["pr", "lint"],
      ["lint", "ok"],
      ["ok", "post", { label: "yes" }],
      ["ok", "lint", { label: "no" }],
    ],
  },
  { theme, x: M, y: M, font: mono, fontSize: 13, play: { at: 0.5 } },
);

const trip = flow(chart.route("pr", "post"), {
  at: 4,
  style: "trace",
  arrive: true,
  color: theme.base09,
});

export default function build(): string {
  return render(
    {
      width: chart.bounds.w + 2 * M,
      height: chart.bounds.h + 2 * M,
      duration: Math.ceil(trip.end) + 2,
      title: "Flowchart",
      desc: "A review flowchart revealed rank by rank, then a trace runs from the opened PR to the posted review.",
      css,
      reducedMotion: { at: 3.5 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {chart.layers.under}
      {trip.node}
      {chart.layers.over}
    </>,
  );
}
