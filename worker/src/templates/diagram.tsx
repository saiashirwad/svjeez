import { mermaid } from "@svjeez/mermaid";
import { render } from "svjeez";
import { defaults, text, type Values } from "svjeez/params";

import { css, leave, mono, rise, theme } from "../../../examples/gallery-style";

export const params = {
  source: text(
    `flowchart LR
    pr([PR opened]) --> lint[Run linters]
    lint --> ok{Clean?}
    ok -->|yes| post([Post review])
    ok -->|no| fix[Draft fixes] --> lint`,
    {
      maxLength: 4000,
      label:
        "Mermaid source for one diagram, at most 4000 characters: a flowchart (first line flowchart TD or flowchart LR), a sequenceDiagram, or a stateDiagram-v2. Use short labels. Not supported: classDef, class, style, linkStyle, click, :::, BT or RL directions, notes left or right of actors, activate, loop, alt, opt, par, autonumber, choice, fork, join and concurrency.",
    },
  ),
};

const M = 40;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const chart = mermaid(p.source, { theme, x: M, y: M, font: mono, play: { at: 0.4, step: 0.35 } });
  const D = Math.max(6, Math.ceil(chart.span.end + 3));

  return render(
    {
      width: Math.ceil(chart.bounds.w + 2 * M),
      height: Math.ceil(chart.bounds.h + 2 * M),
      duration: D,
      title: `A ${chart.kind} diagram`,
      desc: `A ${chart.kind} diagram drawn from Mermaid: ${p.source}`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {chart.kind === "state" ? (
        <g animation={leave(D)}>
          <g animation={rise(0.2)}>{chart}</g>
        </g>
      ) : (
        chart
      )}
    </>,
  );
}
