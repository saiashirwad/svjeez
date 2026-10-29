import { mermaid } from "@svjeez/mermaid";
import { enter, render } from "svjeez";
import { flow } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { mono, theme } from "../style";

// A Mermaid flowchart builds node by node, then a token traces the happy path.
const W = 504;
const H = 340;
const BAR = 40;
const D = 9;
const win = chrome(W, H, "deploy.mmd");

const SOURCE = `flowchart LR
  push([Push]) --> build[Build]
  build --> test{Pass?}
  test -->|yes| ship((Ship))
  test -->|no| build`;

const chart = mermaid(SOURCE, { theme, font: mono, fontSize: 13, play: { at: 0.4, step: 0.35 } });

/** Mermaid's left-to-right ranks are wider than the card, so the chart is drawn at its own size and scaled down to fit. */
const k = (W - 56) / chart.bounds.w;
const place = `translate(${(W - chart.bounds.w * k) / 2} ${BAR + (H - BAR - 40 - chart.bounds.h * k) / 2}) scale(${k})`;

if (chart.kind !== "flowchart") throw new Error("the deploy chart is a flowchart");

const { under, over } = chart.layers;

const trip = flow(chart.route("push", "ship"), {
  at: 3.6,
  speed: 170,
  style: "trace",
  color: theme.base09,
  arrive: true,
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Mermaid",
      desc: "A Mermaid flowchart with push, build, a pass decision that loops back to build, and ship appears node by node, then a token traces the path from push to ship.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g transform={place}>
          {under}
          {trip.node}
          {over}
        </g>
        <g animation={enter({ at: 2.4, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text
            x={W / 2}
            y={H - 26}
            fontFamily={mono}
            fontSize={11}
            textAnchor="middle"
            fill={theme.base03}
          >
            {"mermaid(`flowchart LR …`)"}
          </text>
        </g>
      </g>
    </>,
  );
}
