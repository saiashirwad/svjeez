import { def, el, type Child, type Color, type SvgNode } from "svjeez";
import { Frost } from "./hole";
import { C, FRAME, ui } from "./theme";

const { x: X, y: Y, width: WIDTH, height: HEIGHT } = FRAME;

const fog = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#040115" stopOpacity={0} />
    <stop offset={0.3448} stopColor="#040115" stopOpacity={0.7} />
    <stop offset={0.8236} stopColor={C.bg} />
  </>
));

const ICONS = {
  pen: "M-5 5L-4 1.5L3 -5.5L5.5 -3L-1.5 4L-5 5Z",
  note: "M-5 -6H2L5 -3V6H-5Z M2 -6V-3H5",
  task: "M-3 0L-1 2L3 -2 M0 -6A6 6 0 1 1 -0.01 -6",
  map: "M0 -2.5A2.5 2.5 0 1 1 -0.01 -2.5 M0 -7V-5 M0 5V7 M-7 0H-5 M5 0H7 M-5 -5L-3.5 -3.5 M3.5 3.5L5 5 M-5 5L-3.5 3.5 M3.5 -3.5L5 -5",
  pin: "M-2 -6H2L1.5 -1L4 1.5H-4L-1.5 -1Z M0 1.5V6",
  link: "M-1 1L1 -1 M-3 -1L-4.5 0.5A2.5 2.5 0 0 0 -1 4L0.5 2.5 M3 1L4.5 -0.5A2.5 2.5 0 0 0 1 -4L-0.5 -2.5",
  clock: "M0 -6A6 6 0 1 1 -0.01 -6 M0 -3V0L2.5 1.5",
} as const;

