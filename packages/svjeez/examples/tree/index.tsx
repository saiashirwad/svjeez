import { render } from "svjeez";
import { adaptive, systemLight, systemDark, travel, tree } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ light: systemLight, dark: systemDark });
const M = 40;

const team = tree(
  {
    nodes: {
      lead: { label: "TH-01 lead", role: "input" },
      research: { label: "TH-02 research", parent: "lead" },
      build: { label: "TH-03 build", parent: "lead" },
      review: { label: "TH-04 review", parent: "lead", role: "decision" },
      docs: { label: "TH-05 docs", parent: "research", role: "store" },
      web: { label: "TH-06 web", parent: "research", role: "tool" },
      api: { label: "TH-07 api", parent: "build" },
      ui: { label: "TH-08 ui", parent: "build" },
      tests: { label: "TH-09 tests", parent: "ui", role: "tool" },
    },
  },
  { theme, x: M, y: M, font: mono, play: { at: 0.4, step: 0.3 } },
);

const D = 9;
const trip = team.route("docs", "tests");

export default function build(): string {
  return render(
    {
      width: team.bounds.w + 2 * M,
      height: team.bounds.h + 2 * M,
      duration: D,
      title: "Delegation tree",
      desc: "A lead agent's delegation tree revealed level by level, then a message runs from the docs thread to the tests thread through their common ancestor.",
      reducedMotion: { at: D - 1 },
      loop: false,
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {team.node}
      <circle r={5} fill={theme.base09} animation={travel(trip, { at: 4.2, speed: 220 })} />
    </>,
  );
}
