import { render, show } from "svjeez";
import { tree } from "@svjeez/diagrams";
import { CSS, chrome, outro } from "./lib/kit";
import { theme } from "../style";
import { GROUND, chick, hopAcross } from "./lib/chick";

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
  {
    theme,
    x: W / 2,
    y: BAR + (H - BAR) / 2,
    anchor: "center",
    fontSize: 12,
    class: "sans",
    play: { at: 0.5, step: 0.5 },
  },
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A tree that grows",
      desc: "An agent team revealed level by level: a lead, three workers and two children, then the svjeez chick hops across the tree from node to node.",
      css: CSS,
      reducedMotion: { at: D - 2 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {team.node}
        <g
          animation={[
            show({ at: 2.8, over: 3.9 }, { fade: 0.2 }),
            ...hopAcross(
              (["a", "search", "lead", "build", "b"] as const).map((id) => team.get(id).top),
              3,
              0.5,
              0.25,
            ).animation,
          ]}
        >
          <g transform={`scale(0.2) translate(${-GROUND.x} ${-GROUND.y})`}>
            {chick({ blinks: [4.2], feet: {} })}
          </g>
        </g>
      </g>
    </>,
  );
}
