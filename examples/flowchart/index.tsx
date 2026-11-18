import { flowchart } from "@svjeez/diagrams";
import { Align, Group, Shape, canvas, circle, draw, ease, exit, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

export const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      memory: { label: "Review memory", role: "store" },
      lint: { label: "Run linters", role: "tool" },
      tests: { label: "Run tests", role: "tool" },
      secrets: { label: "Scan secrets", role: "tool" },
      analyze: "Analyze changes",
      issues: { label: "Issues?", role: "decision" },
      fix: "Draft fixes",
      post: { label: "Post review", role: "output" },
    },
    groups: {
      agent: {
        label: "Review agent",
        nodes: ["lint", "tests", "secrets", "analyze", "issues", "fix"],
      },
    },
    edges: [
      ["pr", "lint"],
      ["pr", "tests"],
      ["pr", "secrets"],
      ["lint", "analyze"],
      ["tests", "analyze"],
      ["secrets", "analyze"],
      ["memory", "analyze"],
      ["analyze", "issues"],
      ["issues", "fix", "yes"],
      ["fix", "analyze", "re-run"],
      ["issues", "post", "no"],
    ],
  },
  {
    font: mono,
    size: 13,
    direction: "LR",
    reveal: span(0.2, 0.3),
    colors: {
      background: theme.background,
      text: theme.text,
      line: theme.border,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.orange,
      roles: { tool: theme.magenta, store: theme.magenta, decision: theme.orange },
    },
  },
);

const trip = span(3.6, 2.4);
const route = chart.route("pr", "post");
const LEAVE = span(9.2, 0.6);

export default scene(
  {
    size: [960, 540],
    duration: 10,
    title: "Review pipeline",
    desc: "A flowchart of an agent review pipeline appears node by node, then a token runs from the opened PR to the posted review.",
    theme,
    reducedMotion: 8,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(LEAVE)}>
        <Group scale={900 / chart.size[0]}>
          {chart.with(
            <Shape
              geometry={route.geometry}
              stroke={{ color: theme.orange, width: 2.5, cap: "round" }}
              trim={draw(trip, { curve: ease.linear })}
            />,
          )}
          <Shape
            geometry={circle(5)}
            anchor="center"
            fill={theme.orange}
            at={route.travel(trip)}
            opacity={track(0)
              .to(1, span(trip.start, 0.15))
              .to(0, span(trip.end - 0.2, 0.2))}
          />
        </Group>
      </Align>
    </Group>
  ),
);
