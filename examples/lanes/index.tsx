import { render } from "svjeez";
import { adaptive, lanes, tomorrow, tomorrowNight } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const M = 40;

const run = lanes(
  {
    lanes: {
      lead: { label: "TH-01 lead", role: "input" },
      search: { label: "TH-02 search", role: "task" },
      build: { label: "TH-03 build", role: "tool" },
    },
    spans: [
      { lane: "lead", from: 0, to: 2.6, label: "planning" },
      { lane: "lead", from: 4.6, to: 5.6, label: "review" },
      { lane: "lead", from: 7.2, to: 8.5, label: "merge" },
      { lane: "search", from: 1, to: 4.6, label: "researching" },
      { lane: "build", from: 2.6, to: 7.2, label: "editing" },
    ],
    events: [
      { lane: "search", at: 1.8, label: "READ", role: "task" },
      { lane: "search", at: 3.4, label: "WEB", role: "output" },
      { lane: "build", at: 3.6, label: "EDIT", role: "store" },
      { lane: "build", at: 5.2, label: "TEST", role: "decision" },
      { lane: "build", at: 6.6, label: "EDIT", role: "store" },
    ],
    links: [
      { from: "lead", to: "search", at: 1 },
      { from: "lead", to: "build", at: 2.6 },
      { from: "search", to: "lead", at: 4.6 },
      { from: "build", to: "lead", at: 7.2 },
    ],
  },
  { theme, x: M, y: M, font: mono, scale: 90, play: { at: 0 } },
);

const D = 11;

export default function build(): string {
  return render(
    {
      width: run.bounds.w + 2 * M,
      height: run.bounds.h + 2 * M,
      duration: D,
      title: "Agent threads",
      desc: "Three agent threads over time: the lead plans and delegates, search reads and browses, build edits and tests, and each reports back to the lead.",
      reducedMotion: { at: 9 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {run.node}
    </>,
  );
}