function Icon({ d, x, y, color }: { d: string; x: number; y: number; color: Color }): SvgNode {
  return el.path({ d, transform: `translate(${x} ${y})`, fill: "none", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" });
}

const NAV = [
  { icon: ICONS.pen, label: "Daily notes", active: true },
  { icon: ICONS.note, label: "All notes", active: false },
  { icon: ICONS.task, label: "Tasks", active: false },
  { icon: ICONS.map, label: "Map", active: false },
] as const;

const PINNED = ["How to use Reflect", "The power of backlinks", "Saving websites", "Tips and tricks"] as const;

function Sidebar(): SvgNode {
  return (
    <g>
      <rect x={137.5} y={722.5} width={246} height={35} rx={8} fill="#FFF" fillOpacity={0.03} stroke="#FFF" strokeOpacity={0.08} />
      <circle cx={155} cy={738} r={5} fill="none" stroke="#FFF" strokeOpacity={0.6} strokeWidth={1.4} />
      <path d="M159 742L162.5 745.5" stroke="#FFF" strokeOpacity={0.6} strokeWidth={1.4} strokeLinecap="round" />
      <text x={177} y={745} {...ui(14, "#FFFFFF", { fillOpacity: 0.45 })}>Search anything...</text>
      <rect x={343} y={731} width={34} height={18} rx={9} fill="#FFF" fillOpacity={0.08} />
      <text x={360} y={744} {...ui(10.5, "#FFFFFF", { fillOpacity: 0.8, fontWeight: 600, textAnchor: "middle" })}>⌘K</text>
      <rect x={408.5} y={731} width={7} height={11} rx={3.5} fill="none" stroke="#FFF" strokeOpacity={0.5} strokeWidth={1.3} />
      <path d="M405.5 739A6.5 6.5 0 0 0 418.5 739M412 745.5V748.5" fill="none" stroke="#FFF" strokeOpacity={0.5} strokeWidth={1.3} strokeLinecap="round" />

      {NAV.map(({ icon, label, active }, i) => {
        const y = 808 + i * 40;
        const color = active ? C.link : "#A9A6BC";
        return el.g({}, [
          <Icon d={icon} x={157} y={y} color={color} />,
          el.text({ x: 177, y: y + 5, ...ui(13.5, color, { fontWeight: 500, fillOpacity: active ? 1 : 0.7 }) }, label),
        ]);
      })}

      <text x={145} y={985} {...ui(12, "#FFFFFF", { fillOpacity: 0.3 })}>Pinned notes</text>
      {PINNED.map((label, i) =>
        el.text({ x: 145, y: 1028 + i * 40, ...ui(13.5, "#FFFFFF", { fillOpacity: 0.45 }) }, label),
      )}
    </g>
  );
}

type Run = string | { readonly link: string };

interface Line {
  readonly depth: 0 | 1 | 2;
  readonly runs: readonly Run[];
  readonly wrap?: true;
}

const NOTE: readonly Line[] = [
  { depth: 0, runs: ["Today I started using ", { link: "Reflect!" }] },
  { depth: 1, runs: ["What is Reflect?"] },
  { depth: 2, runs: ["A note-taking tool designed to mirror the way we think"] },
  { depth: 2, runs: ["Our brains remember things through associations. Reflect mimics this"] },
  { depth: 2, wrap: true, runs: ["by backlinking notes to each other (read more on backlinking ", { link: "here" }, ")."] },
  { depth: 2, runs: ["Over time, this gives you superhuman recall skills. Reflect becomes an"] },
  { depth: 2, wrap: true, runs: ["extension of your brain."] },
  { depth: 1, runs: ["What should I record within Reflect?"] },
  { depth: 2, runs: [{ link: "What happens in your day" }] },
  { depth: 2, runs: [{ link: "Meeting notes" }] },
  { depth: 2, runs: [{ link: "To-do" }, " and ", { link: "Top of Mind" }, " lists"] },
  { depth: 2, runs: [{ link: "People you encounter (CRM)" }] },
  { depth: 2, runs: [{ link: "Daily reflections" }, " (like gratitude journaling)"] },
  { depth: 2, runs: ["Save clips from the ", { link: "web" }, " or your ", { link: "Kindle" }] },
  { depth: 1, runs: ["Some tips for using Reflect"] },
  { depth: 2, runs: ["We recommend you splitting your personal and work notes into two graphs."] },
];

const TOPS = NOTE.reduce<number[]>((tops, line) => [...tops, (tops.at(-1) ?? 790) + (line.wrap ? 24 : 32)], []);

const runs = (line: Line): Child =>
  line.runs.map((run) =>
    typeof run === "string" ? run : el.tspan({ class: "u", fill: C.link }, run.link),
  );

function Note(): SvgNode {
  return (
    <g>
      <line x1={440.5} y1={705} x2={440.5} y2={1455} stroke="#FFF" strokeOpacity={0.06} />
      <line x1={1000.5} y1={705} x2={1000.5} y2={1455} stroke="#FFF" strokeOpacity={0.06} />
      <line x1={441} y1={736.5} x2={1000} y2={736.5} stroke="#FFF" strokeOpacity={0.05} />

      <rect x={459} y={764} width={4} height={18} rx={2} fill={C.link} />
      <text x={476} y={779} {...ui(16, C.ink, { fontWeight: 600 })}>Sun, April 2nd, 2023</text>

      <line x1={478.5} y1={830} x2={478.5} y2={1240} stroke="#FFF" strokeOpacity={0.08} />
      <line x1={498.5} y1={862} x2={498.5} y2={1000} stroke="#FFF" strokeOpacity={0.08} />
      <line x1={498.5} y1={1038} x2={498.5} y2={1225} stroke="#FFF" strokeOpacity={0.08} />

      {NOTE.map((line, i) => {
        const y = TOPS[i]!;
        const x = 497 + line.depth * 20;
        return el.g({}, [
          !line.wrap && el.circle({ cx: x - 18.5, cy: y - 4.5, r: 2, fill: "#FFF", fillOpacity: 0.4 }),
          el.text({ x, y, ...ui(13.5, "#FFFFFF", { fillOpacity: line.depth === 2 ? 0.6 : 0.75 }) }, runs(line)),
        ]);
      })}
    </g>
  );
}

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const MONTH = Array.from({ length: 35 }, (_, i) => (i < 5 ? { day: 27 + i, outside: true } : { day: i - 4, outside: false }));

const ACTIONS = [
  { icon: ICONS.pin, label: "Pin this note" },
  { icon: ICONS.link, label: "Share with private link" },
  { icon: ICONS.clock, label: "Show history" },
] as const;

function Calendar(): SvgNode {
  const column = (i: number) => 1036 + i * 41;
  return (
    <g>
      <text x={1016} y={747} {...ui(16, C.ink, { fontWeight: 600 })}>April 2023</text>
      <g fill="none" stroke="#FFF" strokeOpacity={0.6} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1229 737L1225 741L1229 745" />
        <rect x={1253} y={735} width={12} height={12} rx={2.5} />
        <path d="M1253 739H1265" />
        <path d="M1289 737L1293 741L1289 745" />
      </g>

      {DAYS.map((day, i) =>
        el.text({ x: column(i), y: 803, ...ui(13, "#FFFFFF", { fillOpacity: 0.7, fontWeight: 500, textAnchor: "middle" }) }, day),
      )}
      <line x1={1001} y1={822.5} x2={1318} y2={822.5} stroke="#FFF" strokeOpacity={0.06} />

      <rect x={1267} y={831} width={32} height={32} rx={6} fill={C.select} />
      {MONTH.map(({ day, outside }, i) =>
        el.text(
          {
            x: column(i % 7),
            y: 852 + Math.floor(i / 7) * 40,
            ...ui(13, "#FFFFFF", { fillOpacity: outside ? 0.25 : day === 2 ? 1 : 0.6, textAnchor: "middle" }),
          },
          day,
        ),
      )}

      <text x={1024} y={1061} {...ui(12, "#FFFFFF", { fillOpacity: 0.3 })}>Note actions</text>
      {ACTIONS.map(({ icon, label }, i) =>
        el.g({}, [
          <Icon d={icon} x={1036} y={1099 + i * 40} color="#A9A6BC" />,
          el.text({ x: 1055, y: 1104 + i * 40, ...ui(13.5, "#FFFFFF", { fillOpacity: 0.55, fontWeight: 500 }) }, label),
        ]),
      )}
    </g>
  );
}

const pane = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#120C2E" stopOpacity={0.35} />
    <stop offset={0.3} stopColor="#0B0720" stopOpacity={0.75} />
  </>
));

