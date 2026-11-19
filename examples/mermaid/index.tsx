import { mermaid } from "@svjeez/mermaid";
import { Align, Group, Shape, canvas, circle, ease, exit, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

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
  {
    font: mono,
    size: 13,
    reveal: span(0.4, 0.35),
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

if (chart.kind !== "flowchart") throw new Error("the pipeline is a flowchart");

const trip = span(5, 3);
const route = chart.route("push", "done");
const LEAVE = span(11.2, 0.6);

export default scene(
  {
    size: [chart.size[0] + 2 * M, chart.size[1] + 2 * M],
    duration: 12,
    title: "Deploy pipeline from Mermaid",
    desc: "A deploy pipeline written as Mermaid text appears node by node as a svjeez flowchart, then a token runs from the push to the live release.",
    theme,
    reducedMotion: 10,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(LEAVE)}>
        <Group>
          {chart.with(
            <Shape
              geometry={route.geometry}
              stroke={{ color: theme.orange, width: 2.5, cap: "round" }}
              draw={track(0).to(1, trip, ease.linear)}
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
