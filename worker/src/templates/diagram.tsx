import { mermaid } from "@svjeez/mermaid";
import { render, span, type Drawn } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { defaults, text, type Values } from "svjeez/params";

import { css, leave, mono, motions, rise, theme } from "../../../examples/gallery-style";
import { block } from "../block";

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

/** The diagram laid out at its own size with its top-left at `box`'s, played in. A state diagram rises in at once. */
export const diagramBlock = (p: Values<typeof params>, box: Rect): Drawn & { kind: string } => {
  const chart = mermaid(p.source, {
    theme,
    x: box.x,
    y: box.y,
    font: mono,
    play: { at: 0.4, step: 0.35 },
  });

  const drawn =
    chart.kind === "state"
      ? block(<g animation={rise(0.2)}>{chart}</g>, span(0.2, motions.over), chart.bounds)
      : block(chart.node, chart.span, chart.bounds);

  return { ...drawn, kind: chart.kind };
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = diagramBlock(p, rect(M, M, 0, 0));
  const { kind } = drawn;
  const D = Math.max(6, Math.ceil(drawn.span.end + 3));

  return render(
    {
      width: Math.ceil(drawn.bounds.w + 2 * M),
      height: Math.ceil(drawn.bounds.h + 2 * M),
      duration: D,
      title: `A ${kind} diagram`,
      desc: `A ${kind} diagram drawn from Mermaid: ${p.source}`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {kind === "state" ? <g animation={leave(D)}>{drawn.node}</g> : drawn.node}
    </>,
  );
}
