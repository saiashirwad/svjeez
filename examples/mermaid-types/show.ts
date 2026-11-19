import { mermaid } from "@svjeez/mermaid";
import { Align, Group, Shape, scene, span } from "svjeez";
import { mono, theme } from "../theme";

const M = 32;

export const show = (title: string, text: string) => {
  const chart = mermaid(text, {
    font: mono,
    textSize: 13,
    // state diagrams animate through walk(), not reveal
    ...(/^\s*stateDiagram/.test(text) ? {} : { reveal: span(0.3, 0.3) }),
    colors: {
      background: theme.background,
      text: theme.text,
      line: theme.border,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.orange,
      roles: {
        input: theme.blue,
        task: theme.magenta,
        tool: theme.cyan,
        output: theme.blue,
        store: theme.magenta,
        decision: theme.orange,
      },
    },
  });

  return scene(
    {
      size: [chart.size[0] + 2 * M, chart.size[1] + 2 * M],
      duration: 8,
      title,
      desc: `A Mermaid ${chart.kind} diagram drawn by @svjeez/mermaid.`,
      theme,
      still: 7.5,
    },
    (canvas) =>
      Group({
        children: [
          Shape({ geometry: canvas.rect, fill: theme.background }),
          Align({ children: chart.node }),
        ],
      }),
  );
};
