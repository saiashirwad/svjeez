import { render } from "svjeez";
import { travel, tree } from "svjeez/extras";
import { CSS, theme, mono } from "./kit";

const M = 24;
const team = tree(
  { nodes: { lead: "Lead", a: { label: "Search", parent: "lead" }, b: { label: "Build", parent: "lead" } } },
  { theme, x: M, y: M, font: mono, fontSize: 13, reveal: { at: 0.5 } },
);

export default function build(): string {
  return render(
    { width: team.bounds.w + 2 * M, height: team.bounds.h + 2 * M, duration: 5, title: "Tree", desc: "A lead with two children revealed level by level, then a dot runs from Search up to Lead and down to Build.", css: CSS, reducedMotion: { at: 4 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {team.node}
      <circle r={4} fill={theme.base09} animation={travel(team.route("a", "b"), { at: 2, speed: 160 })} />
    </>,
  );
}
