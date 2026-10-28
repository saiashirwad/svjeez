import { render } from "svjeez";
import { flow, flowchart } from "svjeez/extras";
import { CSS, chrome, outro, theme } from "./kit";

const W = 1032;
const H = 300;
const BAR = 40;
const win = chrome(W, H, "pipeline.tsx");

const chart = flowchart(
  {
    nodes: {
      prompt: { label: "Prompt", role: "input" },
      agent: { label: "Write scene", role: "task" },
      frames: { label: "Render frames", role: "tool" },
      ok: { label: "Frames ok?", role: "decision" },
      ship: { label: "One SVG", role: "output" },
    },
    edges: [["prompt", "agent"], ["agent", "frames"], ["frames", "ok"], ["ok", "ship", { label: "yes" }], ["ok", "agent", { label: "no" }]],
  },
  { theme, x: W / 2, y: BAR + (H - BAR) / 2, anchor: "center", direction: "LR", fontSize: 13, class: "sans", play: { at: 0.5, step: 0.45 } },
);
const trip = flow(chart.route("prompt", "ship"), { theme, at: 4, style: "comet", arrive: true, color: theme.base0D });
const D = Math.ceil(trip.end) + 3;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A diagram that builds itself",
      desc: "A flowchart from prompt to finished SVG appears node by node, then a comet runs the route from the prompt to the result.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {chart.layers.under}
        {trip.node}
        {chart.layers.over}
      </g>
    </>,
  );
}
