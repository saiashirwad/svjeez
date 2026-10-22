import { enter, exit, type Child, type SvgNode } from "svg-motion";
import { bg, cool, grid, vignette, warm } from "./defs";
import { C } from "./theme";
import { mono, serif, ui } from "./ui";

const COPY_MOTION = [
  enter({ at: 0.42, over: 0.46 }, { opacity: 0, y: 7 }).at(4.2).to({ opacity: 0, y: -4 }, 0.22),
  enter({ at: 4.47, over: 0.44 }, { opacity: 0, y: 7 }).at(9.05).to({ opacity: 0, y: -4 }, 0.18),
  enter({ at: 9.31, over: 0.41 }, { opacity: 0, y: 7 }).at(14.25).to({ opacity: 0, y: -4 }, 0.18),
  enter({ at: 14.5, over: 0.42 }, { opacity: 0, y: 7 }).at(19.45).to({ opacity: 0, y: -4 }, 0.18),
  enter({ at: 19.71, over: 0.41 }, { opacity: 0, y: 7 }).at(23.61).to({ opacity: 0, y: -4 }, 0.18),
  enter({ at: 23.87, over: 0.36 }, { opacity: 0, y: 7 }).at(25.77).to({ opacity: 0 }, 0.18),
];

const TICK_MOTION = [
  exit({ at: 4.2, over: 0.22 }),
  enter({ at: 4.52, over: 0.26 }).at(9.05).to({ opacity: 0 }, 0.2),
  enter({ at: 9.4, over: 0.2 }).at(14.25).to({ opacity: 0 }, 0.2),
  enter({ at: 14.6, over: 0.2 }).at(19.45).to({ opacity: 0 }, 0.2),
  enter({ at: 19.8, over: 0.2 }).at(23.61).to({ opacity: 0 }, 0.2),
  enter({ at: 23.96, over: 0.2 }).at(25.9).to({ opacity: 0 }, 0.1),
];

const ACTIVE_MOTION = [
  enter({ at: 4.84, over: 0.2 }).at(9).to({ opacity: 0 }, 0.2),
  enter({ at: 9.36, over: 0.2 }).at(14.3).to({ opacity: 0 }, 0.2),
  enter({ at: 14.56, over: 0.2 }).at(19.5).to({ opacity: 0 }, 0.2),
  enter({ at: 19.76, over: 0.2 }).at(23.82).to({ opacity: 0 }, 0.2),
];

export function Backdrop(): SvgNode {
  return (
    <>
      <rect width={1200} height={760} fill={bg} />
      <rect width={1200} height={760} fill={grid} />
      <rect width={1200} height={760} fill={warm} />
      <rect width={1200} height={760} fill={cool} />
      <circle cx={1010} cy={58} r={358} fill="none" stroke={C.gold} strokeOpacity={0.05} />
      <circle cx={1010} cy={58} r={498} fill="none" stroke={C.rule} strokeOpacity={0.02} />
      <rect width={1200} height={760} fill={vignette} />
    </>
  );
}

export function Header(): SvgNode {
  return (
    <g>
      <path d="M54 30V48M54 36H62M54 43H62" fill="none" stroke={C.gold} strokeWidth={1.1} strokeOpacity={0.85} />
      <circle cx={54} cy={30} r={2.1} fill={C.gold} />
      <circle cx={63} cy={36} r={1.9} fill={C.gold} fillOpacity={0.8} />
      <circle cx={63} cy={43} r={1.7} fill={C.gold} fillOpacity={0.65} />
      <text x={80} y={40} {...ui(11.5, C.ink, { fontWeight: 600, letterSpacing: 5 })}>STRATA</text>
      <text x={80} y={54} {...mono(8.5, C.dim, { letterSpacing: 1.1 })}>OUTLINES WITH AGENTS</text>

      {Array.from({ length: 6 }, (_, index) => {
        const x = 1000 + index * 26;
        return (
          <g key={`tick-${index}`}>
            <rect x={x} y={38} width={20} height={2.5} rx={1.25} fill="#211C16" />
            <rect
              x={x}
              y={38}
              width={20}
              height={2.5}
              rx={1.25}
              fill={C.gold}
              animation={TICK_MOTION[index]}
            />
          </g>
        );
      })}

      <line x1={48} y1={68} x2={1152} y2={68} stroke={C.rule} strokeOpacity={0.08} />
    </g>
  );
}

interface CopyScene {
  kicker: string;
  lines: [Child, Child];
  sub: [string, string];
}

