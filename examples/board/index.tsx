import { Dom, duration, find, loop, rect as partRect, shots, size, type Step } from "@svjeez/dom";
import { recordings } from "@svjeez/dom/vite";
import { fileURLToPath } from "node:url";
import { Camera, def, ease, motion, render, span, type Point } from "svjeez";
import { rect } from "svjeez/geometry";
import { geist } from "../fonts/faces.ts";
import { css, palette, theme } from "../style.ts";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const demos = await recordings<typeof import("./board.demo.tsx")>(here("board.demo.tsx"), {
  cache: here("snapshots.json"),
  fonts: [geist],
  // The app's CSS paints with --base00 to --base0F; <Dom palette> turns those colors back into the variables.
  palette,
});

const steps = loop(demos.board, { over: 0.9, wait: 0.4 });
const app = size(steps);
const frame = rect(0, 0, app.width, app.height);

const camera = shots(
  steps,
  { idle: "all", palette: "sheet", dialog: "sheet", created: "all", carried: "board", done: "all" },
  { frame, zoom: 1.7, over: 0.6 },
);

const nameOf = (step: Step) =>
  "wait" in step ? undefined : "root" in step ? step.name : step[0].name;

const when = (name: string, last = false): number => {
  const i = last
    ? steps.findLastIndex((step) => nameOf(step) === name)
    : steps.findIndex((step) => nameOf(step) === name);

  if (i < 1) throw new Error(`No snapshot "${name}" after the first.`);

  return duration(steps.slice(0, i));
};

const spot = (snapshot: string, part: string, dx = 0.5, dy = 0.5): Point => {
  const box = partRect(find(steps, snapshot)!, part);

  if (!box) throw new Error(`No part "${part}" in "${snapshot}".`);

  return { x: box.x + box.width * dx, y: box.y + box.height * dy };
};

const REST: Point = { x: 680, y: 410 };

const clicks = [
  { at: when("dialog"), to: spot("narrowed", "cmd-new-issue", 0.3) },
  { at: when("labelled"), to: spot("titled", "label-feature") },
  { at: when("assigned"), to: spot("labelled", "who-mara") },
  { at: when("created"), to: spot("assigned", "create") },
  { at: when("carried"), to: spot("created", "card-ENG-143", 0.55, 0.35) },
  { at: when("menu"), to: spot("dropped", "status-ENG-143") },
  { at: when("done"), to: spot("menu", "set-done", 0.35) },
];

const carried = { at: when("carried"), to: spot("carried", "card-ENG-143", 0.55, 0.35) };

const home = when("idle", true);

const path = clicks.reduce(
  (m, click, i) => {
    const before = i === 0 ? 0 : clicks[i - 1]!.at;
    const start = Math.max(before + 0.15, click.at - 0.6);
    const moved = m.to(click.to, span(start).until(click.at), ease.inOut);

    return i === 4 ? moved.to(carried.to, span(carried.at, 0.6), ease.inOut) : moved;
  },
  motion({ x: REST.x, y: REST.y }),
);

const Cursor = () => (
  <path
    d="M0 0V17.6l4.6-4.2 3.3 7.5 3.1-1.3-3.3-7.3H13.2Z"
    fill={theme.base00}
    stroke={theme.base07}
    strokeWidth={1.2}
    strokeLinejoin="round"
    animation={path.to(REST, span(home, 0.9), ease.inOut)}
  />
);

const Ripple = ({ at, to }: { at: number; to: Point }) => (
  <circle
    cx={to.x}
    cy={to.y}
    r={14}
    fill="none"
    stroke={theme.base0D}
    strokeWidth={2}
    opacity={0}
    animation={motion({ opacity: 0, scale: 0.3 })
      .to({ opacity: 0.9, scale: 0.6 }, span(at - 0.05, 0.08))
      .to({ opacity: 0, scale: 1.3 }, span(at - 0.05, 0.08).next(0.4))}
  />
);

export default function build(): string {
  return render(
    {
      width: frame.w,
      height: frame.h,
      duration: duration(steps),
      css,
      title: "A project board, filmed from its React demo",
      desc: "A command palette opens and narrows to New issue as it is typed into, then turns into a dialog where a title is typed and a label and assignee picked. The new card lands in Todo, is dragged to In progress and marked done; the counts, the cycle's progress and the sidebar update, and a toast confirms.",
    },
    <g clipPath={def.clipPath({}, <rect width={frame.w} height={frame.h} rx={12} />)}>
      <rect width={frame.w} height={frame.h} fill={theme.base00} />
      <Camera {...camera}>
        <Dom states={steps} fonts={[geist]} palette={palette} />
        {clicks.map((click) => (
          <Ripple {...click} />
        ))}
        <Cursor />
      </Camera>
    </g>,
  );
}
