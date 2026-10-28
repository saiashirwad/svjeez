import { render } from "svjeez";
import { travel, tree } from "svjeez/extras";
import { CSS, chrome, outro, theme } from "./kit";

const W = 504;
const H = 340;
const BAR = 40;
const D = 7;
const win = chrome(W, H, "team.tsx");

const team = tree(
  {
    nodes: {
      lead: { label: "Lead", role: "task" },
      search: { label: "Search", parent: "lead", role: "tool" },
      build: { label: "Build", parent: "lead", role: "tool" },
      review: { label: "Review", parent: "lead", role: "tool" },
      a: { label: "Docs", parent: "search" },
      b: { label: "Tests", parent: "build" },
    },
  },
  { theme, x: W / 2, y: BAR + (H - BAR) / 2, anchor: "center", fontSize: 12, class: "sans", play: { at: 0.5, step: 0.5 } },
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A tree that grows",
      desc: "An agent team revealed level by level: a lead, three workers and two children, then a dot runs between branches.",
      css: CSS,
      reducedMotion: { at: D - 2 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {team.node}
        <circle r={4.5} fill={theme.base09} animation={travel(team.route("a", "b"), { at: 3, speed: 170 })} />
      </g>
    </>,
  );
}