const COPY_SCENES: CopyScene[] = [
  {
    kicker: "00 · THE PAGE",
    lines: ["A place for", "every thought."],
    sub: ["Nested notes, quiet by default. Agents", "wait in the margin until mentioned."],
  },
  {
    kicker: "01 · THE MENTION",
    lines: ["Ask at the", "exact point."],
    sub: ["Type @ anywhere in the tree. The branch", "above it becomes the context."],
  },
  {
    kicker: "02 · THE RESPONSE",
    lines: ["An answer", "beside the thought."],
    sub: ["Sourced, threaded, and one keystroke", "from becoming a node."],
  },
  {
    kicker: "03 · THE BRANCH",
    lines: ["Delegate", "a whole branch."],
    sub: ["Agents read the path above them and", "write structure beneath it."],
  },
  {
    kicker: "04 · THE MARGIN",
    lines: ["Notes that", <>keep <tspan fontStyle="italic">thinking.</tspan></>],
    sub: ["Some don’t wait to be asked. They watch,", "cross-check, and leave a note."],
  },
  {
    kicker: "STRATA · OUTLINES WITH AGENTS",
    lines: [
      "Ask anywhere.",
      <>Answer in <tspan fontStyle="italic">place</tspan><tspan fill={C.gold}>.</tspan></>,
    ],
    sub: ["Mention an agent at any thought.", "The answer stays in the tree."],
  },
];

export function Copy(): SvgNode {
  return (
    <>
      {COPY_SCENES.map((scene, index) => (
        <g key={`copy-${index}`} animation={COPY_MOTION[index]}>
          <text x={48} y={124} {...mono(9.5, C.gold, { fontWeight: 600, letterSpacing: 2.2 })}>{scene.kicker}</text>
          <text x={48} y={170} {...serif(33, C.ink)}>{scene.lines[0]}</text>
          <text x={48} y={209} {...serif(33, C.ink)}>{scene.lines[1]}</text>
          <text x={48} y={246} {...ui(12.5, C.muted)}>{scene.sub[0]}</text>
          <text x={48} y={264} {...ui(12.5, C.muted)}>{scene.sub[1]}</text>
        </g>
      ))}
    </>
  );
}

const INDEX_ROWS = [
  { number: "01", label: "Mention", note: "ask mid-thought" },
  { number: "02", label: "Respond", note: "sourced, in place" },
  { number: "03", label: "Branch", note: "structure, written" },
  { number: "04", label: "Watch", note: "quiet cross-checks" },
];

export function Index(): SvgNode {
  return (
    <g animation={enter({ at: 0.36, over: 0.52 }).at(25.82).to({ opacity: 0 }, 0.16)}>
      <line x1={48} y1={560} x2={320} y2={560} stroke={C.rule} strokeOpacity={0.08} />
      <text x={48} y={584} {...mono(8.5, C.faint, { letterSpacing: 2 })}>IN THIS OUTLINE</text>

      {INDEX_ROWS.map((row, index) => {
        const y = 608 + index * 24;
        return (
          <g key={`index-row-${index}`}>
            <text x={48} y={y} {...mono(8.5, C.faint)}>{row.number}</text>
            <text x={68} y={y} {...ui(11.5, "#9A9082")}>{row.label}</text>
            <text x={320} y={y} {...ui(9, C.faint, { textAnchor: "end" })}>{row.note}</text>
          </g>
        );
      })}

      {INDEX_ROWS.map((row, index) => {
        const y = 608 + index * 24;
        return (
          <g key={`index-active-${index}`} animation={ACTIVE_MOTION[index]}>
            <text x={48} y={y} {...mono(8.5, C.gold)}>{row.number}</text>
            <text x={68} y={y} {...ui(11.5, C.gold)}>{row.label}</text>
          </g>
        );
      })}
    </g>
  );
}

export function Footer(): SvgNode {
  return (
    <>
      <text x={48} y={736} {...mono(8, C.footer, { letterSpacing: 1 })}>A QUIET DEMONSTRATION · 26S LOOP</text>
      <text x={1120} y={736} {...mono(8, C.footer, { letterSpacing: 1, textAnchor: "end" })}>FIG. 01 — AGENTS IN THE MARGIN</text>
    </>
  );
}

export function Rules(): SvgNode {
  return (
    <>
      <line x1={338} y1={92} x2={338} y2={704} stroke={C.rule} strokeOpacity={0.055} />
      <line x1={338} y1={92} x2={346} y2={92} stroke={C.gold} strokeOpacity={0.35} />
    </>
  );
}
