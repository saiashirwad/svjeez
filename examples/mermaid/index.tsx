import { mermaid } from "@svjeez/mermaid";
import { render, flow } from "svjeez";
import { defaults, text, type Values } from "svjeez/params";

import { css, mono, theme } from "../style";

export const params = {
  title: text("Deploy pipeline from Mermaid", { maxLength: 60 }),
  desc: text(
    "A deploy pipeline written as Mermaid text appears node by node as a svjeez flowchart, then a token runs from the push to the live release.",
    { maxLength: 300, label: "What the diagram shows, for screen readers" },
  ),
  source: text(
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
    {
      maxLength: 1500,
      label:
        "Mermaid source: a flowchart (TD or LR), a sequenceDiagram or a stateDiagram-v2. No classDef, style, click, notes beside actors, or loop, alt and opt blocks.",
    },
  ),
  from: text("push", {
    maxLength: 40,
    label:
      "In a flowchart, the node id a token starts from once the diagram is drawn. Empty, or an id the diagram does not have, for none.",
  }),
  to: text("done", { maxLength: 40, label: "The node id the token runs to." }),
};

const M = 40;
const HOLD = 1;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const chart = mermaid(p.source, { theme, x: M, y: M, font: mono, play: { at: 0.4, step: 0.35 } });

  const trip =
    chart.kind === "flowchart" &&
    [p.from, p.to].every((id) => chart.parts.some((part) => part.id === id))
      ? flow(chart.route(p.from, p.to), {
          at: Math.max(5, chart.span.end + 0.5),
          speed: 170,
          style: "trace",
          color: theme.base09,
          arrive: true,
        })
      : undefined;

  const D = Math.max(12, Math.ceil((trip ?? chart).span.end + HOLD));

  return render(
    {
      width: chart.bounds.w + 2 * M,
      height: chart.bounds.h + 2 * M,
      duration: D,
      title: p.title,
      desc: p.desc,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {chart.kind === "flowchart" ? (
        <>
          {chart.layers.under}
          {trip?.node}
          {chart.layers.over}
        </>
      ) : (
        chart
      )}
    </>,
  );
}
