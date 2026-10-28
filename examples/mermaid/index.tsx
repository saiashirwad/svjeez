import { mermaid } from "@svjeez/mermaid";
import { render } from "svjeez";
import { flow } from "svjeez/extras";
import { css, mono, theme } from "../style";

const M = 40;

export const chart = mermaid(
  `flowchart TD
    %% A deploy pipeline, written the way it would sit in a README
    push([Push to main]) --> build[Build image]
    build --> test{Tests pass?}
    test -->|no| notify([Notify author])
    test -->|yes| scan[Scan image]
    registry[(Registry)] --> scan
    scan --> stage[Deploy to staging]

    subgraph release [Release]
      stage --> smoke{Smoke test?}
      smoke -->|yes| prod[Roll out to prod]
      smoke -->|no| rollback[[Roll back]]
    end

    prod --> done((Live))`,
  { theme, x: M, y: M, font: mono, play: { at: 0.4, step: 0.35 } },
);

if (chart.kind !== "flowchart") throw new Error("the pipeline is a flowchart");

const { under, over } = chart.layers;

const trip = flow(chart.route("push", "done"), {
  at: 5,
  speed: 170,
  style: "trace",
  color: theme.base09,
  arrive: true,
});

const D = 12;

export default function build(): string {
  return render(
    {
      width: chart.bounds.w + 2 * M,
      height: chart.bounds.h + 2 * M,
      duration: D,
      title: "Deploy pipeline from Mermaid",
      desc: "A deploy pipeline written as Mermaid text appears node by node as a svjeez flowchart, then a token runs from the push to the live release.",
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {under}
      {trip.node}
      {over}
    </>,
  );
}
