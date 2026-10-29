import { mermaid } from "@svjeez/mermaid";
import { enter, rect, type Span } from "svjeez";
import { appWindow, code, flow, typewriter, type CodePiece, type CodeRole } from "svjeez/extras";
import { mono, theme } from "../style";
import { C, Caption, rise } from "./kit";

const SOURCE = `flowchart TD
  idea([an idea]) --> claude[[Claude]]
  claude --> scene[scene.tsx]
  scene --> look{looks right?}
  look -->|no| scene
  look -->|yes| svg((ship it))`;

// Mermaid has no grammar in @svjeez/code, so one regex with a group per role colors this screen of it.
const TOKEN =
  /(?<keyword>^flowchart|\bTD\b)|(?<string>\|[^|]*\|)|(?<punct>-->)|(?<fn>[([{]+[^)\]}]*[)\]}]+)/gm;

const ROLES = ["keyword", "string", "punct", "fn"] as const satisfies readonly CodeRole[];

const highlight = (line: string): CodePiece[] => {
  const out: CodePiece[] = [];
  let end = 0;

  for (const m of line.matchAll(TOKEN)) {
    const role = ROLES.find((r) => m.groups?.[r])!;
    out.push(line.slice(end, m.index), [role, m[0]]);
    end = m.index + m[0].length;
  }

  return [...out, line.slice(end)].filter(Boolean);
};

const editor = appWindow(rect(64, 120, 560, 330), { theme, title: "pipeline.mmd" });
const STEP = 0.32;

export const pipelineShot = ({ at, over }: Span) => {
  const typed = typewriter(
    code(SOURCE.split("\n").map(highlight), {
      theme,
      font: mono,
      fontSize: 15,
      lineHeight: 2,
      x: editor.body.x + 22,
      y: editor.body.y + 22,
    }),
    { at: at + 0.35, cps: 120, cursor: C.accent, blink: false },
  );

  // The first node arrives with the line that names it; the rest follow `STEP` apart.
  const shown = typed.spans[1]!.at + typed.spans[1]!.over - 0.15;

  const chart = mermaid(SOURCE, {
    theme,
    font: mono,
    fontSize: 17,
    x: 940,
    y: 318,
    anchor: "center",
    play: { at: shown, step: STEP },
  });

  if (chart.kind !== "flowchart") throw new Error("the pipeline is a flowchart");

  const trip = flow(chart.route("idea", "svg"), {
    at: typed.end + 0.6,
    over: Math.min(1.3, at + over - typed.end - 1.2),
    style: "comet",
    arrive: true,
    color: C.accent,
    size: 5,
  });

  return (
    <>
      <g animation={rise(at, 0.45, 16)}>{editor.node}</g>
      {typed.node}
      <g animation={enter({ at: shown - 0.3, over: 0.3 }, { opacity: 0, y: 8 })}>
        {chart.layers.under}
        {trip.node}
        {chart.layers.over}
      </g>
      <Caption
        at={at + 0.1}
        tag="@svjeez/mermaid"
        call="mermaid(`flowchart TD …`)"
        line="Mermaid text in, an animated diagram out"
      />
    </>
  );
};
