/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import { render } from "svjeez";
import { adaptive, flow, flowchart, tomorrow, tomorrowNight } from "svjeez/extras";

const { theme, css: colors } = adaptive({ dark: tomorrowNight, light: tomorrow });
const css = `${colors}\n.sans text{font-family:system-ui,sans-serif}`;
const M = 24;

// A typed diagram: a misspelled node id in `edges` or `route` is a compile error.
const chart = flowchart(
  {
    nodes: { push: { label: "git push", role: "input" }, ci: { label: "Run CI", role: "tool" }, green: { label: "Green?", role: "decision" }, ship: { label: "Deploy", role: "output" } },
    edges: [["push", "ci"], ["ci", "green"], ["green", "ship", { label: "yes" }], ["green", "ci", { label: "retry" }]],
  },
  { theme, x: M, y: M, fontSize: 13, class: "sans", play: { at: 0.4, step: 0.4 } },
);
const trip = flow(chart.route("push", "ship"), { at: 2.6, style: "comet", arrive: true, color: theme.base09 });

export default function build(): string {
  return render(
    { width: chart.bounds.w + 2 * M, height: chart.bounds.h + 2 * M, duration: Math.ceil(trip.end) + 2, title: "Deploy flow", desc: "A CI flowchart revealed rank by rank, then a comet runs from push to deploy.", css, reducedMotion: { at: trip.end } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {chart.layers.under}
      {trip.node}
      {chart.layers.over}
    </>,
  );
}
