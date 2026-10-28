import { motion, rect, render } from "svjeez";
import { Marker, code, flow, flowchart, window, type Run, type Tokens } from "svjeez/extras";
import { CSS, theme } from "./kit";

const STEP = 0.9;
const START = 1;

const k = (text: string): Run => ["keyword", text];
const p = (text: string): Run => ["punct", text];
const s = (text: string): Run => ["string", `"${text}"`];

const edge = (from: string, to: string, label?: string): Tokens[number] => ["    [", s(from), p(", "), s(to), ...(label ? [p(", { "), "label", p(": "), s(label), p(" }")] : []), p("],")];

const source: Tokens = [
  [k("const"), " chart ", p("="), " ", ["fn", "flowchart"], p("({")],
  ["  nodes", p(": {")],
  ["    pr", p(": "), s("PR opened"), p(",")],
  ["    lint", p(": "), s("Run linters"), p(",")],
  ["    ok", p(": { "), "label", p(": "), s("Clean?"), p(", "), "role", p(": "), s("decision"), p(" },")],
  ["    post", p(": "), s("Post review"), p(",")],
  ["  ", p("},")],
  ["  edges", p(": [")],
  edge("pr", "lint"),
  edge("lint", "ok"),
  edge("ok", "post", "yes"),
  edge("ok", "lint", "no"),
  ["  ", p("],")],
  [p("});")],
];

const spec = {
  nodes: { pr: "PR opened", lint: "Run linters", ok: { label: "Clean?", role: "decision" }, post: "Post review" },
  edges: [["pr", "lint"], ["lint", "ok"], ["ok", "post", { label: "yes" }], ["ok", "lint", { label: "no" }]],
} as const;
const look = { theme, fontSize: 12, class: "mono", play: { at: START, step: STEP } };

const M = 24;
const CODE_W = 420;
const FONT = 12.5;
const LINE = 1.75;
const size = flowchart(spec, look).bounds;
const W = CODE_W + size.w + 4 * M;
const H = Math.max(size.h + 2 * M, source.length * FONT * LINE + 76 + 2 * M);
const shell = window(rect(M, M, CODE_W, H - 2 * M), { theme, title: "readme.tsx", class: "mono" });
const src = code(source, { theme, x: shell.body.x + 18, y: shell.body.y + 18, fontSize: FONT, lineHeight: LINE });
const chart = flowchart(spec, { ...look, x: (CODE_W + 2 * M + W) / 2, y: H / 2, anchor: "center" });

const nodesDone = START + 4 * STEP;
const trip = flow(chart.route("pr", "post"), { at: nodesDone + 1.2, style: "comet", arrive: true, color: theme.base09 });
const D = Math.ceil(trip.end) + 2;

const pad = (line: number) => src.lines(line, line).pad(3);
const stops = [3, 4, 5, 6].map((line, i) => ({ at: { at: START + i * STEP, over: STEP }, rect: pad(line) }));

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez: TSX to an animated flowchart",
      desc: "A flowchart spec written in TSX on the left; on the right each node appears as its line is highlighted, then a comet runs from the opened PR to the posted review.",
      css: CSS,
      reducedMotion: { at: D - 1.5 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base01} />
      <g animation={motion({ opacity: 1 }).at(D - 0.6).to({ opacity: 0 }, 0.5)}>
        {shell.node}
        <Marker stops={[...stops, { at: { at: nodesDone, over: trip.end - nodesDone }, rect: src.lines(8, 13).pad(3) }]} />
        <g class="mono">{src.node}</g>
        {chart.layers.under}
        {trip.node}
        {chart.layers.over}
      </g>
    </>,
  );
}
