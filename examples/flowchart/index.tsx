import { render, flow } from "svjeez";
import { flowchart } from "@svjeez/diagrams";
import { choice, defaults, list, text, type Values } from "svjeez/params";
import { HEIGHT, WIDTH, css, fit, hue, mono, theme } from "../gallery-style";

const ROLES = ["task", "input", "output", "tool", "store", "decision"] as const;

export const params = {
  title: text("Review pipeline", { maxLength: 60 }),
  desc: text(
    "A flowchart of an agent review pipeline appears node by node, then a token runs from the opened PR to the posted review.",
    { maxLength: 300, label: "What the flowchart shows, for screen readers" },
  ),
  direction: choice("LR", ["LR", "TB"]),
  nodes: list(
    {
      id: text("", { maxLength: 24 }),
      label: text("", { maxLength: 28 }),
      role: choice("task", ROLES),
      group: text("", { maxLength: 24, label: "The id of the group it sits in, or empty" }),
    },
    [
      { id: "pr", label: "PR opened", role: "input", group: "" },
      { id: "memory", label: "Review memory", role: "store", group: "" },
      { id: "lint", label: "Run linters", role: "tool", group: "agent" },
      { id: "tests", label: "Run tests", role: "tool", group: "agent" },
      { id: "secrets", label: "Scan secrets", role: "tool", group: "agent" },
      { id: "analyze", label: "Analyze changes", role: "task", group: "agent" },
      { id: "issues", label: "Issues?", role: "decision", group: "agent" },
      { id: "fix", label: "Draft fixes", role: "task", group: "agent" },
      { id: "post", label: "Post review", role: "output", group: "" },
    ],
    { min: 2, max: 14 },
  ),
  groups: list(
    { id: text("", { maxLength: 24 }), label: text("", { maxLength: 28 }) },
    [{ id: "agent", label: "Review agent" }],
    { max: 3 },
  ),
  edges: list(
    {
      from: text("", { maxLength: 24 }),
      to: text("", { maxLength: 24 }),
      label: text("", { maxLength: 16 }),
    },
    [
      { from: "pr", to: "lint", label: "" },
      { from: "pr", to: "tests", label: "" },
      { from: "pr", to: "secrets", label: "" },
      { from: "lint", to: "analyze", label: "" },
      { from: "tests", to: "analyze", label: "" },
      { from: "secrets", to: "analyze", label: "" },
      { from: "memory", to: "analyze", label: "" },
      { from: "analyze", to: "issues", label: "" },
      { from: "issues", to: "fix", label: "yes" },
      { from: "fix", to: "analyze", label: "re-run" },
      { from: "issues", to: "post", label: "no" },
    ],
    { min: 1, max: 24 },
  ),
  from: text("pr", {
    maxLength: 24,
    label:
      "The node a token starts from once the chart is drawn. Empty, or an id the chart does not have, for none.",
  }),
  to: text("post", { maxLength: 24, label: "The node the token runs to." }),
};

/** The flowchart for `p`, laid out but not yet placed on the canvas. */
export const layout = (p: Values<typeof params>) =>
  flowchart(
    {
      nodes: Object.fromEntries(p.nodes.map(({ id, label, role }) => [id, { label, role }])),
      groups: Object.fromEntries(
        p.groups.map(({ id, label }) => [
          id,
          { label, nodes: p.nodes.filter((node) => node.group === id).map((node) => node.id) },
        ]),
      ),
      edges: p.edges.map(({ from, to, label }) => (label ? [from, to, label] : [from, to])),
    },
    {
      theme,
      x: 0,
      y: 0,
      direction: p.direction,
      font: mono,
      fontSize: 16,
      play: { at: 0.2, step: 0.3 },
      tints: {
        task: hue.blue,
        input: hue.blue,
        output: hue.blue,
        tool: hue.purple,
        store: hue.purple,
        decision: hue.orange,
      },
    },
  );

export const chart = layout(defaults(params));

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = layout(p);

  const trip = [p.from, p.to].every((id) => drawn.parts.some((part) => part.id === id))
    ? flow(drawn.route(p.from, p.to), {
        at: Math.max(3.5, drawn.span.end),
        speed: 240,
        style: "trace",
        color: theme.base09,
        arrive: true,
      })
    : undefined;

  const D = Math.max(10, Math.ceil((trip ?? drawn).span.end + 1));

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: p.desc,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={theme.base00} />
      <g transform={fit(drawn.bounds.w, drawn.bounds.h)}>
        {drawn.layers.under}
        {trip?.node}
        {drawn.layers.over}
      </g>
    </>,
  );
}