const knob = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0.18} stopColor="#FFF" stopOpacity={0.01} />
    <stop offset={1} stopColor="#FFF" stopOpacity={0.12} />
  </>
));

const knobEdge = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#FFF" stopOpacity={0.05} />
    <stop offset={1} stopColor="#FFF" stopOpacity={0.15} />
  </>
));

function Play(): SvgNode {
  const cy = Y + 302;
  return el.g({}, [
    el.circle({ cx: 720, cy, r: 55.5, fill: "#FFF", fillOpacity: 0.02, stroke: "#FFF", strokeOpacity: 0.05 }),
    el.circle({ cx: 720, cy, r: 40, fill: "#1A1530", fillOpacity: 0.6 }),
    el.circle({ cx: 720, cy, r: 39.5, fill: knob, stroke: knobEdge }),
    el.path({
      d: "M17.9 10.26C19.26 11.02 19.26 12.98 17.9 13.74L7.98 19.32C6.65 20.07 5 19.11 5 17.58V6.42C5 4.89 6.65 3.93 7.98 4.68Z",
      transform: `translate(${720 - 11.5} ${cy - 12}) scale(0.95)`,
      fill: "#FFF",
    }),
  ]);
}

export function AppWindow(): SvgNode {
  return (
    <g>
      <rect x={X + 0.5} y={Y + 0.5} width={WIDTH - 1} height={HEIGHT - 1} rx={23.5} fill="#FFF" fillOpacity={0.01} stroke="#FFF" strokeOpacity={0.1} />
      <rect x={X + 4.5} y={Y + 4.5} width={WIDTH - 9} height={HEIGHT - 9} rx={20} fill="none" stroke="#FFF" strokeOpacity={0.03} strokeWidth={7} />
      <rect x={X + 8} y={Y + 8} width={WIDTH - 16} height={HEIGHT - 16} rx={16} fill={pane} />
      <Frost />
      <Sidebar />
      <Note />
      <Calendar />
      <rect x={X} y={Y} width={WIDTH} height={HEIGHT + 1} fill={fog} />
      <Play />
    </g>
  );
}
